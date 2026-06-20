import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const PREFIX_RE = /^[a-z0-9-]+$/;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  const snap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
  const students = await Promise.all(
    snap.docs.map(async (d) => {
      const s = d.data();
      let email: string | null = null;
      let disabled = false;
      try {
        const u = await adminAuth.getUser(d.id);
        email = u.email ?? null;
        disabled = u.disabled;
      } catch {
        /* Auth 계정이 사라진 고아 문서 — email null */
      }
      return {
        uid: d.id,
        email,
        name: (s.name as string) ?? '',
        limitType: (s.limitType as string) === 'total' ? 'total' : 'daily',
        limitValue: (s.limitValue as number) ?? 0,
        usedTotal: (s.usedTotal as number) ?? 0,
        disabled,
      };
    }),
  );
  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const prefix = typeof b.prefix === 'string' ? b.prefix.trim() : '';
  const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
  const password = typeof b.password === 'string' ? b.password : '';
  const limitType = b.limitType === 'total' ? 'total' : 'daily';
  const limitValue = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;

  if (!PREFIX_RE.test(prefix)) {
    return NextResponse.json({ error: "반 이름은 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
  }
  if (count < 1 || count > 50) {
    return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!Number.isInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
  }

  const created: { email: string; password: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const name = `${prefix}-${pad2(i)}`;
    const email = `${name}@${DOMAIN}`;
    try {
      const user = await adminAuth.createUser({ email, password });
      await adminAuth.setCustomUserClaims(user.uid, { student: true });
      await adminDb.doc(`students/${user.uid}`).set({
        teacherUid: gate.uid,
        name,
        limitType,
        limitValue,
        usedTotal: 0,
        createdAt: Date.now(),
      });
      created.push({ email, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      skipped.push({ email, reason: code === 'auth/email-already-exists' ? '이미 있는 아이디' : '생성 실패' });
    }
  }
  return NextResponse.json({ created, skipped });
}
