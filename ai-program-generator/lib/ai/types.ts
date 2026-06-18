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

/** 스트리밍 청크: 진행 중 부분 코드(delta) → 검증 통과한 최종(done). */
export type GenerationChunk =
  | { type: 'delta'; partial: Partial<GeneratedCode> }
  | { type: 'done'; code: GeneratedCode };

export interface AIProvider {
  /** 점진 생성: 부분 코드를 delta로 흘리고 마지막에 검증된 최종을 done으로 emit. */
  generateStream(input: GenerateInput): AsyncIterable<GenerationChunk>;
  /** 비스트리밍 편의: generateStream을 끝까지 소비해 최종만 반환. */
  generate(input: GenerateInput): Promise<GeneratedCode>;
}
