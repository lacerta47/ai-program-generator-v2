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
    const LIMIT = 50; // 모더레이션 콘솔 — 최근 글만. 과대 조회 방지(글 누적 시 성능).
    // boardTeacherUid==까지 함께 필터해 복합 인덱스 [categoryId, boardTeacherUid, createdAt]를 재사용한다.
    // (categoryId==만 두면 [categoryId, createdAt] 인덱스가 없어 FAILED_PRECONDITION→500. 이 보드 글은
    //  전부 boardTeacherUid==gate.uid라 결과는 동일하고 인덱스만 맞춰진다.)
    const snap = await adminDb
      .collection('posts')
      .where('categoryId', '==', board.boardId)
      .where('boardTeacherUid', '==', gate.uid)
      .orderBy('createdAt', 'desc')
      .limit(LIMIT)
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
    return NextResponse.json({
      board: { id: board.boardId, name: board.boardName },
      posts,
      limited: snap.size === LIMIT, // 더 있을 수 있음(최근 50개만 반환)
    });
  } catch (e) {
    console.error('우리 반 게시판 조회 실패:', e);
    return NextResponse.json({ error: '게시판을 불러오지 못했어요.' }, { status: 500 });
  }
}
