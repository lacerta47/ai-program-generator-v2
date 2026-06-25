import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/** Bearer ID 토큰 + admin claim 검증. 통과면 { uid }, 아니면 401/403 NextResponse.
 *  (requireTeacher와 동일 형태 — 호출부는 `if (gate instanceof NextResponse) return gate`로 판정.) */
export async function requireAdmin(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.admin !== true) {
      return NextResponse.json({ error: '관리자만 할 수 있어요.' }, { status: 403 });
    }
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
}
