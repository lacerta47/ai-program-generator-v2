import type { PlanFields } from '@/lib/firebase/types';
import type { ProgramType, SurveyAnswers, SurveyStep } from './types';

/** showIf를 적용해 현재 답 기준 실제 노출 단계 */
export function visibleSteps(type: ProgramType, answers: SurveyAnswers): SurveyStep[] {
  return type.steps.filter((s) => !s.showIf || s.showIf(answers));
}

function selectedOptions(step: SurveyStep, answers: SurveyAnswers) {
  const a = answers[step.id];
  const ids = Array.isArray(a) ? a : a ? [a] : [];
  return step.options.filter((o) => ids.includes(o.id));
}

/** basePrompt + 노출 단계의 선택 조각들을 순서대로 결합 */
export function assemblePrompt(type: ProgramType, answers: SurveyAnswers): string {
  const parts: string[] = [type.basePrompt];
  for (const step of visibleSteps(type, answers)) {
    for (const opt of selectedOptions(step, answers)) {
      if (opt.promptFragment) parts.push(opt.promptFragment);
    }
  }
  return parts.join(' ');
}

/** 게시판 저장/호환용 PlanFields. name=buildName, etc=선택 요약. */
export function surveyToPlan(type: ProgramType, answers: SurveyAnswers): PlanFields {
  const chosen = visibleSteps(type, answers).flatMap((s) =>
    selectedOptions(s, answers).map((o) => `${s.question} → ${o.label}`),
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
