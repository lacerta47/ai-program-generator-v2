import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { buildPreviewDoc } from '@/lib/program';
import { substitutePhoto } from '@/lib/ai/photo';
import type { GeneratedCode } from '@/lib/ai/types';

// 미리보기 문서 임시 저장소 — Firestore 'previews' 컬렉션 (Admin SDK 전용, 클라이언트 규칙 없음 = 접근 불가).
// 메모리 Map 대신 Firestore를 쓰는 이유: Next dev의 라우트 워커 분리·배포 환경의
// 다중 인스턴스에서도 POST(저장)와 GET(서빙)이 같은 데이터를 보게 하기 위함.
//
// 저장은 토큰 코드 + 사진(별도 필드), 펼치기(__PHOTO__ 치환 + 단일 doc 빌드)는 서빙(getPreview) 시점.
// 사진을 N회 참조해도 저장 문서는 토큰코드(≤150k×3) + 사진 1장(≤400k)으로 바운드돼 1MB를 넘지 않는다.
// N회 인라인은 무제한인 GET HTTP 응답에만 존재한다.
const TTL_MS = 10 * 60 * 1000;
const COL = 'previews';

interface PreviewRecord {
  code: GeneratedCode;
  photo?: string;
  exp: number;
}

export async function putPreview(code: GeneratedCode, photo?: string): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const data: PreviewRecord = { code, exp: now + TTL_MS };
  if (photo) data.photo = photo; // undefined는 Firestore가 거부 → 있을 때만 기록
  await adminDb.collection(COL).doc(id).set(data);
  // 기회적 청소: 만료된 문서 몇 개 정리 (비용 미미)
  adminDb
    .collection(COL)
    .where('exp', '<', now)
    .limit(20)
    .get()
    .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
    .catch(() => {});
  return id;
}

/**
 * 만료된 미리보기 문서를 일괄 삭제(스케줄 cron용). 한 번에 최대 maxDocs건까지 배치 삭제.
 * putPreview의 기회적 청소(쓰기당 20건)만으로는 한산할 때 만료분이 쌓이므로, 주기적 정리로 보강.
 * exp 단일필드 범위쿼리라 자동 인덱스 사용(복합 인덱스 불필요).
 */
export async function deleteExpiredPreviews(maxDocs = 5000): Promise<number> {
  const now = Date.now();
  let deleted = 0;
  while (deleted < maxDocs) {
    const snap = await adminDb.collection(COL).where('exp', '<', now).limit(450).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 450) break; // 마지막 배치
  }
  return deleted;
}

export async function getPreview(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<PreviewRecord>;
  if (!data.exp || data.exp < Date.now()) {
    snap.ref.delete().catch(() => {});
    return null;
  }
  if (!data.code) return null; // 구버전/손상 레코드 방어
  // 펼치기: __PHOTO__ → data-URI 치환 후 단일 HTML 문서로. N회 인라인은 여기(HTTP 응답)에만, 1MB 무관.
  return buildPreviewDoc(substitutePhoto(data.code, data.photo));
}
