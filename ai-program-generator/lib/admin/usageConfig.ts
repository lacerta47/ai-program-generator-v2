import { adminDb } from '@/lib/firebase/admin';

const parsedLimit = Number(process.env.GEN_TOTAL_LIMIT || 5);
export const ENV_TOTAL_LIMIT = Number.isInteger(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 5;
// 교사·관리자 보호용 일일 한도는 기존 정책 유지.
export const ROLE_DAILY_LIMIT = Number(process.env.ROLE_GEN_DAILY_LIMIT) || 100;

/** 회원별 맞춤 한도는 기존 숫자를 계승. 새 저장값은 totalLimit을 우선한다. */
export function configuredTotalLimit(data: { totalLimit?: unknown; dailyLimit?: unknown } | undefined): number | null {
  const value = data?.totalLimit ?? data?.dailyLimit;
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/** 문서가 없으면 기본값. DB 장애는 전파하여 임의 한도로 생성을 허용하지 않는다. */
export async function readTotalLimit(): Promise<number> {
  const snap = await adminDb.doc('config/usage').get();
  // 이전 전역 일일 한도는 계승하지 않는다. 일반 회원 기본 총 한도는 5회로 전환.
  return configuredTotalLimit({ totalLimit: snap.data()?.totalLimit }) ?? ENV_TOTAL_LIMIT;
}

export async function writeTotalLimit(totalLimit: number): Promise<void> {
  await adminDb.doc('config/usage').set({ totalLimit, updatedAt: Date.now() }, { merge: true });
}

export async function readUserOverride(uid: string): Promise<number | null> {
  const snap = await adminDb.doc(`limits/${uid}`).get();
  return configuredTotalLimit(snap.data());
}

export async function readEffectiveTotalLimit(uid: string): Promise<number> {
  return (await readUserOverride(uid)) ?? await readTotalLimit();
}

export async function setUserLimit(uid: string, totalLimit: number): Promise<void> {
  await adminDb.doc(`limits/${uid}`).set({ totalLimit, updatedAt: Date.now() }, { merge: true });
}

/** 일반 회원 맞춤 한도 해제. 누적 사용량은 초기화하지 않는다. */
export async function clearUserLimit(uid: string): Promise<void> {
  await adminDb.doc(`limits/${uid}`).delete();
}
