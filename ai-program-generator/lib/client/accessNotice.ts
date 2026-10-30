export const ACCOUNT_DISABLED_MESSAGE = '이 계정은 잠시 이용할 수 없어요. 선생님이나 관리자에게 문의해 주세요.';

export function accessNotice(error: unknown, signedIn: boolean): {
  message: string;
  action: 'login' | 'retry' | null;
} {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === 'auth/user-disabled') {
    return { message: ACCOUNT_DISABLED_MESSAGE, action: null };
  }
  if (['unauthenticated', 'firestore/unauthenticated', 'auth/user-token-expired', 'auth/invalid-user-token'].includes(String(code))) {
    return { message: '로그인이 풀렸어요. 다시 로그인해 주세요.', action: 'login' };
  }
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return signedIn
      ? { message: '이 작품이나 게시판을 볼 수 없어요. 우리 반 계정이 맞는지 확인하고, 계속 안 되면 선생님이나 관리자에게 문의해 주세요.', action: null }
      : { message: '이 작품이나 게시판을 보려면 로그인이 필요해요.', action: 'login' };
  }
  if (['unavailable', 'deadline-exceeded', 'firestore/unavailable', 'firestore/deadline-exceeded', 'auth/network-request-failed'].includes(String(code))) {
    return { message: '연결이 원활하지 않아요. 인터넷 연결을 확인하고 잠시 후 다시 해주세요.', action: 'retry' };
  }
  return { message: '작품을 불러오지 못했어요. 잠시 후 다시 해주세요.', action: 'retry' };
}
