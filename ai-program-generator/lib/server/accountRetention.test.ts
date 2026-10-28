import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  blocked: true,
  authDisabled: true,
  getUser: vi.fn(),
  deleteAccountCascade: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { getUser: (...args: unknown[]) => mocks.getUser(...args) },
  adminDb: {
    collection: () => ({
      where: () => ({ limit: () => ({ get: async () => ({ docs: [{ id: 'student-a', ref: { update: vi.fn() } }], size: 1 }) }) }),
    }),
    doc: () => ({ get: async () => ({ data: () => ({ blocked: mocks.blocked }) }) }),
  },
}));
vi.mock('@/lib/server/deleteAccount', () => ({ deleteAccountCascade: (...args: unknown[]) => mocks.deleteAccountCascade(...args) }));

import { deleteExpiredStudentAccounts } from './accountRetention';

describe('학생 보존 기한 정리', () => {
  beforeEach(() => {
    mocks.blocked = true;
    mocks.authDisabled = true;
    mocks.getUser.mockReset().mockImplementation(async () => ({ disabled: mocks.authDisabled }));
    mocks.deleteAccountCascade.mockReset().mockResolvedValue(undefined);
  });

  test('기한이 지난 비활성 계정만 삭제한다', async () => {
    expect(await deleteExpiredStudentAccounts()).toBe(1);
    expect(mocks.deleteAccountCascade).toHaveBeenCalledWith('student-a');
  });

  test('차단 표식이 없거나 Auth가 다시 활성화된 계정은 삭제하지 않는다', async () => {
    mocks.blocked = false;
    expect(await deleteExpiredStudentAccounts()).toBe(0);
    mocks.blocked = true;
    mocks.authDisabled = false;
    expect(await deleteExpiredStudentAccounts()).toBe(0);
    expect(mocks.deleteAccountCascade).not.toHaveBeenCalled();
  });
});
