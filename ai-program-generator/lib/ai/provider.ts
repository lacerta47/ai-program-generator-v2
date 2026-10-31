import { GeminiProvider } from './gemini';
import { BizRouterProvider } from './bizrouter';
import type { AIProvider } from './types';
import { createHash, randomUUID } from 'node:crypto';
import { GenerationBusyError } from './errors';

/** Stable assignment for a server-generated request ID; no per-instance round robin. */
export function selectSplitProvider(requestId: string): 'gemini' | 'bizrouter' {
  return createHash('sha256').update(requestId).digest().readUInt32BE(0) < 0x80000000 ? 'gemini' : 'bizrouter';
}

function requireSplitConfig() {
  if (!(process.env.GEMINI_API_KEY_PAID || process.env.GEMINI_API_KEY) || !process.env.BIZROUTER_API_KEY ||
      process.env.BIZROUTER_MODEL !== 'google/gemini-3.8-flash' || process.env.BIZROUTER_HIGH_MODEL !== 'google/gemini-4-argon') {
    throw new Error('분산 호출에는 두 제공자 키와 기존 Gemini 모델 설정이 필요합니다.');
  }
}

function selectBizRouterKey(requestId: string, slotIndex?: number): 'BIZROUTER_API_KEY' | 'BIZROUTER_API_KEY_2' {
  if (!process.env.BIZROUTER_API_KEY_2) return 'BIZROUTER_API_KEY';
  const index = slotIndex ?? createHash('sha256').update(`bizrouter-key:${requestId}`).digest().readUInt32BE(0);
  return index % 2 === 0 ? 'BIZROUTER_API_KEY' : 'BIZROUTER_API_KEY_2';
}

// AI 제공자 교체 지점(single swap point).
// 나중에 OpenAI/Claude 등으로 바꾸려면 여기서 반환하는 구현만 교체한다.
export function getAIProvider(requestId: string = randomUUID(), bizrouterSlotIndex?: number): AIProvider {
  const provider = process.env.AI_PROVIDER || 'gemini';
  if (provider === 'gemini') return new GeminiProvider();
  if (provider === 'bizrouter' || provider === 'split' || provider === 'bizrouter-first') {
    if (provider !== 'bizrouter') requireSplitConfig();
    const gemini = new GeminiProvider();
    const bizrouter = new BizRouterProvider(selectBizRouterKey(requestId, bizrouterSlotIndex));
    const paid = provider === 'split' && selectSplitProvider(requestId) === 'gemini' ? gemini : bizrouter;
    return {
      generateStream: (input, signal) => input.tier === 'free'
        ? gemini.generateStream(input, signal)
        : paid.generateStream(input, signal),
      generate: (input) => input.tier === 'free' ? gemini.generate(input) : paid.generate(input),
    };
  }
  throw new Error('지원하지 않는 AI_PROVIDER 설정입니다.');
}

/** User endpoint admission, before quota reservation. Split mode stays opt-in. */
export async function prepareUserGeneration(requestId: string, signal: AbortSignal) {
  const provider = getAIProvider(requestId);
  const mode = process.env.AI_PROVIDER;
  if (mode !== 'split' && mode !== 'bizrouter-first') return { provider, signal, release: async () => {} };
  const { acquireGenerationSlot } = await import('@/lib/server/generationSlots');
  if (mode === 'bizrouter-first') {
    try {
      const lease = await acquireGenerationSlot('bizrouter', signal);
      return { provider: getAIProvider(requestId, lease.slotIndex), ...lease };
    } catch (e) {
      // Only capacity exhaustion spills over. Authentication/DB/upstream errors do not.
      if (!(e instanceof GenerationBusyError)) throw e;
    }
    const lease = await acquireGenerationSlot('gemini', signal);
    return { provider: new GeminiProvider(), ...lease };
  }
  const route = selectSplitProvider(requestId);
  const lease = await acquireGenerationSlot(route, signal);
  return { provider: route === 'bizrouter' ? getAIProvider(requestId, lease.slotIndex) : provider, ...lease };
}
