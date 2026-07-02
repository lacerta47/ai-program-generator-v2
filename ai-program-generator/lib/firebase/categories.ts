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
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './client';
import type { Category } from './types';
import { authedJson } from '@/lib/client/authedFetch';

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

/** 해당 카테고리에 직속 게시물이 하나라도 있는지 (잎새 판정·하위 추가 가드용). */
export async function categoryHasPosts(id: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'posts'), where('categoryId', '==', id), limit(1)),
  );
  return !snap.empty;
}

/** 두 카테고리의 순서(order)를 맞바꿈 */
export async function swapCategoryOrder(a: Category, b: Category): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, COL, a.id), { order: b.order });
  batch.update(doc(db, COL, b.id), { order: a.order });
  await batch.commit();
}

/**
 * 카테고리 + 모든 후손 카테고리 + 그 하위 게시물 일괄 삭제 — 서버 경유(Admin SDK).
 * 각 하위 글의 서브컬렉션(likes·views)과 신고(reports)까지 캐스케이드로 지운다(#M5).
 * (클라 배치 삭제는 글 문서만 지워 서브컬렉션이 고아로 남고, reports는 규칙상 삭제 불가였음.)
 */
export async function deleteCategoryTree(id: string): Promise<void> {
  await authedJson(`/api/admin/categories/${id}`, { method: 'DELETE' });
}
