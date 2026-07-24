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

// 이 파일은 자동 예시 생성 전용이다 — 실사용 설문(/easy)은 여기를 거치지 않으므로
// 아래 다양성 조정은 아이들이 직접 만드는 작품에 영향을 주지 않는다.

/** 단일선택 단계를 AI 재량('아무거나')으로 넘길 확률. 높일수록 결과가 다양해진다. */
const AI_PICK_RATE = 0.4;

/** multi 단계에서 고를 최대 개수. */
const MULTI_MAX = 3;

/**
 * 예시 소재 시드 — 설문 옵션 밖의 변주를 만드는 유일한 통로.
 * 설문은 정해진 옵션 조합만 만들 수 있어 같은 타입이면 프롬프트가 거의 같아지고 결과물이 수렴한다.
 * 실제 아이 작품의 다양성은 자유 서술에서 오는데 자동 생성에는 그 자리가 없어, 소재어를 하나 얹는다.
 * 화면 분위기·색은 건드리지 않고 '내용'(예시 데이터·이름·문구)에만 적용해 설문 선택과 충돌하지 않게 한다.
 */
const SUBJECT_SEEDS = [
  // 동물
  '공룡', '강아지', '고양이', '판다', '펭귄', '토끼', '사자', '돌고래', '앵무새', '거북이', '다람쥐', '고래',
  // 음식
  '떡볶이', '피자', '딸기', '수박', '아이스크림', '김밥', '도넛', '바나나', '붕어빵', '초콜릿',
  // 자연·우주
  '무지개', '별자리', '화산', '바닷속', '정글', '눈사람', '우주선', '행성', '사막', '폭포',
  // 생활·상상
  '학교', '놀이터', '캠핑', '자전거', '로봇', '보물찾기', '마법사', '해적', '기차', '서커스',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 한 단계의 무작위 답. multi는 1~MULTI_MAX개.
 * allowAiPick=false면 반드시 실제 옵션을 고른다 — 프로그램의 정체성을 정하는 첫 단계에 AI_PICK이
 * 걸리면 buildName이 폴백 이름('나의 퀴즈')으로 떨어져 제목이 되레 단조로워지기 때문이다.
 */
function randomAnswer(step: SurveyStep, allowAiPick: boolean): string | string[] {
  const ids = step.options.map((o) => o.id);
  if (step.multi) {
    const n = 1 + Math.floor(Math.random() * Math.min(MULTI_MAX, ids.length));
    return [...ids].sort(() => Math.random() - 0.5).slice(0, n);
  }
  if (allowAiPick && Math.random() < AI_PICK_RATE) return AI_PICK; // AI_PICK은 단일선택 단계에만
  return pick(ids);
}

/**
 * 서베이 타입·옵션을 무작위로 골라 완성된 예시 계획을 만든다. showIf가 이전 답에 의존하므로
 * 매번 visibleSteps를 다시 계산하며 아직 답 안 한 노출 단계를 채운다.
 * @param excludeTypeIds 이번 호출에서 이미 만든 타입 — 한 호출 안에서 같은 종류가 겹치지 않게 한다.
 *   (서버리스라 호출 간 상태는 유지되지 않으므로 호출 내 중복만 막는다.)
 */
export function randomPlan(excludeTypeIds: string[] = []): RandomPlan {
  const pool = PROGRAM_TYPES.filter((t) => !excludeTypeIds.includes(t.id));
  const type = pick(pool.length > 0 ? pool : PROGRAM_TYPES);

  const answers: SurveyAnswers = {};
  let isFirst = true;
  for (let guard = 0; guard < type.steps.length + 2; guard++) {
    const next = visibleSteps(type, answers).find((s) => answers[s.id] === undefined);
    if (!next) break;
    answers[next.id] = randomAnswer(next, !isFirst);
    isFirst = false;
  }

  const subject = pick(SUBJECT_SEEDS);
  const prompt =
    assemblePrompt(type, answers) +
    ` 이번 작품의 예시 데이터·등장하는 이름·화면 문구에 쓸 소재는 '${subject}'로 정해줘.` +
    ' (화면 분위기·색·꾸밈은 위에서 고른 것을 그대로 지키고, 소재만 반영해.)';
  const plan = surveyToPlan(type, answers);

  return { type, answers, prompt, plan: { ...plan, etc: `${plan.etc}\n소재 → ${subject}` } };
}
