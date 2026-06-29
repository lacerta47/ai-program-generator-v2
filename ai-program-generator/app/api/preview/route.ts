import { NextRequest, NextResponse } from 'next/server';
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
  const { html, css, javascript, photo } = (body ?? {}) as Record<string, unknown>;
  for (const part of [html, css, javascript]) {
    if (typeof part !== 'string') {
      return NextResponse.json({ error: 'html/css/javascript 문자열이 필요합니다.' }, { status: 400 });
    }
    if (part.length > MAX_PART) {
      return NextResponse.json({ error: '코드가 너무 큽니다.' }, { status: 413 });
    }
  }
  if (typeof photo === 'string' && photo.length > 400000) {
    return NextResponse.json({ error: '사진이 너무 커요.' }, { status: 413 });
  }
  // 토큰 코드 + 사진을 그대로 저장한다. __PHOTO__ 치환·doc 빌드는 서빙(getPreview) 시점에 일어나
  // N회 참조여도 저장 문서가 1MB를 넘지 않는다. 위의 길이 캡(MAX_PART·photo)이 저장 크기를 보장.
  const id = await putPreview(
    { html: html as string, css: css as string, javascript: javascript as string },
    typeof photo === 'string' ? photo : undefined,
  );
  return NextResponse.json({ id });
}
