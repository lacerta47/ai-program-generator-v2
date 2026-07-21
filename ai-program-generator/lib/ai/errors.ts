/**
 * 사용자에게 메시지를 그대로 보여줘도 안전한(내부 구현 정보가 없는) 오류.
 *
 * /api/generate 스트림은 이 타입일 때만 e.message를 클라에 전달하고,
 * 그 밖의 오류(raw Gemini/SDK 에러, 환경변수 누락 등)는 내부 정보 노출을 막기 위해
 * 일반 메시지로 치환한다. (외부 취약점 분석 B4)
 */
export class UserFacingError extends Error {
  readonly userFacing = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** 무료 할당량 소진(양 모델 모두 429) — UserFacingError의 특수형. 소진을 코드로 구별하기 위함(cron 등). */
export class QuotaExhaustedError extends UserFacingError {}
