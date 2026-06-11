import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import type { GenerateMode } from '@/lib/ai/types';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

// AI 호출은 반드시 서버에서만 실행한다(키 노출 방지).
export const runtime = 'nodejs';

// 계정당 하루 생성 한도 (관리자는 무제한). env로 조정 가능.
const DAILY_LIMIT = Number(process.env.GEN_DAILY_LIMIT) || 30;

function isMode(v: unknown): v is GenerateMode {
  return v === 'generate' || v === 'modify';
}

/** 한국 시간 기준 오늘 날짜 키 (자정에 한도 리셋) */
function todayKeyKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  // 1) 로그인 검증 — Authorization: Bearer <Firebase ID 토큰>
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return NextResponse.json(
      { error: '로그인해야 프로그램을 만들 수 있어요.' },
      { status: 401 },
    );
  }

  let uid: string;
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
  } catch {
    return NextResponse.json(
      { error: '로그인이 만료됐어요. 다시 로그인해 주세요.' },
      { status: 401 },
    );
  }

  // 2) 계정별 일일 한도 (Firestore 트랜잭션 카운터, Admin SDK 전용 컬렉션)
  if (!isAdmin) {
    const day = todayKeyKST();
    const ref = adminDb.collection('usage').doc(`${uid}_${day}`);
    try {
      const allowed = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = (snap.data()?.count as number | undefined) ?? 0;
        if (count >= DAILY_LIMIT) return false;
        tx.set(ref, { uid, day, count: count + 1, updatedAt: Date.now() }, { merge: true });
        return true;
      });
      if (!allowed) {
        return NextResponse.json(
          {
            error: `오늘 만들 수 있는 횟수(${DAILY_LIMIT}번)를 모두 썼어요. 내일 다시 만들어 보세요!`,
          },
          { status: 429 },
        );
      }
    } catch (e) {
      console.error('[/api/generate] 사용량 확인 실패:', e);
      return NextResponse.json(
        { error: '사용량을 확인하지 못했어요. 잠시 후 다시 해주세요.' },
        { status: 500 },
      );
    }
  }

  // 3) 입력 검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  const { prompt, system, mode } = (body ?? {}) as {
    prompt?: unknown;
    system?: unknown;
    mode?: unknown;
  };

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt(문자열)가 필요합니다.' }, { status: 400 });
  }
  if (prompt.length > 200000) {
    return NextResponse.json({ error: '계획서가 너무 길어요.' }, { status: 400 });
  }
  if (!isMode(mode)) {
    return NextResponse.json(
      { error: "mode는 'generate' 또는 'modify' 여야 합니다." },
      { status: 400 },
    );
  }

  const systemPrompt =
    typeof system === 'string' && system.trim() ? system : DEFAULT_SYSTEM_PROMPT;

  // 4) 생성
  try {
    const provider = getAIProvider();
    const code = await provider.generate({ prompt, system: systemPrompt, mode });
    return NextResponse.json(code);
  } catch (e) {
    console.error('[/api/generate] 실패:', e);
    return NextResponse.json(
      { error: 'AI 생성에 실패했습니다.', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
