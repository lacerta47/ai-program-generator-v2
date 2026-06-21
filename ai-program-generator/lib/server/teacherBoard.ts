import { adminDb } from '@/lib/firebase/admin';

/**
 * 선생님 게시판(카테고리)을 보장한다. `teachers/{uid}.boardId` 캐시를 쓰고,
 * 없거나 그 카테고리가 사라졌으면 새로 만든다. 멱등(서버 Admin SDK — 규칙 우회).
 * 트랜잭션으로 teachers 문서를 잠가, 동시 최초 호출이 카테고리를 중복 생성하지 않게 한다.
 */
export async function ensureTeacherBoard(teacherUid: string): Promise<{ boardId: string; boardName: string }> {
  const teacherRef = adminDb.doc(`teachers/${teacherUid}`);
  return adminDb.runTransaction(async (tx) => {
    // --- reads (모든 read를 write보다 먼저) ---
    const tSnap = await tx.get(teacherRef);
    const t = tSnap.data();
    if (!t) throw new Error('teacher-not-found');
    const name = ((t.name as string | undefined) ?? '').trim() || '우리 반';

    const cachedId = t.boardId as string | undefined;
    if (cachedId) {
      const cSnap = await tx.get(adminDb.doc(`categories/${cachedId}`));
      if (cSnap.exists) {
        return { boardId: cachedId, boardName: (cSnap.data()?.name as string) ?? name };
      }
    }

    // --- writes: 사전 생성 id로 카테고리 + boardId를 원자적으로 set(동시 호출은 재시도가 기존 id를 집음) ---
    const newRef = adminDb.collection('categories').doc();
    tx.set(newRef, { name, order: Date.now(), createdAt: Date.now(), teacherUid });
    tx.set(teacherRef, { boardId: newRef.id }, { merge: true });
    return { boardId: newRef.id, boardName: name };
  });
}
