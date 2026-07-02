import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { deletePostSubcollections } from '@/lib/server/deletePost';

export const runtime = 'nodejs';

// 글 삭제(본인 또는 관리자) — 글과 함께 그 글의 신고(reports)도 캐스케이드 삭제한다.
// 클라 직접삭제(deleteDoc)는 reports를 못 지워 고아가 쌓이므로(reports delete는 admin 전용),
// 삭제를 서버로 일원화한다. 교사 보드삭제·관리자 계정삭제 캐스케이드와 동일 정책.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  let uid: string;
  let isAdmin = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const postRef = adminDb.doc(`posts/${id}`);
    const snap = await postRef.get();
    if (!snap.exists) return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    if (!isAdmin && snap.data()?.ownerUid !== uid) {
      return NextResponse.json({ error: '내 작품만 지울 수 있어요.' }, { status: 403 });
    }
    // 카운터 서브컬렉션(likes·views)을 먼저 비운다 — 글을 지워도 서브컬렉션은 자동삭제 안 돼 고아로 남음(#3).
    // 글 삭제 전에 지우므로, 중간 실패해도 글이 남아 재시도 가능(고아 악화 없음).
    await deletePostSubcollections(postRef);
    // 글+신고를 한 batch로 원자 삭제 — 글만 지워지고 신고가 남는 고아 방지(중간 크래시 창 제거).
    // batch 500-op 한도: 신고 ≤449면 글까지 한 배치로 완전 원자, 초과분만 후속 배치.
    const reps = await adminDb.collection('reports').where('postId', '==', id).get();
    for (let i = 0; i < Math.max(1, reps.docs.length); i += 449) {
      const batch = adminDb.batch();
      if (i === 0) batch.delete(postRef);
      reps.docs.slice(i, i + 449).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/posts/[id]] 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
