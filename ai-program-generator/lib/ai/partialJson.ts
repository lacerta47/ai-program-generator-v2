import { parse, disableErrorLogging } from 'best-effort-json-parser';
import type { GeneratedCode } from './types';

// 스트리밍 중 불완전 JSON을 매 청크 파싱하므로 파서의 콘솔 에러 로깅을 끈다(스팸 방지).
disableErrorLogging();

/**
 * 스트리밍 중 누적된(=불완전한) JSON 텍스트에서 {html,css,javascript}의 "지금까지" 값을 관용 추출.
 * 파싱 불가 구간이면 빈 객체. 문자열인 필드만 채운다.
 */
export function parsePartialCode(raw: string): Partial<GeneratedCode> {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = parse(raw);
  } catch {
    return {};
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const out: Partial<GeneratedCode> = {};
  if (typeof o.html === 'string') out.html = o.html;
  if (typeof o.css === 'string') out.css = o.css;
  if (typeof o.javascript === 'string') out.javascript = o.javascript;
  return out;
}
