import { adminDb } from '@/lib/firebase/admin';

/** 일반 회원 전환 이후 총 사용량. 과거 usage 일일 기록은 소급 합산하지 않는다. */
export async function reserveMemberQuota(uid: string, limit: number, cost: number, day: string): Promise<boolean> {
  const totalRef = adminDb.doc(`memberUsage/${uid}`);
  const dayRef = adminDb.doc(`usage/${uid}_${day}`);
  return adminDb.runTransaction(async (tx) => {
    const total = await tx.get(totalRef);
    const daily = await tx.get(dayRef);
    const used = (total.data()?.count as number | undefined) ?? 0;
    if (used + cost > limit) return false;
    const now = Date.now();
    tx.set(totalRef, { uid, count: used + cost, updatedAt: now }, { merge: true });
    tx.set(dayRef, {
      uid, day, count: ((daily.data()?.count as number | undefined) ?? 0) + cost, updatedAt: now,
    }, { merge: true });
    return true;
  });
}

/** 실패·취소 시 총 사용량과 예약 당시 날짜의 집계를 함께 복구한다. 호출부에서 1회만 호출. */
export async function refundMemberQuota(uid: string, cost: number, day: string): Promise<void> {
  const refs = [adminDb.doc(`memberUsage/${uid}`), adminDb.doc(`usage/${uid}_${day}`)];
  await adminDb.runTransaction(async (tx) => {
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    snapshots.forEach((snap, index) => {
      if (snap.exists) tx.update(refs[index], {
        count: Math.max(0, ((snap.data()?.count as number | undefined) ?? 0) - cost),
        updatedAt: Date.now(),
      });
    });
  });
}
