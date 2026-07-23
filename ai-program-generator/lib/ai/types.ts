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
  /** 멀티모달: 첨부 사진(없으면 텍스트-only). data=순수 base64(접두 제외), mimeType=image/jpeg 등 */
  photo?: { data: string; mimeType: string };
  /**
   * 빠른 생성 모드(자동 예시 대량 생성 전용) — 품질보다 속도 우선.
   * 실사용 생성(/api/generate)은 이 값을 넘기지 않으므로 기본 품질(thinking 유지)로 동작한다.
   * Gemini 구현은 이 플래그에서 thinking을 끄고 출력 상한을 낮춰 지연을 크게 줄인다.
   */
  fast?: boolean;
}

export interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

/** 생성 1건의 토큰 사용량(비용 실측용). thinking은 출력으로 과금됨. */
export interface TokenUsage {
  input: number;
  output: number;
  thinking: number;
}

/** 교육 메타(교육 Phase 0) — 생성물의 논리를 데이터로 보유. 저학년 설명·컴퓨팅 개념 태그. */
export interface GenerationMeta {
  /** 저학년 쉬운말 로직 설명(3~4문장) */
  logicSummary: string;
  /** 사용한 컴퓨팅 개념 — ['순서','조건','반복','입력','출력'] 부분집합 */
  conceptTags: string[];
  /** 교육(#6) — 다음에 키워볼 도전 한 문장(저장 안 함, 고치기 칸 힌트로만). */
  nextChallenge: string;
  /** 개념별 '내 작품 예시' 한 줄 — 키 ⊆ ['순서','조건','반복','입력','출력'], 각 값 ≤60자. 미측정 시 {}. */
  conceptNotes: Record<string, string>;
}

/** 스트리밍 청크: 진행 중 부분 코드(delta) → 검증 통과한 최종(done). done엔 토큰 사용량·교육 메타(있으면) 동봉. */
export type GenerationChunk =
  | { type: 'delta'; partial: Partial<GeneratedCode> }
  | { type: 'done'; code: GeneratedCode; usage?: TokenUsage; meta?: GenerationMeta };

export interface AIProvider {
  /** 점진 생성: 부분 코드를 delta로 흘리고 마지막에 검증된 최종을 done으로 emit. signal로 모델 호출 자체를 취소. */
  generateStream(input: GenerateInput, signal?: AbortSignal): AsyncIterable<GenerationChunk>;
  /** 비스트리밍 편의: generateStream을 끝까지 소비해 최종만 반환. */
  generate(input: GenerateInput): Promise<GeneratedCode>;
}
