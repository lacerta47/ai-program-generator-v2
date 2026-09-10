import { adminDb } from '@/lib/firebase/admin';
import { exemplarCodeReference, truncateCode, type Exemplar } from '@/lib/ai/exemplars';
import { validateGeneratedCode } from '@/lib/ai/validateCode';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

export type ExemplarVariant = 'default' | 'survey';

const COL = 'exemplars';

/** 유형별 슬롯은 survey에만 있다. id는 PROGRAM_TYPES의 id(paint·quiz…). */
export const PROGRAM_TYPE_IDS: readonly string[] = PROGRAM_TYPES.map((t) => t.id);
export function isProgramTypeId(v: unknown): v is string {
  return typeof v === 'string' && PROGRAM_TYPE_IDS.includes(v);
}

/**
 * 슬롯 문서 id. survey+유형이면 `active_survey_{type}`, 아니면 `active_{variant}`.
 * default에는 유형 슬롯이 없다(서술형은 유형을 모름) — programType은 survey일 때만 의미 있음.
 */
const docId = (variant: ExemplarVariant, programType?: string) =>
  variant === 'survey' && programType ? `active_survey_${programType}` : `active_${variant}`;

export interface ExemplarCandidate {
  id: string;
  title: string;
  likeCount: number;
  forkCount: number;
  hasPlan: boolean;
}

async function readSlot(id: string): Promise<Exemplar | null> {
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  const exemplar = snap.data() as Exemplar;
  return { ...exemplar, codeReference: exemplarCodeReference(exemplar.code) };
}

function usableExemplar(exemplar: Exemplar | null): Exemplar | null {
  if (!exemplar || exemplar.codeReference === 'plan-only') return exemplar;
  const invalid = validateGeneratedCode(exemplar.code);
  if (!invalid) return exemplar;
  console.error(`exemplar 코드 검증 실패(${exemplar.sourcePostId}):`, invalid);
  return null;
}

/**
 * 생성에 붙일 exemplar. survey+유형이면 유형 슬롯을 먼저 보고, 비어 있으면 유형 공통 survey 슬롯으로 폴백.
 * 없거나 읽기 실패면 null(생성을 막지 않는다).
 */
export async function getExemplar(variant: ExemplarVariant, programType?: string): Promise<Exemplar | null> {
  try {
    if (variant === 'survey' && programType) {
      const typed = usableExemplar(await readSlot(docId('survey', programType)));
      if (typed) return typed;
    }
    return usableExemplar(await readSlot(docId(variant)));
  } catch (e) {
    console.error('exemplar 읽기 실패:', e);
    return null;
  }
}

/** 관리자 화면용 — 공통 슬롯 2개 + 유형별 슬롯 12개를 한 번에. */
export async function listExemplarSlots(): Promise<{
  default: Exemplar | null;
  survey: Exemplar | null;
  byType: Record<string, Exemplar | null>;
}> {
  const snap = await adminDb.collection(COL).get();
  const map = new Map(snap.docs.map((d) => {
    const exemplar = d.data() as Exemplar;
    return [d.id, { ...exemplar, codeReference: exemplarCodeReference(exemplar.code) } satisfies Exemplar] as const;
  }));
  const byType: Record<string, Exemplar | null> = {};
  for (const id of PROGRAM_TYPE_IDS) byType[id] = map.get(docId('survey', id)) ?? null;
  return { default: map.get(docId('default')) ?? null, survey: map.get(docId('survey')) ?? null, byType };
}

/** 게시물을 압축·동결해 슬롯에 지정. plan/code 없는 구버전 글이면 예외. */
export async function setExemplarFromPost(
  postId: string,
  variant: ExemplarVariant,
  approvedBy: string,
  programType?: string,
): Promise<Exemplar> {
  const postSnap = await adminDb.collection('posts').doc(postId).get();
  if (!postSnap.exists) throw new Error('POST_NOT_FOUND');
  const post = postSnap.data() as { title?: string; plan?: PlanFields; code?: GeneratedCode };
  if (!post.plan) throw new Error('POST_HAS_NO_PLAN');
  if (!post.code) throw new Error('POST_HAS_NO_CODE');
  const invalid = validateGeneratedCode(post.code);
  if (invalid) throw new Error(`POST_CODE_INVALID:${invalid}`);

  const exemplar: Exemplar = {
    variant,
    ...(variant === 'survey' && programType ? { programType } : {}),
    plan: post.plan,
    code: truncateCode(post.code),
    sourcePostId: postId,
    sourceTitle: post.title ?? '(제목 없음)',
    approvedBy,
    approvedAt: Date.now(),
    codeReference: exemplarCodeReference(post.code),
  };
  await adminDb.collection(COL).doc(docId(variant, programType)).set(exemplar);
  return exemplar;
}

/** 슬롯 비우기. */
export async function clearExemplar(variant: ExemplarVariant, programType?: string): Promise<void> {
  await adminDb.collection(COL).doc(docId(variant, programType)).delete();
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
