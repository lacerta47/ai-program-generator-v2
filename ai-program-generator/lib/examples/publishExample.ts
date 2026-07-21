import 'server-only';
import type { GeneratedCode, GenerationMeta } from '@/lib/ai/types';
import type { RandomPlan } from './randomPlan';
import { adminDb } from '@/lib/firebase/admin';
import { assertClean } from '@/lib/moderation';

const EXAMPLE_OWNER_UID = 'auto-example-bot'; // 자동예시 식별 키 — admin이 이 uid로 일괄 정리
const EXAMPLE_AUTHOR = '보기 예시';

/** 생성 예시를 교육테스트 카테고리에 게시(Admin SDK, 규칙 우회).
 *  검열 네트(korcen)를 통과 못하면 ProfanityError를 던져 호출부가 그 건 스킵하게 한다. */
export async function publishExample(
  categoryId: string,
  rp: RandomPlan,
  code: GeneratedCode,
  meta: GenerationMeta,
): Promise<void> {
  await assertClean(rp.plan.name, '제목');
  if (rp.plan.etc.trim()) await assertClean(rp.plan.etc, '계획');

  const doc: Record<string, unknown> = {
    title: rp.plan.name,
    categoryId,
    ownerUid: EXAMPLE_OWNER_UID,
    authorName: EXAMPLE_AUTHOR,
    code,
    plan: rp.plan,
    prompt: rp.prompt,
    createdAt: Date.now(),
    boardTeacherUid: null,
  };
  if (meta.logicSummary) doc.logicSummary = meta.logicSummary;
  if (meta.conceptTags.length) doc.conceptTags = meta.conceptTags;
  if (Object.keys(meta.conceptNotes).length) doc.conceptNotes = meta.conceptNotes;

  await adminDb.collection('posts').add(doc);
}
