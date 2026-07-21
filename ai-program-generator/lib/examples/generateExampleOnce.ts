import type { GeneratedCode, GenerationMeta } from '@/lib/ai/types';
import { getAIProvider } from '@/lib/ai/provider';
import { SYSTEM_PROMPTS, LOGIC_META_INSTRUCTION } from '@/lib/ai/prompts';

/** 예시용 서버 생성 — /easy와 동일 톤(survey 시스템 프롬프트 + 교육 메타). done 청크의 code·meta 반환.
 *  무료 소진 시 gemini.ts가 UserFacingError를 던지며 그대로 위로 전파(호출부가 exhausted 처리). */
export async function generateExampleOnce(
  prompt: string,
): Promise<{ code: GeneratedCode; meta: GenerationMeta }> {
  const system = SYSTEM_PROMPTS['survey'] + LOGIC_META_INSTRUCTION;
  for await (const chunk of getAIProvider().generateStream({ prompt, system, mode: 'generate' })) {
    if (chunk.type === 'done') {
      return {
        code: chunk.code,
        meta: chunk.meta ?? { logicSummary: '', conceptTags: [], nextChallenge: '', conceptNotes: {} },
      };
    }
  }
  throw new Error('생성 결과(done)가 없어요.');
}
