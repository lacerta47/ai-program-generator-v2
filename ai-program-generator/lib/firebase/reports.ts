import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './client';
import type { Post } from './types';

const COL = 'reports';

export interface Report {
  id: string;
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  reporterUid: string;
  reason: string;
  memo?: string;
  createdAt: number;
}

/** 신고 제출. doc id = `${postId}_${reporterUid}` 라 사용자당 작품 1회(재신고는 덮어쓰기). */
export async function submitReport(
  post: Post,
  reporterUid: string,
  reason: string,
  memo?: string,
): Promise<void> {
  const ref = doc(db, COL, `${post.id}_${reporterUid}`);
  const trimmed = memo?.trim();
  await setDoc(ref, {
    postId: post.id,
    postTitle: post.title,
    postAuthorName: post.authorName || '익명',
    postOwnerUid: post.ownerUid,
    reporterUid,
    reason,
    ...(trimmed ? { memo: trimmed } : {}),
    createdAt: Date.now(),
  });
}

/** 전체 신고 조회(관리자 전용 — 규칙이 비관리자 읽기를 거부). */
export async function fetchReports(): Promise<Report[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report);
}

const REPORTS_PAGE = 30;

/** 커서 기반 페이지 조회(관리자 전용). createdAt 내림차순, 30건씩. */
export async function fetchReportsPage(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ reports: Report[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const base = [collection(db, COL), orderBy('createdAt', 'desc'), limit(REPORTS_PAGE)] as const;
  const q = cursor ? query(...base, startAfter(cursor)) : query(...base);
  const snap = await getDocs(q);
  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report);
  return { reports, cursor: snap.docs.at(-1) ?? null, hasMore: snap.size === REPORTS_PAGE };
}

/** 특정 작품의 신고 일괄 삭제(관리자 처리). */
export async function dismissReportsForPost(postId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COL), where('postId', '==', postId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/** 미처리 신고 수(관리자 칩 배지용). */
export async function countReports(): Promise<number> {
  const snap = await getCountFromServer(collection(db, COL));
  return snap.data().count;
}
