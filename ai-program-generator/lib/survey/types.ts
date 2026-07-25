import type { RoleKey } from './roles';

export type SurveyAnswers = Record<string, string | string[]>;

/**
 * 예약 옵션 id — "아무거나 좋아!(AI가 그 부분을 알아서 정함)".
 * 종류 설정엔 넣지 않고, 단일선택 단계의 선택지 끝에 UI가 자동으로 붙인다.
 */
export const AI_PICK = 'aichoose';

export interface SurveyOption {
  id: string;
  label: string;
  icon?: string;
  /** 이 선택이 생성 프롬프트에 더하는 자연어 조각 */
  promptFragment: string;
  /**
   * '내 사진으로' 류 선택지 — 사진 첨부가 전제인 옵션.
   * 사진은 학생·교사(교실 보드)만 쓸 수 있으므로 그 외 계정에는 UI에서 숨기고,
   * 마지막 단계에서 사진 없이 만들기를 누르면 막는다. 자동 예시(randomPlan)도 이 옵션은 뽑지 않는다.
   */
  needsPhoto?: boolean;
}

export interface SurveyStep {
  id: string;
  question: string;
  options: SurveyOption[];
  multi?: boolean;
  /** 조건부 단계: 이전 답에 따라 노출 여부. 없으면 항상 노출. */
  showIf?: (a: SurveyAnswers) => boolean;
  /** '내가 고른 것' 역할 카드용 — 이 단계가 프로그램의 어느 부분을 정하는지 */
  role?: RoleKey;
  /** 그 단계만 역할 hint를 덮어쓸 때(드묾). 없으면 ROLES[role].hint 사용 */
  roleHint?: string;
}

export interface ProgramType {
  id: string;
  label: string;
  icon: string;
  basePrompt: string;
  steps: SurveyStep[];
  buildName: (a: SurveyAnswers) => string;
}
