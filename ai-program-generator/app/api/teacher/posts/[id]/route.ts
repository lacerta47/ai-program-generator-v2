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
    await postRef.delete();
    // 그 글의 신고도 함께 정리(유령 미처리 신고 카운트 방지). 관리자 글삭제와 동일한 청소.
    const reps = await adminDb.collection('reports').where('postId', '==', id).get();
    for (let i = 0; i < reps.docs.length; i += 450) {
      const batch = adminDb.batch();
      reps.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('우리 반 글 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
