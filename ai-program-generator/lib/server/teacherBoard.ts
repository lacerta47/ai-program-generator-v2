import { adminDb } from '@/lib/firebase/admin';

/**
 * 선생님 게시판(카테고리)을 보장한다. `teachers/{uid}.boardId` 캐시를 쓰고,
 * 없거나 그 카테고리가 사라졌으면 새로 만든다. 멱등(서버 Admin SDK — 규칙 우회).
 */
export async function ensureTeacherBoard(teacherUid: string): Promise<{ boardId: string; boardName: string }> {
  const teacherRef = adminDb.doc(`teachers/${teacherUid}`);
  const tSnap = await teacherRef.get();
  const t = tSnap.data();
  if (!t) throw new Error('teacher-not-found');
  const name = ((t.name as string | undefined) ?? '').trim() || '우리 반';

  const cachedId = t.boardId as string | undefined;
  if (cachedId) {
    const cSnap = await adminDb.doc(`categories/${cachedId}`).get();
    if (cSnap.exists) return { boardId: cachedId, boardName: (cSnap.data()?.name as string) ?? name };
  }

  const ref = await adminDb.collection('categories').add({
    name,
    order: Date.now(),
    createdAt: Date.now(),
    teacherUid,
  });
  await teacherRef.set({ boardId: ref.id }, { merge: true });
  return { boardId: ref.id, boardName: name };
}
