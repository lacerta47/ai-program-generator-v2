import { describe, expect, it } from 'vitest';
import { selectGeminiModels } from './gemini';
import { getGenerationQuality } from './modelPolicy';

describe('생성 모델 정책', () => {
  it.each(['maze', 'dressup', 'aquarium'])('%s는 유료 사용자 생성에서 high를 선택한다', (programType) => {
    expect(getGenerationQuality(programType, 'paid')).toBe('high');
  });

  it('그 밖의 유형은 standard를 선택한다', () => {
    expect(getGenerationQuality('game', 'paid')).toBe('standard');
    expect(getGenerationQuality(undefined, 'paid')).toBe('standard');
  });

  it('무료 자동 예시는 복잡 유형도 standard를 선택한다', () => {
    expect(getGenerationQuality('maze', 'free')).toBe('standard');
  });

  it('standard는 3.8 Flash, high는 Argon을 사용한다', () => {
    expect(selectGeminiModels({ quality: 'standard', tier: 'paid' })).toEqual({
      primary: 'gemini-3.8-flash',
      fallback: 'gemini-2.5-flash-lite',
    });
    expect(selectGeminiModels({ quality: 'high', tier: 'paid' })).toEqual({
      primary: 'gemini-4-argon',
      fallback: 'gemini-3.8-flash',
    });
  });

  it('무료 키에는 Argon을 선택하지 않는다', () => {
    expect(selectGeminiModels({ quality: 'high', tier: 'free' }).primary).toBe('gemini-3.8-flash');
  });
});
