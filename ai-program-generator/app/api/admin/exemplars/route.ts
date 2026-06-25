import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  getExemplar,
  setExemplarFromPost,
  clearExemplar,
  listExemplarCandidates,
  type ExemplarVariant,
} from '@/lib/admin/exemplars';

export const runtime = 'nodejs';

function isVariant(v: unknown): v is ExemplarVariant {
  return v === 'default' || v === 'survey';
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const [def, survey, candidates] = await Promise.all([
    getExemplar('default'),
    getExemplar('survey'),
    listExemplarCandidates(),
  ]);
  return NextResponse.json({ slots: { default: def, survey }, candidates });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const { sourcePostId, variant } = (body ?? {}) as { sourcePostId?: unknown; variant?: unknown };
  if (typeof sourcePostId !== 'string' || !sourcePostId) {
    return NextResponse.json({ error: 'sourcePostId가 필요해요.' }, { status: 400 });
  }
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  try {
    const exemplar = await setExemplarFromPost(sourcePostId, variant, gate.uid);
    return NextResponse.json({ ok: true, exemplar });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    if (code === 'POST_NOT_FOUND')
      return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    if (code === 'POST_HAS_NO_PLAN')
      return NextResponse.json({ error: '이 글에는 계획서가 없어 예시로 쓸 수 없어요.' }, { status: 400 });
    if (code === 'POST_HAS_NO_CODE')
      return NextResponse.json({ error: '이 글에는 코드가 없어요.' }, { status: 400 });
    console.error('exemplar 지정 실패:', e);
    return NextResponse.json({ error: '예시 지정에 실패했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const variant = new URL(req.url).searchParams.get('variant');
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  await clearExemplar(variant);
  return NextResponse.json({ ok: true });
}
