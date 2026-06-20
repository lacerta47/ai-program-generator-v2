import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const LOGIN_RE = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  const teachers: { uid: string; email: string | null; name: string; totalQuota: number; disabled: boolean }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.customClaims?.teacher === true) {
        const doc = await adminDb.doc(`teachers/${u.uid}`).get();
        const d = doc.data() ?? {};
        teachers.push({
          uid: u.uid,
          email: u.email ?? null,
          name: (d.name as string) ?? '',
          totalQuota: (d.totalQuota as number) ?? 0,
          disabled: u.disabled,
        });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return NextResponse.json({ teachers });
}

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
  const loginId = typeof b.loginId === 'string' ? b.loginId.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const totalQuota = typeof b.totalQuota === 'number' ? Math.floor(b.totalQuota) : NaN;

  if (!LOGIN_RE.test(loginId)) {
    return NextResponse.json({ error: "아이디는 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!name || name.length > 20) {
    return NextResponse.json({ error: '표시명은 1~20자로 적어 주세요.' }, { status: 400 });
  }
  if (!Number.isInteger(totalQuota) || totalQuota < 0) {
    return NextResponse.json({ error: '총 한도는 0 이상의 정수여야 해요.' }, { status: 400 });
  }

  const email = `${loginId}@${DOMAIN}`;
  try {
    const user = await adminAuth.createUser({ email, password });
    await adminAuth.setCustomUserClaims(user.uid, { teacher: true });
    await adminDb.doc(`teachers/${user.uid}`).set({ name, totalQuota, createdAt: Date.now() });
    return NextResponse.json({ uid: user.uid, email, password });
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: '이미 있는 아이디예요.' }, { status: 409 });
    }
    console.error('선생님 생성 실패:', e);
    return NextResponse.json({ error: '선생님 계정을 만들지 못했어요.' }, { status: 500 });
  }
}
