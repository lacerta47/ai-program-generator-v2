import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { postId } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* 본문 없으면 무시(=dismiss) */
  }
  const deletePost = (body as { deletePost?: unknown })?.deletePost === true;

  try {
    const stuSnap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
    const studentUids = new Set(stuSnap.docs.map((d) => d.id));

    const repSnap = await adminDb.collection('reports').where('postId', '==', postId).get();
    if (repSnap.empty) return NextResponse.json({ error: '신고를 찾을 수 없어요.' }, { status: 404 });
    // report의 postOwnerUid가 내 학생인지로 권한 판정(인박스 범위의 source of truth)
    const mine = repSnap.docs.some((d) => studentUids.has(d.data().postOwnerUid as string));
    if (!mine) return NextResponse.json({ error: '우리 반 신고가 아니에요.' }, { status: 403 });

    if (deletePost) {
      await adminDb.doc(`posts/${postId}`).delete();
    }
    for (let i = 0; i < repSnap.docs.length; i += 450) {
      const batch = adminDb.batch();
      repSnap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('교사 신고 처리 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}
