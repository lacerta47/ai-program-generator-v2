import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './client';
import type { Category } from './types';

const COL = 'categories';

/** 카테고리 목록 실시간 구독 (order 오름차순). 구독 해제 함수를 반환. */
export function subscribeCategories(
  cb: (categories: Category[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(db, COL), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category));
    },
    (e) => onError?.(e),
  );
}

export async function addCategory(name: string, order: number): Promise<void> {
  await addDoc(collection(db, COL), { name: name.trim(), order, createdAt: Date.now() });
}

export async function renameCategory(id: string, name: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { name: name.trim() });
}

/** 두 카테고리의 순서(order)를 맞바꿈 */
export async function swapCategoryOrder(a: Category, b: Category): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, a.id), { order: b.order });
  batch.update(doc(db, COL, b.id), { order: a.order });
  await batch.commit();
}

/** 카테고리 + 하위 게시물 일괄 삭제 (배치, 450건 단위로 분할) */
export async function deleteCategoryWithPosts(id: string): Promise<void> {
  const postsSnap = await getDocs(query(collection(db, 'posts'), where('categoryId', '==', id)));
  const docs = postsSnap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(db);
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, COL, id));
}
