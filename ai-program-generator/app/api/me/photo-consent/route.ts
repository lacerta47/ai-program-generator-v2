import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { PHOTO_CONSENT_VERSION } from '@/lib/server/photoConsent';
import { allowFixedWindow } from '@/lib/server/rateLimit';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  let uid: string;
  try {
    uid = (await verifyActiveToken(token)).uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
  try {
    if (!(await allowFixedWindow('photoConsentRate', uid, 10 * 60 * 1000, 20))) {
      return NextResponse.json({ error: '잠시 후 다시 해 주세요.' }, { status: 429 });
    }
    await adminDb.doc(`photoConsents/${uid}`).set({ policyVersion: PHOTO_CONSENT_VERSION, agreedAt: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('사진 동의 저장 실패:', error);
    return NextResponse.json({ error: '동의를 저장하지 못했어요. 다시 해 주세요.' }, { status: 500 });
  }
}
