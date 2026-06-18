import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './client';
import { assertClean } from '@/lib/moderation';
import { forkPost } from '@/lib/client/postCount';
import type { Post, NewPost, PostEdit } from './types';

const COL = 'posts';
export const PAGE_SIZE = 20;

export type PostCursor = QueryDocumentSnapshot<DocumentData> | null;

export interface PostsPage {
  posts: Post[];
  cursor: PostCursor;
  hasMore: boolean;
}

/**
 * 카테고리별 게시물 페이지 조회 (createdAt 내림차순, 커서 기반).
 * 배포된 복합 인덱스 posts(categoryId asc, createdAt desc)를 사용한다.
 */
export async function fetchPosts(categoryId: string, cursor?: PostCursor): Promise<PostsPage> {
  const base = [
    where('categoryId', '==', categoryId),
    orderBy('createdAt', 'desc'),
  ] as const;
  const q = cursor
    ? query(collection(db, COL), ...base, startAfter(cursor), limit(PAGE_SIZE))
    : query(collection(db, COL), ...base, limit(PAGE_SIZE));

  const snap = await getDocs(q);
  const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post);
  return {
    posts,
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

/** 내가 만든 작품 페이지 조회 (ownerUid 기준, 최신순, 커서 기반). 인덱스 posts(ownerUid asc, createdAt desc). */
export async function fetchMyPosts(uid: string, cursor?: PostCursor): Promise<PostsPage> {
  const base = [where('ownerUid', '==', uid), orderBy('createdAt', 'desc')] as const;
  const q = cursor
    ? query(collection(db, COL), ...base, startAfter(cursor), limit(PAGE_SIZE))
    : query(collection(db, COL), ...base, limit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post),
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function getPost(id: string): Promise<Post | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Post) : null;
}

export async function createPost(data: NewPost): Promise<string> {
  await assertClean(data.title);
  await assertClean(data.authorName);
  const ref = await addDoc(collection(db, COL), data);
  return ref.id;
}

export async function updatePostTitle(id: string, title: string): Promise<void> {
  await assertClean(title);
  await updateDoc(doc(db, COL, id), { title: title.trim() });
}

/** 작품 전체 편집(덮어쓰기) — 제목·작성자명·계획서·코드. ownerUid/categoryId/createdAt는 불변. */
export async function updatePostContent(id: string, edit: PostEdit): Promise<void> {
  await assertClean(edit.title);
  await assertClean(edit.authorName);
  await updateDoc(doc(db, COL, id), { ...edit });
}

export async function deletePost(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}

/** 이어 만들기 저장 시 원본의 forkCount +1 — 서버 API로(클라 직접 쓰기는 규칙 차단) */
export async function incrementForkCount(postId: string): Promise<void> {
  await forkPost(postId);
}
