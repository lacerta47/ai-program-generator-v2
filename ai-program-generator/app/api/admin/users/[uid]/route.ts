import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { setUserLimit, clearUserLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

/** 대상이 관리자면 정지·삭제 거부(403). 일반 계정이면 null. */
async function blockIfAdminTarget(uid: string): Promise<NextResponse | null> {
  const target = await adminAuth.getUser(uid);
  if (target.customClaims?.admin === true) {
    return NextResponse.json({ error: '관리자 계정은 정지·삭제할 수 없어요.' }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as { disabled?: unknown; dailyLimit?: unknown; password?: unknown };

  try {
    if (typeof b.disabled === 'boolean') {
      const blocked = await blockIfAdminTarget(uid);
      if (blocked) return blocked;
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    if ('dailyLimit' in b) {
      if (b.dailyLimit === null) {
        await clearUserLimit(uid);
      } else if (typeof b.dailyLimit === 'number' && Number.isInteger(b.dailyLimit) && b.dailyLimit >= 0) {
        await setUserLimit(uid, b.dailyLimit);
      } else {
        return NextResponse.json({ error: '한도는 0 이상의 정수 또는 null이어야 해요.' }, { status: 400 });
      }
    }
    if ('password' in b) {
      if (typeof b.password !== 'string' || b.password.length < 6) {
        return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
      }
      // 수업용 계정(@class.kr)만 직접 재설정 — 관리자·가입 회원(실제 이메일)은 불가(본인 재설정 메일로).
      const target = await adminAuth.getUser(uid);
      if (target.customClaims?.admin === true || !(target.email ?? '').endsWith('@class.kr')) {
        return NextResponse.json(
          { error: '이 계정은 비밀번호를 직접 바꿀 수 없어요. (수업용 계정만 가능)' },
          { status: 403 },
        );
      }
      await adminAuth.updateUser(uid, { password: b.password });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('사용자 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  try {
    const blocked = await blockIfAdminTarget(uid);
    if (blocked) return blocked;

    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('계정 삭제 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
