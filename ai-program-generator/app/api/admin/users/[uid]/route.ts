import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
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
  if (gate) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = body as { disabled?: unknown; dailyLimit?: unknown };

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
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('사용자 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  try {
    const blocked = await blockIfAdminTarget(uid);
    if (blocked) return blocked;

    // 1) Firestore 먼저 (중간 실패 시 고아 닉네임 방지 — Auth는 마지막)
    const refs: FirebaseFirestore.DocumentReference[] = [];
    const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
    posts.forEach((d) => refs.push(d.ref));
    const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
    nicks.forEach((d) => refs.push(d.ref));
    refs.push(adminDb.doc(`users/${uid}`));
    refs.push(adminDb.doc(`limits/${uid}`));
    for (let i = 0; i < refs.length; i += 450) {
      const batch = adminDb.batch();
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }

    // 2) Auth 마지막
    await adminAuth.deleteUser(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('계정 삭제 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
