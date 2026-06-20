import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

// 본인 계정 탈퇴: 본인 ID 토큰으로 uid 확인 후 모든 흔적 삭제. 관리자 계정은 거부.
export async function DELETE(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.admin === true || decoded.teacher === true) {
      return NextResponse.json({ error: '관리자·선생님 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('회원 탈퇴 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
