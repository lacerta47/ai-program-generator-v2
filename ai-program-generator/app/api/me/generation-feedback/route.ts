import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ') || header.length === 7) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyActiveToken(header.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: '다시 로그인해 주세요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { mode, answer } = (body ?? {}) as { mode?: unknown; answer?: unknown };
  if ((mode !== 'create' && mode !== 'easy') || answer !== undefined) {
    return NextResponse.json({ error: '만들기 방식을 확인해 주세요.' }, { status: 400 });
  }

  try {
    const ref = adminDb.doc(`generationFeedback/${uid}`);
    const result = await adminDb.runTransaction(async (tx) => {
      if ((await tx.get(ref)).get(mode)) return { offer: false };
      // 한 계정에서 여러 탭이 동시에 요청해도 한 탭만 설문을 표시한다.
      tx.set(ref, { [mode]: { offeredAt: Date.now() } }, { merge: true });
      return { offer: true };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('만들기 설문 처리 실패:', error);
    return NextResponse.json({ error: '설문을 처리하지 못했어요. 다시 시도해 주세요.' }, { status: 500 });
  }
}
