import { adminDb } from '@/lib/firebase/admin';

const parsedLimit = Number(process.env.GEN_DAILY_LIMIT);
/** env 기본 일일 한도(설정·오버라이드 없을 때 폴백). 0 허용. */
export const ENV_DAILY_LIMIT =
  Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 30;

/** 전역 일일 한도: config/usage.dailyLimit ?? env. 읽기 실패 시 env 폴백. */
export async function readDailyLimit(): Promise<number> {
  try {
    const snap = await adminDb.doc('config/usage').get();
    const v = snap.exists ? (snap.data()?.dailyLimit as number | undefined) : undefined;
    return typeof v === 'number' && v >= 0 ? v : ENV_DAILY_LIMIT;
  } catch (e) {
    console.error('config/usage 읽기 실패:', e);
    return ENV_DAILY_LIMIT;
  }
}

/** 전역 일일 한도 저장(admin 전용). */
export async function writeDailyLimit(dailyLimit: number): Promise<void> {
  await adminDb.doc('config/usage').set({ dailyLimit, updatedAt: Date.now() }, { merge: true });
}

/** 학생별 한도 오버라이드(limits/{uid}.dailyLimit). 없으면 null. */
export async function readUserOverride(uid: string): Promise<number | null> {
  try {
    const snap = await adminDb.doc(`limits/${uid}`).get();
    const v = snap.exists ? (snap.data()?.dailyLimit as number | undefined) : undefined;
    return typeof v === 'number' && v >= 0 ? v : null;
  } catch (e) {
    console.error('limits 읽기 실패:', e);
    return null;
  }
}

/** 사용자의 실효 일일 한도: 오버라이드 ?? 전역(config ?? env). */
export async function readEffectiveLimit(uid: string): Promise<number> {
  const override = await readUserOverride(uid);
  return override !== null ? override : await readDailyLimit();
}

/** 학생별 한도 오버라이드 저장. */
export async function setUserLimit(uid: string, dailyLimit: number): Promise<void> {
  await adminDb.doc(`limits/${uid}`).set({ dailyLimit, updatedAt: Date.now() }, { merge: true });
}

/** 학생별 한도 오버라이드 해제(전역으로 복귀). */
export async function clearUserLimit(uid: string): Promise<void> {
  await adminDb.doc(`limits/${uid}`).delete();
}
