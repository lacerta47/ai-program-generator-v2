import { adminDb } from '@/lib/firebase/admin';

// 생성 시작 레이트리밋(uid별 슬라이딩 윈도) — 환불과 무관한 '비환불' 카운터.
// 목적: /api/generate의 취소(abort)→환불 정책을 악용한 무한 재호출(abort-파밍)로
// 한 계정이 유료 Gemini 호출을 무제한 발생시키는 비용/DoS 증폭을 상한한다. (외부 취약점 분석 B2)
// 일일 쿼터(usage)는 환불되면 되돌아오지만, 이 카운터는 되돌아오지 않으므로 호출 '빈도'의 천장이 된다.
// Admin SDK 전용(genRate는 클라 규칙 없음 = 기본 거부).
const WINDOW_MS = 10 * 60 * 1000; // 10분
const MAX_STARTS = Number(process.env.GEN_RATE_MAX) || 30; // 창당 최대 시작 횟수(정상 사용엔 넉넉, 어뷰징엔 상한)

/** uid의 최근 창(10분) 생성 시작 횟수가 상한 미만이면 카운트+true, 초과면 false(차단). */
export async function allowGenerate(uid: string): Promise<boolean> {
  const ref = adminDb.doc(`genRate/${uid}`);
  const allowed = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.data();
    if (!d || now - (d.windowStart as number) > WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if ((d.count as number) >= MAX_STARTS) return false;
    tx.update(ref, { count: (d.count as number) + 1 });
    return true;
  });
  // 기회적 청소: 만료된 카운터 몇 개 정리(putPreview와 동일 패턴, 비용 미미).
  adminDb
    .collection('genRate')
    .where('windowStart', '<', Date.now() - WINDOW_MS)
    .limit(20)
    .get()
    .then((snap) => Promise.all(snap.docs.map((doc) => doc.ref.delete())))
    .catch(() => {});
  return allowed;
}
