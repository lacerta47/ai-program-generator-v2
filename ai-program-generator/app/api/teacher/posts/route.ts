import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const board = await ensureTeacherBoard(gate.uid);
    const snap = await adminDb
      .collection('posts')
      .where('categoryId', '==', board.boardId)
      .orderBy('createdAt', 'desc')
      .get();
    const posts = snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id,
        title: (p.title as string) ?? '',
        authorName: (p.authorName as string) ?? '',
        createdAt: (p.createdAt as number) ?? 0,
      };
    });
    return NextResponse.json({ board: { id: board.boardId, name: board.boardName }, posts });
  } catch (e) {
    console.error('우리 반 게시판 조회 실패:', e);
    return NextResponse.json({ error: '게시판을 불러오지 못했어요.' }, { status: 500 });
  }
}
