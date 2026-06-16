export type SurveyAnswers = Record<string, string | string[]>;

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
