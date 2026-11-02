import { beforeEach, expect, test, vi } from 'vitest';

const store = vi.hoisted(() => ({
  docs: new Map<string, { windowStart: number; count: number }>(),
  cleanup: undefined as undefined | (() => void),
}));
vi.mock('@/lib/firebase/admin', () => {
  const ref = (path: string) => ({ path, delete: async () => { store.docs.delete(path); } });
  return { adminDb: {
    doc: ref,
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (r: { path: string }) => ({ data: () => store.docs.get(r.path) }),
      set: (r: { path: string }, data: { windowStart: number; count: number }) => store.docs.set(r.path, data),
      update: (r: { path: string }, data: { count: number }) => store.docs.set(r.path, { ...store.docs.get(r.path)!, ...data }),
      delete: (r: { path: string }) => store.docs.delete(r.path),
    }),
    collection: (name: string) => ({ where: (_field: string, _op: string, cutoff: number) => ({ limit: () => ({
      get: () => new Promise(resolve => {
        const docs = [...store.docs].filter(([key, data]) => key.startsWith(name + '/') && data.windowStart < cutoff).map(([path]) => ({ ref: ref(path) }));
        store.cleanup = () => resolve({ docs });
      }),
    }) }) }),
  } };
});
import { allowFixedWindow } from './rateLimit';

beforeEach(() => { store.docs.clear(); store.cleanup = undefined; });

test('만료 조회 후 새 윈도로 갱신된 카운터를 청소 작업이 지우지 않는다', async () => {
  store.docs.set('genAdmission/other', { windowStart: Date.now() - 60_000, count: 30 });
  expect(await allowFixedWindow('genAdmission', 'requester', 1000, 30)).toBe(true);
  store.docs.set('genAdmission/other', { windowStart: Date.now(), count: 20 });
  store.cleanup!();
  await new Promise(resolve => setImmediate(resolve));
  expect(store.docs.get('genAdmission/other')?.count).toBe(20);
});

test('여전히 만료된 카운터만 정리하고 현재 요청의 카운터는 유지한다', async () => {
  store.docs.set('genAdmission/other', { windowStart: Date.now() - 60_000, count: 30 });
  await allowFixedWindow('genAdmission', 'requester', 1000, 30);
  store.cleanup!();
  await new Promise(resolve => setImmediate(resolve));
  expect(store.docs.has('genAdmission/other')).toBe(false);
  expect(store.docs.get('genAdmission/requester')?.count).toBe(1);
});
