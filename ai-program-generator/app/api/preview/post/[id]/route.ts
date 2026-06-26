import { NextRequest } from 'next/server';
import { buildPreviewDoc } from '@/lib/program';
import { adminDb } from '@/lib/firebase/admin';
import type { GeneratedCode } from '@/lib/ai/types';

export const runtime = 'nodejs';

// 게시된 작품 미리보기 — 이미 "공개 읽기"인 posts/{id}.code 를 서버가 직접 읽어 서빙한다.
// (Firestore 쓰기 0 → /api/preview POST 의 무인증 쓰기 벡터를 게시판 경로에서 제거)
// 보안 헤더/직접탐색 차단은 즉석코드 미리보기(/api/preview/[id])와 동일.
const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Content-Security-Policy': 'sandbox allow-scripts',
};

function isCode(v: unknown): v is GeneratedCode {
  const c = v as Record<string, unknown> | null;
  return !!c && typeof c.html === 'string' && typeof c.css === 'string' && typeof c.javascript === 'string';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // iframe 임베드(dest=iframe)가 아닌 직접 탐색은 거부 (토큰 탈취 방지 — /api/preview/[id]와 동일)
  const dest = req.headers.get('sec-fetch-dest');
  if (dest && dest !== 'iframe') {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기는 화면 안에서만 열 수 있어요.</p>',
      { status: 403, headers: SECURITY_HEADERS },
    );
  }

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기를 찾을 수 없어요.</p>',
      { status: 404, headers: SECURITY_HEADERS },
    );
  }

  let code: GeneratedCode | null = null;
  try {
    const snap = await adminDb.collection('posts').doc(id).get();
    const data = snap.data();
    if (snap.exists && data && data.boardTeacherUid) {
      // 교실 글은 공개 GET으로 서빙하지 않는다(누출 차단). 멤버는 POST /api/preview 경로로.
      return new Response(
        '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기를 찾을 수 없어요.</p>',
        { status: 404, headers: SECURITY_HEADERS },
      );
    }
    if (snap.exists && isCode(data?.code)) code = data!.code as GeneratedCode;
  } catch (e) {
    console.error('[/api/preview/post/[id]] 조회 실패:', e);
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기를 불러오지 못했어요.</p>',
      { status: 500, headers: SECURITY_HEADERS },
    );
  }

  if (!code) {
    return new Response(
      '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기를 찾을 수 없어요.</p>',
      { status: 404, headers: SECURITY_HEADERS },
    );
  }
  return new Response(buildPreviewDoc(code), { headers: SECURITY_HEADERS });
}
