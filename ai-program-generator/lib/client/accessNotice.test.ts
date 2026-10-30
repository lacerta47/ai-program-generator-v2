import { describe, expect, test } from 'vitest';
import { accessNotice, ACCOUNT_DISABLED_MESSAGE } from './accessNotice';

describe('게시판 접근 오류 안내', () => {
  test('정지 오류가 확인된 경우만 정지 안내를 한다', () => {
    expect(accessNotice({ code: 'auth/user-disabled' }, false)).toEqual({
      message: ACCOUNT_DISABLED_MESSAGE, action: null,
    });
  });

  test.each(['permission-denied', 'firestore/permission-denied'])('%s: 비로그인은 로그인, 로그인 상태는 권한 안내', (code) => {
    expect(accessNotice({ code }, false)).toEqual({
      message: '이 작품이나 게시판을 보려면 로그인이 필요해요.', action: 'login',
    });
    const denied = accessNotice({ code }, true);
    expect(denied.action).toBeNull();
    expect(denied.message).toContain('선생님이나 관리자');
    expect(denied.message).not.toContain('인터넷');
    expect(denied.message).not.toBe(ACCOUNT_DISABLED_MESSAGE);
  });

  test.each(['unauthenticated', 'auth/user-token-expired', 'auth/invalid-user-token'])('%s: 다시 로그인하도록 안내', (code) => {
    expect(accessNotice({ code }, true).action).toBe('login');
  });

  test.each(['unavailable', 'firestore/deadline-exceeded', 'auth/network-request-failed'])('%s: 연결 확인과 재시도 안내', (code) => {
    expect(accessNotice({ code }, true)).toEqual({
      message: '연결이 원활하지 않아요. 인터넷 연결을 확인하고 잠시 후 다시 해주세요.', action: 'retry',
    });
  });

  test('원인 불명의 오류를 정지나 네트워크 문제로 단정하지 않고 원문을 노출하지 않는다', () => {
    for (const error of [null, new Error('internal/private-details'), { code: 'failed-precondition' }]) {
      expect(accessNotice(error, false)).toEqual({
        message: '작품을 불러오지 못했어요. 잠시 후 다시 해주세요.', action: 'retry',
      });
    }
  });
});
