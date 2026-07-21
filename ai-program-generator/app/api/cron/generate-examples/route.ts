import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { randomPlan } from '@/lib/examples/randomPlan';
import { generateExampleOnce } from '@/lib/examples/generateExampleOnce';
import { publishExample } from '@/lib/examples/publishExample';
import { QuotaExhaustedError } from '@/lib/ai/errors';

// 놀고 있는 Gemini 무료 한도로 예시 작품을 교육테스트 보드에 생성·게시. CRON_SECRET Bearer(daily-stats 동일).
// 한 요청은 소량만 — Vercel 함수 시간제한(maxDuration=60s 하드 캡). 트리거(Claude 루틴)가 exhausted까지 반복 호출.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 한 호출이 만들 최대 개수(상한). 실제로는 아래 시간 예산이 먼저 끊는 게 정상.
const MAX_PER_RUN = 3;
// 전체 루프 시간 예산 — maxDuration(60s)보다 짧게 잡아 콜드스타트·응답 직렬화 여유를 남긴다.
// 생성이 순차라 3건이면 60s를 넘길 수 있어(각 15~40s) 504가 났음 → 시간으로 하드 바운드.
const RUN_BUDGET_MS = 52_000;
// 남은 예산이 이보다 적으면 새 생성을 시작하지 않는다(시작한 생성이 캡을 못 넘게).
const MIN_GEN_MS = 8_000;

async function findExampleCategoryId(): Promise<string | null> {
  const configured = process.env.EXAMPLE_CATEGORY_ID;
  if (configured) return configured;
  const snap = await adminDb.collection('categories').where('name', '==', '교육테스트').limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** 무료 소진(429/QuotaExhaustedError) 여부 — true면 그날 종료. */
function isExhausted(e: unknown): boolean {
  if (e instanceof QuotaExhaustedError) return true;
  const msg = String((e as { message?: string })?.message ?? e);
  const status = (e as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const categoryId = await findExampleCategoryId();
  if (!categoryId) {
    console.error("[generate-examples] '교육테스트' 카테고리를 찾지 못함");
    return NextResponse.json({ made: 0, exhausted: true, error: 'category-not-found' });
  }

  let made = 0;
  let exhausted = false;
  const startedAt = Date.now();
  for (let i = 0; i < MAX_PER_RUN; i++) {
    // 남은 예산이 부족하면 이번 호출은 여기서 종료(다음 호출로 이어감). 정상 200 응답.
    const remaining = RUN_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_GEN_MS) break;
    try {
      const rp = randomPlan();
      // 개별 생성에 잔여 예산만큼의 상한 — hang/지연이 60s 캡을 넘겨 504 나는 걸 방지.
      const { code, meta } = await generateExampleOnce(rp.prompt, AbortSignal.timeout(remaining));
      await publishExample(categoryId, rp, code, meta);
      made++;
    } catch (e) {
      if (isExhausted(e)) {
        exhausted = true;
        break;
      }
      console.error('[generate-examples] 한 건 실패(스킵):', e); // 검열/파싱/abort/일시오류
    }
  }
  return NextResponse.json({ made, exhausted });
}
