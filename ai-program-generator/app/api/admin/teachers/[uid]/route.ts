import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

/** 대상이 teacher claim 아니면 400, 없는 계정이면 404. 맞으면 null. */
async function ensureTeacher(uid: string): Promise<NextResponse | null> {
  try {
    const u = await adminAuth.getUser(uid);
    if (u.customClaims?.teacher !== true) {
      return NextResponse.json({ error: '선생님 계정이 아니에요.' }, { status: 400 });
    }
    return null;
  } catch (e) {
    if ((e as { code?: string }).code === 'auth/user-not-found') {
      return NextResponse.json({ error: '계정을 찾을 수 없어요.' }, { status: 404 });
    }
    console.error('선생님 확인 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const notTeacher = await ensureTeacher(uid);
  if (notTeacher) return notTeacher;

  try {
    if ('totalQuota' in b) {
      const q = typeof b.totalQuota === 'number' ? Math.floor(b.totalQuota) : NaN;
      if (!Number.isInteger(q) || q < 0) {
        return NextResponse.json({ error: '총 한도는 0 이상의 정수여야 해요.' }, { status: 400 });
      }
      await adminDb.doc(`teachers/${uid}`).set({ totalQuota: q }, { merge: true });
    }
    if (typeof b.disabled === 'boolean') {
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('선생님 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  const notTeacher = await ensureTeacher(uid);
  if (notTeacher) return notTeacher;

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('선생님 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
