import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

/** 대상 학생이 caller 소속이 아니면 403. 맞으면 현재 문서 데이터. */
async function ownedStudent(callerUid: string, uid: string): Promise<FirebaseFirestore.DocumentData | NextResponse> {
  const snap = await adminDb.doc(`students/${uid}`).get();
  const data = snap.data();
  if (!snap.exists || !data || data.teacherUid !== callerUid) {
    return NextResponse.json({ error: '우리 반 학생이 아니에요.' }, { status: 403 });
  }
  return data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const current = await ownedStudent(gate.uid, uid);
  if (current instanceof NextResponse) return current;

  try {
    const patch: Record<string, unknown> = {};
    if (typeof b.name === 'string' && b.name.trim() && b.name.trim().length <= 20) {
      patch.name = b.name.trim();
    }
    if (b.limitType === 'daily' || b.limitType === 'total') {
      patch.limitType = b.limitType;
      // 한도 종류가 바뀌면 누적 캡 카운터를 초기화(이전 종류 소진분이 새 종류 캡에 안 걸리도록)
      if (b.limitType !== current.limitType) patch.usedTotal = 0;
    }
    if ('limitValue' in b) {
      const v = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;
      if (!Number.isInteger(v) || v < 1) {
        return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
      }
      patch.limitValue = v;
    }
    if (Object.keys(patch).length > 0) {
      await adminDb.doc(`students/${uid}`).set(patch, { merge: true });
    }
    if (typeof b.disabled === 'boolean') {
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('학생 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  const current = await ownedStudent(gate.uid, uid);
  if (current instanceof NextResponse) return current;

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('학생 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
