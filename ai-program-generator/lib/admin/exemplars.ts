import { adminDb } from '@/lib/firebase/admin';
import { truncateCode, type Exemplar } from '@/lib/ai/exemplars';
import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

export type ExemplarVariant = 'default' | 'survey';

const COL = 'exemplars';
const docId = (variant: ExemplarVariant) => `active_${variant}`;

export interface ExemplarCandidate {
  id: string;
  title: string;
  likeCount: number;
  forkCount: number;
  hasPlan: boolean;
}

/** variant 슬롯의 현재 exemplar. 없거나 읽기 실패면 null(생성을 막지 않는다). */
export async function getExemplar(variant: ExemplarVariant): Promise<Exemplar | null> {
  try {
    const snap = await adminDb.collection(COL).doc(docId(variant)).get();
    return snap.exists ? (snap.data() as Exemplar) : null;
  } catch (e) {
    console.error('exemplar 읽기 실패:', e);
    return null;
  }
}

/** 게시물을 압축·동결해 variant 슬롯에 지정. plan/code 없는 구버전 글이면 예외. */
export async function setExemplarFromPost(
  postId: string,
  variant: ExemplarVariant,
  approvedBy: string,
): Promise<Exemplar> {
  const postSnap = await adminDb.collection('posts').doc(postId).get();
  if (!postSnap.exists) throw new Error('POST_NOT_FOUND');
  const post = postSnap.data() as { title?: string; plan?: PlanFields; code?: GeneratedCode };
  if (!post.plan) throw new Error('POST_HAS_NO_PLAN');
  if (!post.code) throw new Error('POST_HAS_NO_CODE');

  const exemplar: Exemplar = {
    variant,
    plan: post.plan,
    code: truncateCode(post.code),
    sourcePostId: postId,
    sourceTitle: post.title ?? '(제목 없음)',
    approvedBy,
    approvedAt: Date.now(),
  };
  await adminDb.collection(COL).doc(docId(variant)).set(exemplar);
  return exemplar;
}

/** variant 슬롯 비우기. */
export async function clearExemplar(variant: ExemplarVariant): Promise<void> {
  await adminDb.collection(COL).doc(docId(variant)).delete();
}

/**
 * 좋아요 상위 후보 글(자동 추림). likeCount 내림차순 상위 limitN개.
 * likeCount 필드가 없는 구버전 글은 정렬에서 자연히 제외된다(인기글만 후보).
 */
export async function listExemplarCandidates(limitN = 20): Promise<ExemplarCandidate[]> {
  const snap = await adminDb.collection('posts').orderBy('likeCount', 'desc').limit(limitN).get();
  return snap.docs.map((d) => {
    const data = d.data() as { title?: string; likeCount?: number; forkCount?: number; plan?: PlanFields };
    return {
      id: d.id,
      title: data.title ?? '(제목 없음)',
      likeCount: data.likeCount ?? 0,
      forkCount: data.forkCount ?? 0,
      hasPlan: !!data.plan,
    };
  });
}
