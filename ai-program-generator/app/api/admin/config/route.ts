import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { readTotalLimit, writeTotalLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ totalLimit: await readTotalLimit() });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const v = (body as { totalLimit?: unknown })?.totalLimit;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    return NextResponse.json({ error: '한도는 0 이상의 정수여야 해요.' }, { status: 400 });
  }
  await writeTotalLimit(v);
  return NextResponse.json({ totalLimit: v });
}
