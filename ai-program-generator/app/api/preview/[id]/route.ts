import { NextRequest } from 'next/server';
import { getPreview } from '@/lib/preview-store';

export const runtime = 'nodejs';

// 미리보기 문서를 직접(top-level) 탐색하면 앱 오리진에서 스크립트가 실행돼
// localStorage/IndexedDB의 인증 토큰을 털릴 수 있다. 두 겹으로 막는다:
//  1) CSP sandbox 헤더 — 직접 접근해도 브라우저가 opaque origin으로 강제 샌드박스
//     (Sec-Fetch-Dest 헤더가 없는 구형 브라우저에도 적용되는 근본 방어)
//  2) Sec-Fetch-Dest 검사 — iframe 임베드가 아닌 직접 탐색은 차단(친절한 안내)
const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Content-Security-Policy': 'sandbox allow-scripts',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // iframe 임베드(dest=iframe)가 아닌 직접 탐색(dest=document 등)은 거부
  const dest = req.headers.get('sec-fetch-dest');
  if (dest && dest !== 'iframe') {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기는 화면 안에서만 열 수 있어요.</p>',
      { status: 403, headers: SECURITY_HEADERS },
    );
  }

  const { id } = await params;
  const doc = await getPreview(id);
  if (!doc) {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기가 만료됐어요. 다시 생성하거나 새로고침해 주세요.</p>',
      { status: 404, headers: SECURITY_HEADERS },
    );
  }
  return new Response(doc, { headers: SECURITY_HEADERS });
}
