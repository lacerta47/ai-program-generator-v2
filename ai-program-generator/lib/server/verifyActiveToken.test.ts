import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  blocked: false,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken },
  adminDb: { doc: () => ({ get: async () => ({ data: () => ({ blocked: mocks.blocked }) }) }) },
}));

import { verifyActiveToken } from './verifyActiveToken';

describe('서버 계정 상태 확인', () => {
  beforeEach(() => {
    mocks.blocked = false;
    mocks.verifyIdToken.mockReset().mockResolvedValue({ uid: 'student-a' });
  });

  test('Auth 토큰 폐기 여부를 확인한다', async () => {
    await expect(verifyActiveToken('valid')).resolves.toHaveProperty('uid', 'student-a');
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('valid', true);
  });

  test('Auth가 아직 활성 상태라도 Firestore 차단 표식이 있으면 거부한다', async () => {
    mocks.blocked = true;
    await expect(verifyActiveToken('old')).rejects.toThrow('ACCOUNT_BLOCKED');
  });
});
