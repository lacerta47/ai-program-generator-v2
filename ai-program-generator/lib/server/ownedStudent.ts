import { adminDb } from '@/lib/firebase/admin';

/**
 * 대상 학생이 caller(교사) 소속이면 그 문서 데이터, 아니면 null.
 * 단일/일괄 학생 관리 라우트가 공유하는 소유권 게이트 — 모든 쓰기는 이걸 통과해야 한다.
 */
export async function getOwnedStudent(
  callerUid: string,
  uid: string,
): Promise<FirebaseFirestore.DocumentData | null> {
  const snap = await adminDb.doc(`students/${uid}`).get();
  const data = snap.data();
  if (!snap.exists || !data || data.teacherUid !== callerUid) return null;
  return data;
}
