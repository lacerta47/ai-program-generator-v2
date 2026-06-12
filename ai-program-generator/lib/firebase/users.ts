import { doc, getDoc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './client';
import { hasProfanity } from '@/lib/moderation';
import type { UserProfile } from './types';

const COL = 'users';
const NICK_COL = 'nicknames';

export const NICKNAME_COOLDOWN_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = NICKNAME_COOLDOWN_DAYS * DAY_MS;

export type NicknameFailReason = 'taken' | 'cooldown' | 'profanity';

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
 * - 변경 쿨다운: 마지막 변경 후 15일 이내엔 변경 불가
 *   (변경시각은 서버 타임스탬프로 저장 → 규칙에서도 request.time + duration 으로 강제)
 * - 같은 별명 재저장은 no-op
 */
export async function claimNickname(uid: string, displayName: string): Promise<void> {
  const name = displayName.trim();
  const key = keyOf(name);

  // 비속어 별명 차단(트랜잭션 전에 먼저 검사)
  if (await hasProfanity(name)) throw new NicknameError('profanity');

  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, COL, uid);
    const nickRef = doc(db, NICK_COL, key);
    const profileSnap = await tx.get(profileRef);
    const nickSnap = await tx.get(nickRef);

    const profile = profileSnap.data() as UserProfile | undefined;

    // 같은 이름이면 변경 없음
    if (profile?.nickname === name) return;

    // 이미 다른 별명을 쓰던 중이면(=변경) 쿨다운 확인
    // (구버전 number 타임스탬프는 Timestamp가 아니므로 1회 통과 후 새로 기록됨)
    const last = profile?.nicknameUpdatedAt;
    if (profile?.nickname && last instanceof Timestamp) {
      const elapsed = Date.now() - last.toMillis();
      if (elapsed < COOLDOWN_MS) {
        throw new NicknameError('cooldown', Math.ceil((COOLDOWN_MS - elapsed) / DAY_MS));
      }
    }

    // 다른 계정이 이미 점유한 별명이면 거부
    if (nickSnap.exists() && (nickSnap.data() as { uid: string }).uid !== uid) {
      throw new NicknameError('taken');
    }

    if (!nickSnap.exists()) tx.set(nickRef, { uid });
    tx.set(profileRef, { nickname: name, nicknameUpdatedAt: serverTimestamp() }, { merge: true });
  });
}
