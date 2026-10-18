import type { GenerateInput } from './types';

type GenerationQuality = NonNullable<GenerateInput['quality']>;

const HIGH_QUALITY_PROGRAM_TYPES = new Set(['maze', 'dressup', 'aquarium']);

/** 복잡 유형은 실사용 유료 경로에서만 최고 품질 모델을 사용한다. */
export function getGenerationQuality(
  programType: string | undefined,
  tier: 'free' | 'paid',
): GenerationQuality {
  return tier === 'paid' && programType && HIGH_QUALITY_PROGRAM_TYPES.has(programType)
    ? 'high'
    : 'standard';
}
