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
      // 첫 조회만 +1(멱등). views/{uid}.create()로 '1인 1회'를 원자 보장하고, 카운트는
      // FieldValue.increment로 갱신한다 — 인기글에 반 전체가 동시 접속해도 단일 post 문서를
      // read-modify-write로 묶는 트랜잭션 경합을 피한다(viewCount는 정렬용 단일 필드라 샤딩과
      // 달리 무충돌). 클라(recordView)는 counted만 쓰므로 viewCount는 응답에서 뺀다.
      const viewRef = postRef.collection('views').doc(uid);
      try {
        await viewRef.create({ createdAt: Date.now() }); // 이미 있으면 throw → 멱등
      } catch {
        return NextResponse.json({ counted: false }); // 이미 본 사용자(또는 동시요청 경합 패자)
      }
      try {
        await postRef.update({ viewCount: FieldValue.increment(1) });
      } catch {
        // 증가 실패(글 삭제·일시 오류) 시 방금 만든 view 문서를 롤백 삭제한다 — 트랜잭션이 아니라
        // 보상 처리. 안 지우면 create는 성공·increment는 실패한 채 굳어, 그 사용자의 다음 조회가
        // create ALREADY_EXISTS로 막혀 그 1조회가 영구 미집계된다(롤백하면 다음 조회에서 재시도됨).
        await viewRef.delete().catch(() => {});
        return NextResponse.json({ counted: false });
      }
      return NextResponse.json({ counted: true });
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
