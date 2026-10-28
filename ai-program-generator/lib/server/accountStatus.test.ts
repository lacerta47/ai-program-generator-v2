import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  events: [] as string[],
  studentExists: false,
  set: vi.fn(),
  update: vi.fn(),
  updateUser: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => ({
      set: async () => { mocks.events.push(`set:${path}`); await mocks.set(); },
      get: async () => ({ exists: mocks.studentExists }),
      update: async () => { mocks.events.push(`update:${path}`); await mocks.update(); },
    }),
  },
  adminAuth: {
    updateUser: async () => { mocks.events.push('auth:update'); await mocks.updateUser(); },
    revokeRefreshTokens: async () => { mocks.events.push('auth:revoke'); await mocks.revoke(); },
  },
}));

import { setAccountDisabled } from './accountStatus';

describe('계정 정지 순서', () => {
  beforeEach(() => {
    mocks.events.length = 0;
    mocks.studentExists = false;
    mocks.set.mockReset();
    mocks.update.mockReset();
    mocks.updateUser.mockReset();
    mocks.revoke.mockReset();
  });

  test('정지는 Firestore 접근부터 막고 Auth 토큰을 폐기한다', async () => {
    await setAccountDisabled('student-a', true);
    expect(mocks.events).toEqual(['set:accountStatus/student-a', 'auth:update', 'auth:revoke']);
  });

  test('상태 기록 실패 시 계정을 조용히 넘기지 않는다', async () => {
    mocks.set.mockRejectedValue(new Error('Firestore unavailable'));
    await expect(setAccountDisabled('student-a', true)).rejects.toThrow('Firestore unavailable');
    expect(mocks.events).toEqual(['set:accountStatus/student-a']);
  });

  test('정지 해제는 Auth를 먼저 복구하고 학생 파기 예약을 지운다', async () => {
    mocks.studentExists = true;
    await setAccountDisabled('student-a', false);
    expect(mocks.events).toEqual(['auth:update', 'update:students/student-a', 'set:accountStatus/student-a']);
  });
});
