import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from './client';
import type { UserProfile } from './types';

const COL = 'users';
const NICK_COL = 'nicknames';

export const NICKNAME_COOLDOWN_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = NICKNAME_COOLDOWN_DAYS * DAY_MS;

export type NicknameFailReason = 'taken' | 'cooldown';

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

const keyOf = (name: string) => name.trim().toLowerCase();

/**
 * 닉네임 설정/변경.
 * - 유일성: nicknames/{소문자별명} 문서를 계정이 영구 점유(다른 계정은 못 가져감, 재활용 없음)
 * - 변경 쿨다운: 마지막 변경 후 15일 이내엔 변경 불가(규칙에서도 서버시계로 강제)
 * - 같은 별명 재저장은 no-op
 */
export async function claimNickname(uid: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  const key = keyOf(name);

  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, COL, uid);
    const nickRef = doc(db, NICK_COL, key);
    const profileSnap = await tx.get(profileRef);
    const nickSnap = await tx.get(nickRef);

    const profile = profileSnap.data() as UserProfile | undefined;

    // 같은 이름이면 변경 없음
    if (profile?.nickname === name) return;

    // 이미 다른 별명을 쓰던 중이면(=변경) 쿨다운 확인
    if (profile?.nickname && typeof profile.nicknameUpdatedAt === 'number') {
      const elapsed = Date.now() - profile.nicknameUpdatedAt;
      if (elapsed < COOLDOWN_MS) {
        throw new NicknameError('cooldown', Math.ceil((COOLDOWN_MS - elapsed) / DAY_MS));
      }
    }

    // 다른 계정이 이미 점유한 별명이면 거부
    if (nickSnap.exists() && (nickSnap.data() as { uid: string }).uid !== uid) {
      throw new NicknameError('taken');
    }

    if (!nickSnap.exists()) tx.set(nickRef, { uid });
    tx.set(profileRef, { nickname: name, nicknameUpdatedAt: Date.now() }, { merge: true });
  });
}
