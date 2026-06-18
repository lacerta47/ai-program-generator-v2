import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

// 카운터(좋아요·조회·포크)는 서버에서만 갱신한다(클라 직접 쓰기는 규칙으로 차단).
// 서브문서로 1인1회 dedup을 서버가 권위적으로 처리 → 임의 부풀리기 불가.
export const runtime = 'nodejs';

type Action = 'like' | 'view' | 'fork';
const isAction = (v: unknown): v is Action => v === 'like' || v === 'view' || v === 'fork';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // 로그인 검증
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const { action } = (body ?? {}) as { action?: unknown };
  if (!isAction(action)) {
    return NextResponse.json({ error: "action은 'like'|'view'|'fork' 여야 해요." }, { status: 400 });
  }

  const postRef = adminDb.collection('posts').doc(id);

  try {
    if (action === 'like') {
      // 토글: likes/{uid} 있으면 취소(-1), 없으면 추가(+1) — 서버가 상태를 권위적으로 판단
      const result = await adminDb.runTransaction(async (tx) => {
        const likeRef = postRef.collection('likes').doc(uid);
        const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
        if (!postSnap.exists) throw new Error('POST_NOT_FOUND');
        const cur = (postSnap.data()?.likeCount as number | undefined) ?? 0;
        if (likeSnap.exists) {
          const next = Math.max(0, cur - 1);
          tx.delete(likeRef);
          tx.update(postRef, { likeCount: next });
          return { liked: false, likeCount: next };
        }
        const next = cur + 1;
        tx.set(likeRef, { createdAt: Date.now() });
        tx.update(postRef, { likeCount: next });
        return { liked: true, likeCount: next };
      });
      return NextResponse.json(result);
    }

    if (action === 'view') {
      // 첫 조회만 +1(멱등). 이미 본 사용자면 그대로.
      const result = await adminDb.runTransaction(async (tx) => {
        const viewRef = postRef.collection('views').doc(uid);
        const [postSnap, viewSnap] = await Promise.all([tx.get(postRef), tx.get(viewRef)]);
        if (!postSnap.exists) throw new Error('POST_NOT_FOUND');
        const cur = (postSnap.data()?.viewCount as number | undefined) ?? 0;
        if (viewSnap.exists) return { counted: false, viewCount: cur };
        const next = cur + 1;
        tx.set(viewRef, { createdAt: Date.now() });
        tx.update(postRef, { viewCount: next });
        return { counted: true, viewCount: next };
      });
      return NextResponse.json(result);
    }

    // fork: 중복 제한 없이 +1
    const snap = await postRef.get();
    if (!snap.exists) return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    await postRef.update({ forkCount: FieldValue.increment(1) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'POST_NOT_FOUND') {
      return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    }
    console.error('[/api/posts/[id]/count] 실패:', e);
    return NextResponse.json({ error: '처리에 실패했어요.' }, { status: 500 });
  }
}
