import { doc, getDoc } from 'firebase/firestore';
import { db } from './client';
import { likePost } from '@/lib/client/postCount';

const COL = 'posts';

/** 현재 사용자가 이 글을 좋아요 했는지 (likes 서브문서 공개 읽기) */
export async function isLiked(postId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COL, postId, 'likes', uid));
  return snap.exists();
}

/**
 * 좋아요 토글 — 서버 API가 권위적으로 처리(상태·카운트). 클라 직접 쓰기는 규칙으로 차단됨.
 * (uid·liked 인자는 호출부 호환 위해 유지하나, 서버가 토큰·서브문서로 직접 판단한다.)
 */
export async function toggleLike(postId: string, _uid: string, _liked: boolean): Promise<void> {
  await likePost(postId);
}
