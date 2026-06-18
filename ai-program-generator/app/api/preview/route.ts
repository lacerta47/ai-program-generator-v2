import { NextRequest, NextResponse } from 'next/server';
import { buildPreviewDoc } from '@/lib/program';
import { putPreview } from '@/lib/preview-store';
import { adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

const MAX_PART = 150000; // firestore.rules 의 게시물 코드 한도와 동일

/**
 * 즉석 생성 코드를 임시 저장하고 미리보기 id를 돌려준다.
 * 게시된 작품은 쓰기 없는 GET /api/preview/post/[id]를 쓰고, 이 POST는 "아직 미게시인 즉석 코드"용.
 * /api/generate처럼 로그인(Firebase ID 토큰) 필수 — 무인증 쓰기로 임의 문서 저장되는 벡터 차단.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON이 아닙니다.' }, { status: 400 });
  }
  const { html, css, javascript } = (body ?? {}) as Record<string, unknown>;
  for (const part of [html, css, javascript]) {
    if (typeof part !== 'string') {
      return NextResponse.json({ error: 'html/css/javascript 문자열이 필요합니다.' }, { status: 400 });
    }
    if (part.length > MAX_PART) {
      return NextResponse.json({ error: '코드가 너무 큽니다.' }, { status: 413 });
    }
  }
  const doc = buildPreviewDoc({
    html: html as string,
    css: css as string,
    javascript: javascript as string,
  });
  const id = await putPreview(doc);
  return NextResponse.json({ id });
}
