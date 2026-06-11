import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';

// 미리보기 문서 임시 저장소 — Firestore 'previews' 컬렉션 (Admin SDK 전용, 클라이언트 규칙 없음 = 접근 불가).
// 메모리 Map 대신 Firestore를 쓰는 이유: Next dev의 라우트 워커 분리·배포 환경의
// 다중 인스턴스에서도 POST(저장)와 GET(서빙)이 같은 데이터를 보게 하기 위함.
const TTL_MS = 10 * 60 * 1000;
const COL = 'previews';

export async function putPreview(doc: string): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await adminDb.collection(COL).doc(id).set({ doc, exp: now + TTL_MS });
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

export async function getPreview(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as { doc: string; exp: number };
  if (data.exp < Date.now()) {
    snap.ref.delete().catch(() => {});
    return null;
  }
  return data.doc;
}
