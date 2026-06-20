import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.student !== true) {
      return NextResponse.json({ error: '학생만 쓸 수 있어요.' }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  try {
    const sSnap = await adminDb.doc(`students/${uid}`).get();
    const teacherUid = sSnap.data()?.teacherUid as string | undefined;
    if (!teacherUid) return NextResponse.json({ error: '반 정보를 찾을 수 없어요.' }, { status: 500 });
    const board = await ensureTeacherBoard(teacherUid);
    return NextResponse.json(board);
  } catch (e) {
    console.error('학생 게시판 조회 실패:', e);
    return NextResponse.json({ error: '게시판을 찾지 못했어요.' }, { status: 500 });
  }
}
