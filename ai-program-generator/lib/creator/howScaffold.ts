// /create 동작(how) 필드 구조화(교육 Phase 1-b) — 순서·조건·반복을 3칸으로 유도.
// 저장은 기존처럼 plan.how 단일 문자열 하나로 유지(규칙 validPlan의 5키 제약을 안 건드림).
// UI 3칸 ↔ plan.how 문자열을 아래 compose/parse로 왕복한다.

export interface HowParts {
  /** ① 먼저(순서·시작) */
  first: string;
  /** ② 그다음(순서·반복) */
  next: string;
  /** ③ 만약 ~하면(조건) */
  ifThen: string;
}

export const EMPTY_HOW: HowParts = { first: '', next: '', ifThen: '' };

const M_FIRST = '① 먼저: ';
const M_NEXT = '② 그다음: ';
const M_IF = '③ 만약 ';

/** 3칸 → plan.how 문자열. 채워진 칸만 마커로 합친다(저장·프롬프트용). */
export function composeHow(p: HowParts): string {
  const lines: string[] = [];
  if (p.first.trim()) lines.push(M_FIRST + p.first.trim());
  if (p.next.trim()) lines.push(M_NEXT + p.next.trim());
  if (p.ifThen.trim()) lines.push(M_IF + p.ifThen.trim());
  return lines.join('\n');
}

/**
 * plan.how → 3칸. 마커가 있으면 구간별로 분해(칸 안 줄바꿈도 안전하게 위치 기반 슬라이스),
 * 마커가 없으면(구버전·easy 출신 글·평문 예시) 전체를 ①칸에 폴백한다.
 */
export function parseHow(how: string): HowParts {
  if (!how || !how.trim()) return { ...EMPTY_HOW };
  const tags: Array<{ key: keyof HowParts; tag: string }> = [
    { key: 'first', tag: M_FIRST },
    { key: 'next', tag: M_NEXT },
    { key: 'ifThen', tag: M_IF },
  ];
  const found = tags
    .map((t) => ({ ...t, idx: how.indexOf(t.tag) }))
    .filter((t) => t.idx !== -1)
    .sort((a, b) => a.idx - b.idx);
  if (found.length === 0) return { first: how, next: '', ifThen: '' };
  const out: HowParts = { ...EMPTY_HOW };
  for (let i = 0; i < found.length; i++) {
    const start = found[i].idx + found[i].tag.length;
    const end = i + 1 < found.length ? found[i + 1].idx : how.length;
    out[found[i].key] = how.slice(start, end).trim();
  }
  return out;
}
