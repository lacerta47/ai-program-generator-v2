import { NextRequest, NextResponse } from 'next/server';
import { buildPreviewDoc } from '@/lib/program';
import { putPreview } from '@/lib/preview-store';

export const runtime = 'nodejs';

const MAX_PART = 150000; // firestore.rules 의 게시물 코드 한도와 동일

/** 생성 코드를 임시 저장하고 미리보기 id를 돌려준다. (게시판은 비로그인 열람 허용이라 인증 없음) */
export async function POST(req: NextRequest) {
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
