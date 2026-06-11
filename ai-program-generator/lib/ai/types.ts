// AI 제공자 교체를 위한 고정 계약(contract).
// 앱의 나머지 코드는 이 타입들만 알면 되고,
// Gemini/OpenAI/Claude 등 제공자별 세부사항은 각 구현 파일 안에 캡슐화한다.

export type GenerateMode = 'generate' | 'modify';

export interface GenerateInput {
  /** 사용자 계획서 또는 수정 요청을 담은 본문 프롬프트 */
  prompt: string;
  /** 시스템 프롬프트(역할/출력형식 지시) */
  system: string;
  /** 신규 생성인지 기존 코드 수정인지 */
  mode: GenerateMode;
}

export interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

export interface AIProvider {
  generate(input: GenerateInput): Promise<GeneratedCode>;
}
