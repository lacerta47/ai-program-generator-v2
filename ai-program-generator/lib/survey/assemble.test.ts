import { describe, expect, it } from 'vitest';
import { assemblePrompt, surveyToPlan } from './assemble';
import { paint } from './programs/paint';
import { dressup } from './programs/dressup';

describe('그림판 PNG 저장 정규화', () => {
  it.each(['copy', 'clipboard', 'both'])('예전 %s 답을 PNG 다운로드로 이관한다', (save) => {
    const answers = { save };

    expect(assemblePrompt(paint, answers)).toContain('PNG 이미지로 다운로드');
    expect(assemblePrompt(paint, answers)).not.toContain('클립보드');
    expect(surveyToPlan(paint, answers).etc).toContain('PNG로 저장하기');
  });

  it('새 설문에는 PNG 다운로드와 저장 안 함만 표시한다', () => {
    const save = paint.steps.find((step) => step.id === 'save');

    expect(save?.options.map((option) => option.id)).toEqual(['download', 'no']);
  });
});

describe('단계별 다중 선택 상한', () => {
  it('예전 답에 꾸미기 소품이 3개 이상 있어도 앞의 2개만 조립한다', () => {
    const answers = { accessory: ['glasses', 'scarf', 'badge'] };
    const prompt = assemblePrompt(dressup, answers);
    const plan = surveyToPlan(dressup, answers);

    expect(prompt).toContain('안경을 씌우고 벗길 수 있게');
    expect(prompt).toContain('목도리를 두르고 벗길 수 있게');
    expect(prompt).not.toContain('가슴에 다는 배지');
    expect(plan.etc).toContain('안경');
    expect(plan.etc).toContain('목도리');
    expect(plan.etc).not.toContain('배지');
  });
});
