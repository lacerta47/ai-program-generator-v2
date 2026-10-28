import { doc, getDoc } from 'firebase/firestore';
import { db } from './client';
import { authedFetch } from '@/lib/client/authedFetch';
import type { UserProfile } from './types';

const COL = 'users';

export const NICKNAME_COOLDOWN_DAYS = 15;

export type NicknameFailReason = 'taken' | 'cooldown' | 'profanity' | 'reserved';

/** 닉네임 설정/변경 실패 사유를 구분하기 위한 에러 */
export class NicknameError extends Error {
  reason: NicknameFailReason;
  daysLeft?: number;
  constructor(reason: NicknameFailReason, daysLeft?: number) {
    super(reason);
    this.name = 'NicknameError';
    this.reason = reason;
    this.daysLeft = daysLeft;
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COL, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

/**
 * 닉네임 설정/변경. 서버 API가 ID 토큰의 uid로 점유·15일 쿨다운을 트랜잭션에서 검사한다.
 * 같은 별명 재저장은 no-op.
 */
export async function claimNickname(uid: string, displayName: string): Promise<void> {
  void uid; // 서버가 ID 토큰에서 실제 uid를 확인한다.
  const res = await authedFetch('/api/me/nickname', {
    method: 'POST',
    body: JSON.stringify({ nickname: displayName }),
  });
  const result = await res.json() as { reason?: NicknameFailReason; daysLeft?: number; error?: string };
  if (!res.ok) {
    if (result.reason) throw new NicknameError(result.reason, result.daysLeft);
    throw new Error(result.error ?? '별명을 정하지 못했어요.');
  }
}
