import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import { visibleSteps, assemblePrompt, surveyToPlan } from '@/lib/survey/assemble';
import type { PlanFields } from '@/lib/firebase/types';

export interface RandomPlan {
  type: ProgramType;
  answers: SurveyAnswers;
  prompt: string;
  plan: PlanFields;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 한 단계의 무작위 답. 단일선택은 15% 확률로 '아무거나(AI)'. multi는 1~2개 선택. */
function randomAnswer(step: SurveyStep): string | string[] {
  const ids = step.options.map((o) => o.id);
  if (step.multi) {
    const n = 1 + Math.floor(Math.random() * Math.min(2, ids.length)); // 1~2
    return [...ids].sort(() => Math.random() - 0.5).slice(0, n);
  }
  if (Math.random() < 0.15) return AI_PICK; // AI_PICK은 단일선택 단계에만
  return pick(ids);
}

/** 서베이 타입·옵션을 무작위로 골라 완성된 예시 계획을 만든다. showIf가 이전 답에 의존하므로
 *  매번 visibleSteps를 다시 계산하며 아직 답 안 한 노출 단계를 채운다. */
export function randomPlan(): RandomPlan {
  const type = pick(PROGRAM_TYPES);
  const answers: SurveyAnswers = {};
  for (let guard = 0; guard < type.steps.length + 2; guard++) {
    const next = visibleSteps(type, answers).find((s) => answers[s.id] === undefined);
    if (!next) break;
    answers[next.id] = randomAnswer(next);
  }
  return { type, answers, prompt: assemblePrompt(type, answers), plan: surveyToPlan(type, answers) };
}
