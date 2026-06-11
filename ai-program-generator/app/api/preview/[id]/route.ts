import { NextRequest } from 'next/server';
import { getPreview } from '@/lib/preview-store';

export const runtime = 'nodejs';

/** 저장된 미리보기 문서를 HTML로 서빙. iframe(sandbox) 안에서만 쓰인다. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getPreview(id);
  if (!doc) {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기가 만료됐어요. 다시 생성하거나 새로고침해 주세요.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  return new Response(doc, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
