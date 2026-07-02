import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/** Bearer ID 토큰 + teacher claim 검증. 통과면 { uid }, 아니면 401/403 NextResponse. */
export async function requireTeacher(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    // 고권한 라우트(학생 계정 생성/삭제 캐스케이드·view-pin·글삭제)라 checkRevoked=true —
    // 비활성/권한해제된 교사 토큰을 즉시 무효화한다(미사용 시 ~1h 유효). 교사 라우트는 저트래픽.
    const decoded = await adminAuth.verifyIdToken(idToken, true);
    if (decoded.teacher !== true) {
      return NextResponse.json({ error: '선생님만 할 수 있어요.' }, { status: 403 });
    }
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
}
