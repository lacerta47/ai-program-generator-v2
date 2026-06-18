import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredPreviews } from '@/lib/preview-store';

// 만료된 previews 정리 — Vercel Cron이 매일 호출(vercel.json). CRON_SECRET으로 보호.
// Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동으로 붙인다.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // 시크릿 미설정 = 보호 불가 → 안전하게 거부(우발적 무방비 노출 방지)
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const deleted = await deleteExpiredPreviews();
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    console.error('[/api/cron/cleanup-previews] 실패:', e);
    return NextResponse.json({ error: '정리에 실패했어요.' }, { status: 500 });
  }
}
