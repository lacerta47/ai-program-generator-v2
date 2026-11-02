import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const transaction = vi.hoisted(() => vi.fn());
vi.mock('@/lib/firebase/admin', () => ({ adminDb: {
  doc: (path: string) => ({ path }),
  collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }),
  runTransaction: transaction,
} }));
import { reserveStudentQuota } from './studentQuota';
beforeEach(() => { transaction.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

test.each([10, 'ABORTED'])('커밋되지 않은 충돌 %s만 안전한 재입장으로 구분한다', async (code) => {
  transaction.mockRejectedValue({ code });
  expect(await reserveStudentQuota('student')).toEqual({ ok: false, reason: 'busy' });
});

test.each([4, 14, 'UNKNOWN'])('접수 여부가 불명확한 DB 오류 %s는 자동 재시도하지 않는다', async (code) => {
  transaction.mockRejectedValue({ code });
  expect(await reserveStudentQuota('student')).toEqual({ ok: false, reason: 'misconfig' });
});
