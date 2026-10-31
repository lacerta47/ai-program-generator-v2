import { randomInt, randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { UserFacingError, GenerationBusyError } from '@/lib/ai/errors';

const LEASE_MS = 120_000;
const RENEW_MS = 20_000;

function capacity(route: 'gemini' | 'bizrouter') {
  const value = Number(process.env[route === 'gemini' ? 'GEN_GEMINI_CONCURRENCY' : 'GEN_BIZROUTER_CONCURRENCY'] ?? 4);
  if (!Number.isInteger(value) || value < 1 || value > 16) throw new Error('생성 동시 실행 설정은 1~16이어야 합니다.');
  return value;
}

/** Fixed slot documents avoid a single global counter. Admin SDK only. */
export async function acquireGenerationSlot(route: 'gemini' | 'bizrouter', parent: AbortSignal) {
  parent.throwIfAborted();
  const owner = randomUUID();
  const count = capacity(route);
  const offset = randomInt(count);
  let acquired: { ref: ReturnType<typeof adminDb.doc>; expiresAt: number } | null = null;
  for (let i = 0; i < count; i++) {
    const ref = adminDb.doc(`generationSlots/${route}-${(offset + i) % count}`);
    const expiresAt = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      const now = Date.now();
      if (data && (typeof data.expiresAt !== 'number' || data.expiresAt > now)) return null;
      const expiresAt = now + LEASE_MS;
      tx.set(ref, { owner, expiresAt });
      return expiresAt;
    });
    if (expiresAt !== null) { acquired = { ref, expiresAt }; break; }
  }
  if (!acquired) throw new GenerationBusyError();
  const slot = acquired.ref;

  const controller = new AbortController();
  const signal = AbortSignal.any([parent, controller.signal]);
  let released = false;
  let renewing: Promise<void> | undefined;
  let heartbeat: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;
  const lost = () => controller.abort(new UserFacingError('연결을 확인하지 못했어요. 잠깐 뒤 다시 만들어 주세요.'));
  const armDeadline = (expiresAt: number) => {
    clearTimeout(deadline);
    deadline = setTimeout(lost, Math.max(0, expiresAt - Date.now() - RENEW_MS));
    deadline.unref();
  };
  const renew = async () => {
    try {
      const expiresAt = await adminDb.runTransaction(async (tx) => {
        const data = (await tx.get(slot)).data();
        const now = Date.now();
        if (data?.owner !== owner || typeof data.expiresAt !== 'number' || data.expiresAt <= now) return null;
        tx.update(slot, { expiresAt: now + LEASE_MS });
        return now + LEASE_MS;
      });
      if (released || signal.aborted) return;
      if (expiresAt === null) { lost(); return; }
      armDeadline(expiresAt);
      schedule();
    } catch { lost(); }
  };
  const schedule = () => {
    heartbeat = setTimeout(() => { renewing = renew(); }, RENEW_MS);
    heartbeat.unref();
  };
  armDeadline(acquired.expiresAt);
  schedule();
  const stopTimers = () => { clearTimeout(heartbeat); clearTimeout(deadline); };
  signal.addEventListener('abort', stopTimers, { once: true });
  const release = async () => {
    if (released) return;
    released = true;
    clearTimeout(heartbeat);
    clearTimeout(deadline);
    controller.abort();
    signal.removeEventListener('abort', stopTimers);
    await renewing;
    try {
      await adminDb.runTransaction(async (tx) => {
        const data = (await tx.get(slot)).data();
        if (data?.owner === owner) tx.delete(slot);
      });
    } catch { /* The lease expires if cleanup fails. */ }
  };
  if (signal.aborted) { await release(); signal.throwIfAborted(); }
  return { signal, release };
}
