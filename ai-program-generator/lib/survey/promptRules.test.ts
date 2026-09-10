import { describe, expect, it } from 'vitest';
import { randomPlan } from '@/lib/examples/randomPlan';
import { assemblePrompt } from './assemble';
import { PROGRAM_TYPES } from './programs';

describe('설문 생성 프롬프트 규칙', () => {
  it('모든 선택이 명시적인 문구를 가지며 금지된 브라우저 API를 요구하지 않는다', () => {
    for (const type of PROGRAM_TYPES) {
      for (const step of type.steps) {
        for (const option of step.options) {
          expect(option.promptFragment.trim(), type.id + '/' + step.id + '/' + option.id).not.toBe('');
          expect(option.promptFragment, type.id + '/' + step.id + '/' + option.id)
            .not.toMatch(/localStorage|sessionStorage|navigator\.clipboard|ClipboardItem/);
        }
      }
    }
  });

  it('다중 선택의 없음 옵션은 독점 선택으로 표시한다', () => {
    for (const type of PROGRAM_TYPES) {
      for (const step of type.steps.filter((item) => item.multi)) {
        for (const option of step.options.filter((item) => item.id === 'none' || item.id === 'nothing')) {
          expect(option.exclusive, type.id + '/' + step.id + '/' + option.id).toBe(true);
        }
      }
    }
  });

  it('자동 계획은 단계별 다중 선택 상한을 지키고 독점 옵션을 섞지 않는다', () => {
    for (let i = 0; i < 500; i++) {
      const { type, answers } = randomPlan();
      for (const step of type.steps.filter((item) => item.multi)) {
        const answer = answers[step.id];
        if (!Array.isArray(answer)) continue;
        expect(answer.length).toBeLessThanOrEqual(step.maxSelections ?? 3);
        const hasExclusive = answer.some((id) => step.options.some((option) => option.id === id && option.exclusive));
        if (hasExclusive) expect(answer).toHaveLength(1);
      }
    }
  });

  it('예전 답에 독점 옵션과 다른 옵션이 섞여도 독점 의도만 조립한다', () => {
    const paint = PROGRAM_TYPES.find((type) => type.id === 'paint')!;
    const prompt = assemblePrompt(paint, { stamp: ['dino', 'none', 'unicorn'] });

    expect(prompt).toContain('도장을 넣지 마');
    expect(prompt).not.toContain('공룡 실루엣');
    expect(prompt).not.toContain('유니콘 실루엣');
  });

  it('룰렛은 고정 포인터와 결과 표시 계약을 명시한다', () => {
    const roulette = PROGRAM_TYPES.find((type) => type.id === 'roulette')!;

    expect(roulette.basePrompt).toContain('id="roulette-wheel"');
    expect(roulette.basePrompt).toContain('id="roulette-pointer"');
    expect(roulette.basePrompt).toContain('data-direction="down"');
    expect(roulette.basePrompt).toContain('id="roulette-result"');
    expect(roulette.basePrompt).toContain('당첨 결과: 항목명');
    expect(roulette.basePrompt).toContain('overflow: hidden`을 쓰지 마');
  });

  it('품질을 보장하기 어려운 동물 소리 합성 선택지를 제공하지 않는다', () => {
    const sound = PROGRAM_TYPES.find((type) => type.id === 'sound')!;
    const instrument = sound.steps.find((step) => step.id === 'instrument')!;

    expect(instrument.options.some((option) => option.id === 'animal')).toBe(false);
    expect(instrument.options.some((option) => option.label.includes('동물 소리'))).toBe(false);
  });

  it('꾸미기는 SVG 레이어 계약과 소품 2개 상한을 사용한다', () => {
    const dressup = PROGRAM_TYPES.find((type) => type.id === 'dressup')!;
    const accessory = dressup.steps.find((step) => step.id === 'accessory')!;

    expect(dressup.basePrompt).toContain('id="dressup-stage"');
    expect(dressup.basePrompt).toContain('id="dressup-character"');
    expect(dressup.basePrompt).toContain('viewBox="0 0 400 400"');
    expect(dressup.basePrompt).toContain('layer-accessories');
    expect(dressup.basePrompt).toContain('data-dressup-layer');
    expect(accessory.maxSelections).toBe(2);
  });
});
