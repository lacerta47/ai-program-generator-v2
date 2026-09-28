import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  listExemplarSlots,
  setExemplarFromPost,
  clearExemplar,
  listExemplarCandidates,
  isProgramTypeId,
  type ExemplarVariant,
} from '@/lib/admin/exemplars';

export const runtime = 'nodejs';

function isVariant(v: unknown): v is ExemplarVariant {
  return v === 'default' || v === 'survey';
}

/** programType은 survey에서만 허용, PROGRAM_TYPES id여야 함. 없으면 undefined(공통 슬롯). 잘못되면 null. */
function parseProgramType(variant: ExemplarVariant, v: unknown): string | undefined | null {
  if (v === undefined || v === null || v === '') return undefined;
  if (variant !== 'survey') return null;
  return isProgramTypeId(v) ? v : null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const [slots, candidates] = await Promise.all([listExemplarSlots(), listExemplarCandidates()]);
  return NextResponse.json({ slots, candidates });
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
  const { sourcePostId, variant, programType } = (body ?? {}) as {
    sourcePostId?: unknown;
    variant?: unknown;
    programType?: unknown;
  };
  if (typeof sourcePostId !== 'string' || !sourcePostId.trim()) {
    return NextResponse.json({ error: 'sourcePostId가 필요해요.' }, { status: 400 });
  }
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  const type = parseProgramType(variant, programType);
  if (type === null) {
    return NextResponse.json({ error: 'programType은 선택지(survey)에서만, 정해진 유형 id로만 쓸 수 있어요.' }, { status: 400 });
  }
  try {
    const exemplar = await setExemplarFromPost(sourcePostId.trim(), variant, gate.uid, type);
    return NextResponse.json({ ok: true, exemplar });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    if (code === 'POST_NOT_FOUND')
      return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    if (code === 'POST_HAS_NO_PLAN')
      return NextResponse.json({ error: '이 글에는 계획서가 없어 예시로 쓸 수 없어요.' }, { status: 400 });
    if (code === 'POST_HAS_NO_CODE')
      return NextResponse.json({ error: '이 글에는 코드가 없어요.' }, { status: 400 });
    if (code.startsWith('POST_CODE_INVALID:'))
      return NextResponse.json({ error: `코드 검증을 통과하지 못한 작품이에요. ${code.slice('POST_CODE_INVALID:'.length)}` }, { status: 400 });
    console.error('exemplar 지정 실패:', e);
    return NextResponse.json({ error: '예시 지정에 실패했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const sp = new URL(req.url).searchParams;
  const variant = sp.get('variant');
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  const type = parseProgramType(variant, sp.get('programType'));
  if (type === null) {
    return NextResponse.json({ error: 'programType이 올바르지 않아요.' }, { status: 400 });
  }
  await clearExemplar(variant, type);
  return NextResponse.json({ ok: true });
}
