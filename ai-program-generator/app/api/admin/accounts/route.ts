import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const PREFIX_RE = /^[a-z0-9-]+$/;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  let emails: string[];
  let password: string;

  if (b.mode === 'single') {
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    password = typeof b.password === 'string' ? b.password : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '이메일을 올바르게 입력해 주세요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
    }
    emails = [email];
  } else if (b.mode === 'batch') {
    const prefix = typeof b.prefix === 'string' ? b.prefix.trim() : '';
    const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
    password = typeof b.password === 'string' ? b.password : '';
    if (!PREFIX_RE.test(prefix)) {
      return NextResponse.json({ error: "반 이름은 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
    }
    if (count < 1 || count > 50) {
      return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
    }
    emails = Array.from({ length: count }, (_, i) => `${prefix}-${pad2(i + 1)}@${DOMAIN}`);
  } else {
    return NextResponse.json({ error: "mode는 'single' 또는 'batch' 여야 해요." }, { status: 400 });
  }

  const created: { email: string; password: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  for (const email of emails) {
    try {
      await adminAuth.createUser({ email, password });
      created.push({ email, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      const reason =
        code === 'auth/email-already-exists'
          ? '이미 있는 아이디'
          : (e as Error).message || '생성 실패';
      skipped.push({ email, reason });
    }
  }

  return NextResponse.json({ created, skipped });
}
