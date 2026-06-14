import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/prompts';
import type { GenerateMode } from '@/lib/ai/types';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';
import { readEffectiveLimit } from '@/lib/admin/usageConfig';

// AI 호출은 반드시 서버에서만 실행한다(키 노출 방지).
export const runtime = 'nodejs';

function isMode(v: unknown): v is GenerateMode {
  return v === 'generate' || v === 'modify';
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

  // 2) 입력 검증 (한도 차감 전에 — 잘못된 요청이 횟수를 소모하지 않도록)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  // system 은 클라이언트가 보내도 무시한다 — 안전 프롬프트(sandbox 제약 등)를 우회하지 못하게.
  const { prompt, mode } = (body ?? {}) as { prompt?: unknown; mode?: unknown };

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

  // 3) 한도 선점 (트랜잭션). 생성이 실패하면 4)에서 환불한다.
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  if (!isAdmin) {
    const dailyLimit = await readEffectiveLimit(uid);
    try {
      const allowed = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const count = (snap.data()?.count as number | undefined) ?? 0;
        if (count >= dailyLimit) return false;
        tx.set(usageRef, { uid, day, count: count + 1, updatedAt: Date.now() }, { merge: true });
        return true;
      });
      if (!allowed) {
        return NextResponse.json(
          { error: `오늘 만들 수 있는 횟수(${dailyLimit}번)를 모두 썼어요. 내일 다시 만들어 보세요!` },
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

  // 4) 생성 — 실패 시 선점한 한도를 환불
  try {
    const provider = getAIProvider();
    const code = await provider.generate({ prompt, system: DEFAULT_SYSTEM_PROMPT, mode });
    return NextResponse.json(code);
  } catch (e) {
    console.error('[/api/generate] 실패:', e);
    if (!isAdmin) {
      await refundQuota(usageRef);
    }
    return NextResponse.json(
      { error: 'AI 생성에 실패했습니다.', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

/** 생성 실패 시 선점했던 한도 1회를 되돌린다(0 미만으로는 안 내려감). */
async function refundQuota(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      if (count > 0) tx.update(ref, { count: count - 1, updatedAt: Date.now() });
    });
  } catch (e) {
    console.error('[/api/generate] 한도 환불 실패:', e);
  }
}
