import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  try {
    const postRef = adminDb.doc(`posts/${id}`);
    const pSnap = await postRef.get();
    if (!pSnap.exists) return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    const board = await ensureTeacherBoard(gate.uid);
    if (pSnap.data()?.categoryId !== board.boardId) {
      return NextResponse.json({ error: '우리 반 게시판 글이 아니에요.' }, { status: 403 });
    }
    // 글+신고를 한 batch로 원자 삭제(글만 지워지고 신고가 남는 고아 방지). 신고 ≤449면 완전 원자.
    const reps = await adminDb.collection('reports').where('postId', '==', id).get();
    for (let i = 0; i < Math.max(1, reps.docs.length); i += 449) {
      const batch = adminDb.batch();
      if (i === 0) batch.delete(postRef);
      reps.docs.slice(i, i + 449).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('우리 반 글 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
