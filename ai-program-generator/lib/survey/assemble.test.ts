import { describe, expect, it } from 'vitest';
import { assemblePrompt, surveyToPlan } from './assemble';
import { paint } from './programs/paint';
import { dressup } from './programs/dressup';
import { calc } from './programs/calc';
import { AI_PICK } from './types';

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

describe('학생 디자인 선택 강조', () => {
  it('색상과 배경 선택을 프리셋보다 우선하는 디자인 요약으로 다시 묶는다', () => {
    const prompt = assemblePrompt(calc, { btncolor: 'green', bg: 'dark' });

    expect(prompt).toContain('[학생이 고른 디자인]');
    expect(prompt).toContain('자동 디자인 프리셋보다 아래 선택을 우선하세요.');
    expect(prompt).toContain('버튼 색은 어떻게 할까? → 초록색: 버튼을 초록색 계열로 해.');
    expect(prompt).toContain('배경은 어떻게 할까? → 어두운 배경: 배경을 어두운 색으로 해서 숫자가 밝게 보이게 해.');
  });

  it('AI에게 맡긴 디자인 항목은 고정 선택처럼 요약하지 않는다', () => {
    const prompt = assemblePrompt(calc, { btncolor: AI_PICK, bg: 'white' });
    const summary = prompt.split('[학생이 고른 디자인]')[1];

    expect(prompt).toContain("'버튼 색은 어떻게 할까?' 부분은 가장 어울리게 알아서 정해줘.");
    expect(summary).toContain('배경은 어떻게 할까? → 하얀 배경');
    expect(summary).not.toContain('버튼 색은 어떻게 할까?');
  });
});
