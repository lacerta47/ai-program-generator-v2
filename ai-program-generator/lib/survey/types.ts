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
}

export interface SurveyStep {
  id: string;
  question: string;
  options: SurveyOption[];
  multi?: boolean;
  /** 조건부 단계: 이전 답에 따라 노출 여부. 없으면 항상 노출. */
  showIf?: (a: SurveyAnswers) => boolean;
}

export interface ProgramType {
  id: string;
  label: string;
  icon: string;
  basePrompt: string;
  steps: SurveyStep[];
  buildName: (a: SurveyAnswers) => string;
}
