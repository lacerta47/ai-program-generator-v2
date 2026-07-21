import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { randomPlan } from '@/lib/examples/randomPlan';
import { generateExampleOnce } from '@/lib/examples/generateExampleOnce';
import { publishExample } from '@/lib/examples/publishExample';
import { UserFacingError } from '@/lib/ai/errors';

// 놀고 있는 Gemini 무료 한도로 예시 작품을 교육테스트 보드에 생성·게시. CRON_SECRET Bearer(daily-stats 동일).
// 한 요청은 소량(MAX_PER_RUN)만 — Vercel 함수 시간제한(maxDuration). 트리거(Claude 루틴)가 exhausted까지 반복 호출.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PER_RUN = 3;

async function findExampleCategoryId(): Promise<string | null> {
  const configured = process.env.EXAMPLE_CATEGORY_ID;
  if (configured) return configured;
  const snap = await adminDb.collection('categories').where('name', '==', '교육테스트').limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** 무료 소진(429/UserFacingError) 여부 — true면 그날 종료. */
function isExhausted(e: unknown): boolean {
  if (e instanceof UserFacingError) return true;
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
  for (let i = 0; i < MAX_PER_RUN; i++) {
    try {
      const rp = randomPlan();
      const { code, meta } = await generateExampleOnce(rp.prompt);
      await publishExample(categoryId, rp, code, meta);
      made++;
    } catch (e) {
      if (isExhausted(e)) {
        exhausted = true;
        break;
      }
      console.error('[generate-examples] 한 건 실패(스킵):', e); // 검열/파싱/일시오류
    }
  }
  return NextResponse.json({ made, exhausted });
}
