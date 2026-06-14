import { doc, getDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from './client';

const COL = 'posts';

/** 현재 사용자가 이 글을 좋아요 했는지 */
export async function isLiked(postId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COL, postId, 'likes', uid));
  return snap.exists();
}

/** 좋아요 토글 — liked(현재 상태)=true면 취소, false면 추가. likeCount ±1 동시 반영(배치). */
export async function toggleLike(postId: string, uid: string, liked: boolean): Promise<void> {
  const batch = writeBatch(db);
  const likeRef = doc(db, COL, postId, 'likes', uid);
  const postRef = doc(db, COL, postId);
  if (liked) {
    batch.delete(likeRef);
    batch.update(postRef, { likeCount: increment(-1) });
  } else {
    batch.set(likeRef, { createdAt: Date.now() });
    batch.update(postRef, { likeCount: increment(1) });
  }
  await batch.commit();
}
