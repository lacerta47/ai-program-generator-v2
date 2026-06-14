import { doc, increment, runTransaction } from 'firebase/firestore';
import { db } from './client';

const COL = 'posts';

/** 첫 조회면 view doc 생성 + viewCount +1, 이미 봤으면 no-op. 증가했으면 true. */
export async function recordView(postId: string, uid: string): Promise<boolean> {
  const viewRef = doc(db, COL, postId, 'views', uid);
  const postRef = doc(db, COL, postId);
  return runTransaction(db, async (tx) => {
    const viewSnap = await tx.get(viewRef);
    if (viewSnap.exists()) return false;
    tx.set(viewRef, { createdAt: Date.now() });
    tx.update(postRef, { viewCount: increment(1) });
    return true;
  });
}
