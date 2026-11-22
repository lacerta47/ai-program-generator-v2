import type { PlanFields } from '@/lib/firebase/types';
import type { ProgramType, SurveyAnswers, SurveyStep } from './types';
import { AI_PICK } from './types';

/** showIf를 적용해 현재 답 기준 실제 노출 단계 */
export function visibleSteps(type: ProgramType, answers: SurveyAnswers): SurveyStep[] {
  return type.steps.filter((s) => !s.showIf || s.showIf(answers));
}

function selectedOptions(type: ProgramType, step: SurveyStep, answers: SurveyAnswers) {
  let a = answers[step.id];
  // 예전 그림판 답에 남아 있는 Clipboard 선택도 PNG 이미지 출력으로 이관한다.
  if (type.id === 'paint' && step.id === 'save' && typeof a === 'string' && ['copy', 'clipboard', 'both'].includes(a)) {
    a = 'download';
  }
  let ids = Array.isArray(a) ? a : a ? [a] : [];
  const exclusiveId = ids.find((id) => step.options.some((option) => option.id === id && option.exclusive));
  if (exclusiveId) ids = [exclusiveId];
  else if (step.multi && step.maxSelections) ids = ids.slice(0, step.maxSelections);
  return step.options.filter((o) => ids.includes(o.id));
}

/** basePrompt + 노출 단계의 선택 조각들을 순서대로 결합 */
export function assemblePrompt(type: ProgramType, answers: SurveyAnswers): string {
  const parts: string[] = [type.basePrompt];
  const designSelections: string[] = [];
  for (const step of visibleSteps(type, answers)) {
    if (answers[step.id] === AI_PICK) {
      // "아무거나 좋아!" — 그 부분은 AI가 어울리게 알아서 정하게 위임
      parts.push(`'${step.question}' 부분은 가장 어울리게 알아서 정해줘.`);
      continue;
    }
    for (const opt of selectedOptions(type, step, answers)) {
      if (opt.promptFragment) {
        parts.push(opt.promptFragment);
        if (step.role === 'appearance' || step.role === 'decor') {
          designSelections.push(`- ${step.question} → ${opt.label}: ${opt.promptFragment}`);
        }
      }
    }
  }
  if (designSelections.length) {
    parts.push(`[학생이 고른 디자인]\n자동 디자인 프리셋보다 아래 선택을 우선하세요.\n${designSelections.join('\n')}`);
  }
  if (type.id === 'calc' && answers.mode === 'calc') {
    const operationStep = type.steps.find(step => step.id === 'ops');
    const operations = operationStep ? selectedOptions(type, operationStep, answers).map(option => option.label) : [];
    const names = operations.length ? operations.join(', ') : '더하기, 빼기, 곱하기, 나누기';
    parts.push(`[적용 연산] ${names}. 이 목록의 연산만 버튼과 키보드에 연결해.`);
  }
  if (type.id === 'roulette') {
    const stopEffects = type.steps.find(step => step.id === 'stopfx');
    const hasWinSound = stopEffects && selectedOptions(type, stopEffects, answers).some(option => option.id === 'cheer');
    parts.push(hasWinSound
      ? '[당첨 소리: 켜기] 멈춘 뒤 한 번만 재생해. 돌 때 소리 설정과 별개야.'
      : '[당첨 소리: 끄기] 당첨용 오디오 함수나 재생 호출을 만들지 마. 회전 중 소리와 시각 효과만 각 선택에 맞춰.');
  }
  return parts.join(' ');
}

/** 게시판 저장/호환용 PlanFields. name=buildName, etc=선택 요약. */
export function surveyToPlan(type: ProgramType, answers: SurveyAnswers): PlanFields {
  const chosen = visibleSteps(type, answers).flatMap((s) =>
    answers[s.id] === AI_PICK
      ? [`${s.question} → 아무거나 (AI)`]
      : selectedOptions(type, s, answers).map((o) => `${s.question} → ${o.label}`),
  );
  return {
    name: type.buildName(answers),
    look: '',
    usage: '',
    how: '',
    etc: `[${type.label}] 선택으로 만든 작품\n` + chosen.join('\n'),
  };
}

/** 진행률(노출 단계 기준). answered=답한 노출단계, total=전체 노출단계. */
export function surveyProgress(
  type: ProgramType,
  answers: SurveyAnswers,
): { answered: number; total: number } {
  const steps = visibleSteps(type, answers);
  const answered = steps.filter((s) => {
    const a = answers[s.id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }).length;
  return { answered, total: steps.length };
}
