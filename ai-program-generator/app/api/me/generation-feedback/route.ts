import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';
import { getSurveyStatuses, openSurvey } from '@/lib/server/surveyCompletion';

export const runtime = 'nodejs';

async function verifiedUid(req: NextRequest): Promise<string | NextResponse> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ') || header.length === 7) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  try {
    return (await verifyActiveToken(header.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: '다시 로그인해 주세요.' }, { status: 401 });
  }
}

export async function GET(req: NextRequest) {
  const uid = await verifiedUid(req);
  if (uid instanceof NextResponse) return uid;
  try {
    return NextResponse.json(await getSurveyStatuses(uid), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '설문 참여 상태를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifiedUid(req);
  if (uid instanceof NextResponse) return uid;

  const body = await req.json().catch(() => null);
  const { mode, answer, action = 'offer' } = (body ?? {}) as { mode?: unknown; answer?: unknown; action?: unknown };
  if ((mode !== 'create' && mode !== 'easy') || answer !== undefined || (action !== 'offer' && action !== 'open')) {
    return NextResponse.json({ error: '만들기 방식을 확인해 주세요.' }, { status: 400 });
  }

  if (action === 'open') {
    try {
      const url = await openSurvey(uid, mode);
      return url
        ? NextResponse.json({ url }, { headers: { 'Cache-Control': 'no-store' } })
        : NextResponse.json({ error: '이미 참여한 설문이에요. 답해 줘서 고마워요!' }, { status: 409 });
    } catch {
      return NextResponse.json({ error: '설문 제출 여부를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.' }, { status: 503 });
    }
  }

  try {
    const ref = adminDb.doc(`generationFeedback/${uid}`);
    const result = await adminDb.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).get(mode);
      if (current?.offeredAt || current?.completedAt) return { offer: false };
      // 한 계정에서 여러 탭이 동시에 요청해도 한 탭만 설문을 표시한다.
      tx.set(ref, { [mode]: { ...current, offeredAt: Date.now() } }, { merge: true });
      return { offer: true };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('만들기 설문 처리 실패:', error);
    return NextResponse.json({ error: '설문을 처리하지 못했어요. 다시 시도해 주세요.' }, { status: 500 });
  }
}
