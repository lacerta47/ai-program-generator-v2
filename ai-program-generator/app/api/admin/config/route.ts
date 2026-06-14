import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { readDailyLimit, writeDailyLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  return NextResponse.json({ dailyLimit: await readDailyLimit() });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const v = (body as { dailyLimit?: unknown })?.dailyLimit;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    return NextResponse.json({ error: '한도는 0 이상의 정수여야 해요.' }, { status: 400 });
  }
  await writeDailyLimit(v);
  return NextResponse.json({ dailyLimit: v });
}
