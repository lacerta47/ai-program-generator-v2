import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';
import { readEffectiveLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

  let uid: string;
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  if (isAdmin) {
    return NextResponse.json({ used: 0, limit: null, unlimited: true });
  }

  try {
    const day = todayKeyKST();
    const snap = await adminDb.collection('usage').doc(`${uid}_${day}`).get();
    const used = (snap.data()?.count as number | undefined) ?? 0;
    const limit = await readEffectiveLimit(uid);
    return NextResponse.json({ used, limit, unlimited: false });
  } catch (e) {
    console.error('내 사용량 조회 실패:', e);
    return NextResponse.json({ error: '사용량을 불러오지 못했어요.' }, { status: 500 });
  }
}
