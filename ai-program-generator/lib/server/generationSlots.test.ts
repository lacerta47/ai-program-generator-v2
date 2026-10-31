import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ docs: new Map<string, Record<string, unknown>>(), tail: Promise.resolve(), fail: false }));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: {
  doc: (path: string) => ({ path }),
  runTransaction: (fn: (tx: unknown) => Promise<unknown>) => {
    const run = store.tail.then(async () => {
      if (store.fail) throw new Error('DB unavailable');
      return fn({
        get: async (ref: { path: string }) => ({ data: () => store.docs.get(ref.path) }),
        set: (ref: { path: string }, data: Record<string, unknown>) => store.docs.set(ref.path, { ...data }),
        update: (ref: { path: string }, data: Record<string, unknown>) => store.docs.set(ref.path, { ...store.docs.get(ref.path), ...data }),
        delete: (ref: { path: string }) => store.docs.delete(ref.path),
      });
    });
    store.tail = run.then(() => undefined, () => undefined);
    return run;
  },
} }));
import { acquireGenerationSlot } from './generationSlots';
import { GenerationBusyError } from '@/lib/ai/errors';

beforeEach(() => {
  store.docs.clear(); store.tail = Promise.resolve(); store.fail = false;
  vi.useFakeTimers(); vi.setSystemTime(1_000_000);
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '2');
  vi.stubEnv('GEN_BIZROUTER_CONCURRENCY', '2');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });
const signal = () => new AbortController().signal;

it('parallel admissions respect per-route capacity and release is idempotent', async () => {
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => acquireGenerationSlot('gemini', signal())));
  const leases = results.flatMap(x => x.status === 'fulfilled' ? [x.value] : []);
  expect(leases).toHaveLength(2);
  expect(results.filter(x => x.status === 'rejected' && x.reason instanceof GenerationBusyError)).toHaveLength(6);
  const other = await acquireGenerationSlot('bizrouter', signal());
  await leases[0].release(); await leases[0].release();
  const replacement = await acquireGenerationSlot('gemini', signal());
  expect(store.docs.size).toBe(3);
  await Promise.all([leases[1].release(), replacement.release(), other.release()]);
  expect(store.docs.size).toBe(0);
});

it('reclaims expired slots and old owners cannot delete the replacement', async () => {
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '1');
  const old = await acquireGenerationSlot('gemini', signal());
  vi.setSystemTime(Date.now() + 120001);
  const fresh = await acquireGenerationSlot('gemini', signal());
  const owner = store.docs.get('generationSlots/gemini-0')!.owner;
  await old.release();
  expect(store.docs.get('generationSlots/gemini-0')!.owner).toBe(owner);
  await fresh.release();
});

it('renews long generations and aborts when renewal fails', async () => {
  const lease = await acquireGenerationSlot('gemini', signal());
  const before = [...store.docs.values()][0].expiresAt as number;
  await vi.advanceTimersByTimeAsync(20_000);
  expect([...store.docs.values()][0].expiresAt).toBeGreaterThan(before);
  expect(lease.signal.aborted).toBe(false);
  store.fail = true;
  await vi.advanceTimersByTimeAsync(20_000);
  expect(lease.signal.aborted).toBe(true);
  await lease.release();
});

it('aborts before lease expiry if renewal stalls', async () => {
  const lease = await acquireGenerationSlot('gemini', signal());
  let unblock!: () => void;
  store.tail = new Promise<void>(resolve => { unblock = resolve; });
  await vi.advanceTimersByTimeAsync(100_001);
  expect(lease.signal.aborted).toBe(true);
  unblock();
  await lease.release();
  expect(store.docs.size).toBe(0);
});

it('propagates user cancellation and refuses already cancelled admissions', async () => {
  const parent = new AbortController();
  const lease = await acquireGenerationSlot('gemini', parent.signal);
  parent.abort();
  expect(lease.signal.aborted).toBe(true);
  await lease.release();
  await expect(acquireGenerationSlot('gemini', parent.signal)).rejects.toThrow();
  expect(store.docs.size).toBe(0);
});

it('fails closed on malformed capacity and database failure', async () => {
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '0');
  await expect(acquireGenerationSlot('gemini', signal())).rejects.toThrow('1~16');
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '2');
  store.fail = true;
  await expect(acquireGenerationSlot('gemini', signal())).rejects.toThrow('DB unavailable');
  expect(store.docs.size).toBe(0);
});
