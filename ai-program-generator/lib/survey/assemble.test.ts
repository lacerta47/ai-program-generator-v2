import { describe, expect, it } from 'vitest';
import { assemblePrompt, surveyToPlan } from './assemble';
import { paint } from './programs/paint';

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
