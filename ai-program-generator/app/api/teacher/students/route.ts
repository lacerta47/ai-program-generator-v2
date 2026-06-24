import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  const snap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
  const docs = snap.docs;
  const uids = docs.map((d) => d.id);
  const recById = new Map<string, import('firebase-admin/auth').UserRecord>();
  for (let i = 0; i < uids.length; i += 100) {
    const res = await adminAuth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    res.users.forEach((u) => recById.set(u.uid, u));
  }
  const students = docs.map((d) => {
    const s = d.data();
    const u = recById.get(d.id);
    return {
      uid: d.id,
      email: u?.email ?? null,
      name: (s.name as string) ?? '',
      limitType: (s.limitType as string) === 'total' ? 'total' : 'daily',
      limitValue: (s.limitValue as number) ?? 0,
      usedTotal: (s.usedTotal as number) ?? 0,
      disabled: u?.disabled ?? false,
    };
  });
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
  const grade = typeof b.grade === 'number' ? Math.floor(b.grade) : NaN;
  const classNo = typeof b.classNo === 'number' ? Math.floor(b.classNo) : NaN;
  const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
  const password = typeof b.password === 'string' ? b.password : '';
  const limitType = b.limitType === 'total' ? 'total' : 'daily';
  const limitValue = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;

  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    return NextResponse.json({ error: '학년은 1~6이에요.' }, { status: 400 });
  }
  if (!Number.isInteger(classNo) || classNo < 1 || classNo > 99) {
    return NextResponse.json({ error: '반은 1~99예요.' }, { status: 400 });
  }
  if (count < 1 || count > 50) {
    return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'PIN은 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!Number.isInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
  }

  const tDoc = await adminDb.doc(`teachers/${gate.uid}`).get();
  const schoolCode = (tDoc.data()?.schoolCode as string) ?? '';
  if (!schoolCode) {
    return NextResponse.json({ error: '학교 정보가 없어요. 관리자에게 문의해 주세요.' }, { status: 400 });
  }

  const created: { email: string; hakbun: string; password: string }[] = [];
  const skipped: { hakbun: string; reason: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const hakbun = `${grade}${pad2(classNo)}${pad2(i)}`;
    const email = `${schoolCode}-${hakbun}@${DOMAIN}`;
    try {
      const user = await adminAuth.createUser({ email, password });
      await adminAuth.setCustomUserClaims(user.uid, { student: true });
      await adminDb.doc(`students/${user.uid}`).set({
        teacherUid: gate.uid,
        schoolCode,
        hakbun,
        name: hakbun,
        limitType,
        limitValue,
        usedTotal: 0,
        createdAt: Date.now(),
      });
      created.push({ email, hakbun, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      skipped.push({ hakbun, reason: code === 'auth/email-already-exists' ? '이미 있는 학번' : '생성 실패' });
    }
  }
  return NextResponse.json({ created, skipped, schoolCode });
}
