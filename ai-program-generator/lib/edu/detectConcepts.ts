// 저장된 생성 코드에서 컴퓨팅 개념을 직접 탐지(교육 #2 개선 A — 표시의 근거를
// Gemini 자기보고에서 '코드 사실'로 교체). 결정론적·비용 0이며, conceptTags가 없는
// 구버전 글에도 소급 적용된다. 완벽한 파서는 아니고 표시용 휴리스틱 — 주석·문자열을
// 벗겨 오탐(안내 문구 속 'if' 등)을 줄이고, 애매한 신호는 넣지 않는 쪽(미탐 안전측)을 택한다.
// (Gemini의 conceptTags 저장은 유지 — 향후 도감 집계용. 화면 표시는 이 탐지가 우선.)

import type { GeneratedCode } from '@/lib/ai/types';

/**
 * JS에서 주석·문자열 제거 — 1패스 상태 스캐너(코드/라인주석/블록주석/문자열 상태 추적).
 * 정규식 다패스는 '주석 속 따옴표'(// don't ...)와 '문자열 속 //'("a // b")를 동시에 못 가려,
 * 짝 없는 따옴표가 다음 따옴표까지 코드를 삼키던 버그가 있었다(수정). 상태 전환은 코드 상태에서만
 * 일어나므로 서로의 내부 구분자를 리터럴로 올바르게 무시한다. 템플릿은 통째 제거 — ${} 안 코드는
 * 놓치지만 안전측. 출력: 코드=그대로, 문자열=''(빈 문자열), 주석=공백.
 */
function stripJs(src: string): string {
  let out = '';
  const n = src.length;
  for (let i = 0; i < n; ) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      // 라인 주석 → 개행 전까지 소비(내부 따옴표·기호 무시)
      i += 2;
      while (i < n && src[i] !== '\n') i++;
      out += ' ';
      continue;
    }
    if (c === '/' && c2 === '*') {
      // 블록 주석 → */ 까지 소비
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2; // */ 건너뜀(미종료면 i가 n을 넘어 루프 종료)
      out += ' ';
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // 문자열/템플릿 → 짝 따옴표까지 소비(내부 //·다른 따옴표 무시, \escape 처리)
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++; // 닫는 따옴표 건너뜀
      out += "''";
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** HTML에서 주석 제거(태그 탐지 오탐 방지). */
function stripHtml(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, ' ');
}

// 사용자 조작으로 보는 이벤트들(로드·리사이즈 등 비조작 이벤트는 제외)
const INPUT_EVENTS =
  'click|dblclick|mousedown|mouseup|mousemove|keydown|keyup|keypress|input|change|submit|touchstart|touchend|touchmove|pointerdown|pointerup|wheel';

/**
 * 코드 → 사용한 개념 목록(고정 순서). 판정 기준:
 * - 순서: 코드가 있으면 항상 (모든 프로그램은 차례로 실행됨 — 기본 배지)
 * - 조건: if / switch 분기
 * - 반복: for / while / do / setInterval / requestAnimationFrame / forEach·map·filter·reduce
 * - 입력: 사용자 조작 리스너(addEventListener·on*=·.on*=) 또는 입력 요소(<button·input·select·textarea>)
 * - 출력: 화면 내용(html) 또는 DOM/canvas/오디오 출력 — 사실상 항상 (기본 배지)
 */
export function detectConcepts(code: GeneratedCode): string[] {
  const html = stripHtml(code.html ?? '');
  const js = stripJs(code.javascript ?? '');
  const hasCode = /\S/.test(html) || /\S/.test(js);
  if (!hasCode) return [];

  const tags: string[] = ['순서'];

  if (/\b(if|switch)\s*\(/.test(js)) tags.push('조건');

  if (
    /\b(for|while)\s*\(/.test(js) ||
    /\bdo\s*\{/.test(js) ||
    /\b(setInterval|requestAnimationFrame)\s*\(/.test(js) ||
    /\.(forEach|map|filter|reduce)\s*\(/.test(js)
  )
    tags.push('반복');

  // 입력: 이벤트명은 문자열 리터럴이라 strip 후엔 사라짐 → 리스너 검사만 원문(jsRaw) 기준
  const jsRaw = code.javascript ?? '';
  const inputByListener = new RegExp(`addEventListener\\s*\\(\\s*['"\`](${INPUT_EVENTS})`, 'i').test(jsRaw);
  const inputByOnAssign = new RegExp(`\\.on(${INPUT_EVENTS})\\s*=`, 'i').test(js);
  const inputByAttr = new RegExp(`\\son(${INPUT_EVENTS})\\s*=`, 'i').test(html);
  const inputByElement = /<\s*(button|input|select|textarea)\b/i.test(html);
  if (inputByListener || inputByOnAssign || inputByAttr || inputByElement) tags.push('입력');

  if (
    /\S/.test(html.replace(/<[^>]*>/g, ' ')) || // 태그 밖 보이는 텍스트
    /<\s*(canvas|img|svg|video|audio)\b/i.test(html) ||
    /\b(textContent|innerHTML|innerText|insertAdjacentHTML|appendChild|createElement|fillText|fillRect|drawImage|new\s+Audio|\.play\s*\()/.test(js)
  )
    tags.push('출력');

  return tags;
}
