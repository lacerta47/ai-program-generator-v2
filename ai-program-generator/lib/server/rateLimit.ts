import { adminDb } from '@/lib/firebase/admin';

// 고정 윈도 레이트리밋(비환불) 공용 유틸. {collection}/{key} 문서에 {windowStart, count}를 두고,
// 창이 지나면 리셋·창 안에서 max 도달 시 false(차단). 경계에서 최대 2x 버스트가 가능하나
// '무제한 방지' 목적엔 무방하다. 만료 문서는 기회적으로 정리(무한 누적 방지).
// Admin SDK 전용(대상 컬렉션은 클라 규칙 없음 = 기본 거부).
export async function allowFixedWindow(
  collection: string,
  key: string,
  windowMs: number,
  max: number,
): Promise<boolean> {
  const ref = adminDb.doc(`${collection}/${key}`);
  const allowed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.data();
    if (!d || now - (d.windowStart as number) > windowMs) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if ((d.count as number) >= max) return false;
    tx.update(ref, { count: (d.count as number) + 1 });
    return true;
  });
  // 기회적 청소: 만료된 카운터 몇 개 정리(비용 미미).
  adminDb
    .collection(collection)
    .where('windowStart', '<', Date.now() - windowMs)
    .limit(20)
    .get()
    .then((snap) => Promise.all(snap.docs.map((doc) => doc.ref.delete())))
    .catch(() => {});
  return allowed;
}
