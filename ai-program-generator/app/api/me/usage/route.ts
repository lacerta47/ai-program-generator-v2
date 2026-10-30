import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';
import { readEffectiveTotalLimit, ROLE_DAILY_LIMIT } from '@/lib/admin/usageConfig';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

  let uid: string;
  let isAdmin = false;
  let isStudent = false;
  let isTeacher = false;
  try {
    const decoded = await verifyActiveToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
    isStudent = decoded.student === true;
    isTeacher = decoded.teacher === true;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  if (isStudent) {
    try {
      const sSnap = await adminDb.doc(`students/${uid}`).get();
      const s = sSnap.data() ?? {};
      const limit = (s.limitValue as number | undefined) ?? 0;
      if (s.limitType === 'total') {
        return NextResponse.json({ used: (s.usedTotal as number | undefined) ?? 0, limit, unlimited: false, kind: 'total' });
      }
      const day = todayKeyKST();
      const snap = await adminDb.collection('usage').doc(`${uid}_${day}`).get();
      return NextResponse.json({ used: (snap.data()?.count as number | undefined) ?? 0, limit, unlimited: false, kind: 'daily' });
    } catch (e) {
      console.error('학생 사용량 조회 실패:', e);
      return NextResponse.json({ error: '사용량을 불러오지 못했어요.' }, { status: 500 });
    }
  }

  try {
    const roleDaily = isAdmin || isTeacher;
    const snap = await adminDb.doc(roleDaily ? `usage/${uid}_${todayKeyKST()}` : `memberUsage/${uid}`).get();
    const used = (snap.data()?.count as number | undefined) ?? 0;
    const limit = roleDaily ? ROLE_DAILY_LIMIT : await readEffectiveTotalLimit(uid);
    return NextResponse.json({ used, limit, unlimited: false, kind: roleDaily ? 'daily' : 'total' });
  } catch (e) {
    console.error('내 사용량 조회 실패:', e);
    return NextResponse.json({ error: '사용량을 불러오지 못했어요.' }, { status: 500 });
  }
}
