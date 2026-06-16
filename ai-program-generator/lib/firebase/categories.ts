import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './client';
import type { Category } from './types';
import { descendantIds } from '@/lib/board/categoryTree';

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

export async function addCategory(
  name: string,
  order: number,
  parentId: string | null = null,
): Promise<void> {
  const data: { name: string; order: number; createdAt: number; parentId?: string } = {
    name: name.trim(),
    order,
    createdAt: Date.now(),
  };
  // root는 parentId 필드 자체를 생략 → 규칙의 !('parentId' in data) 분기 + 기존 평면 문서와 동일
  if (parentId) data.parentId = parentId;
  await addDoc(collection(db, COL), data);
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

/**
 * 카테고리 + 모든 후손 카테고리 + 그 하위 게시물 일괄 삭제.
 * descendantIds로 자기+후손 id를 모아, 각 카테고리의 게시물을 450건 배치로 지우고,
 * 마지막에 카테고리 문서들을 배치 삭제한다. (Firestore엔 컬렉션 cascade가 없음.)
 */
export async function deleteCategoryTree(id: string, all: Category[]): Promise<void> {
  const ids = descendantIds(id, all);
  for (const cid of ids) {
    const postsSnap = await getDocs(query(collection(db, 'posts'), where('categoryId', '==', cid)));
    const docs = postsSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((cid) => batch.delete(doc(db, COL, cid)));
    await batch.commit();
  }
}
