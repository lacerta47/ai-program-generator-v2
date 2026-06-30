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

    // 권한 판정(방어심층): 살아있는 글이면 실제 주인(post.ownerUid)으로, 이미 삭제된 글(고아 신고 정리)이면
    // 신고의 postOwnerUid로 — 후자는 생성 시 규칙(postOwnerMatches)이 실제 글과 일치를 강제한 값이라 신뢰 가능.
    const pSnap = await adminDb.doc(`posts/${postId}`).get();
    const liveOwner = pSnap.exists ? (pSnap.data()?.ownerUid as string | undefined) : undefined;
    const mine = liveOwner
      ? studentUids.has(liveOwner)
      : repSnap.docs.some((d) => studentUids.has(d.data().postOwnerUid as string));
    if (!mine) return NextResponse.json({ error: '우리 반 신고가 아니에요.' }, { status: 403 });

    // 글(요청 시)+신고를 한 batch로 원자 삭제 — 글만 지워지고 신고가 남는 고아 방지.
    for (let i = 0; i < repSnap.docs.length; i += 449) {
      const batch = adminDb.batch();
      if (i === 0 && deletePost) batch.delete(adminDb.doc(`posts/${postId}`));
      repSnap.docs.slice(i, i + 449).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('교사 신고 처리 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}
