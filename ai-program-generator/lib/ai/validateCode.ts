import type { GeneratedCode } from './types';

// 생성된 코드가 "최소한 실행은 되는지" 보증하는 게이트.
//
// 배경: responseSchema(제약 디코딩)는 JSON '껍데기'만 올바르게 강제한다. 모델이 문법이 깨진 JS를
// 쓰거나 HTML에 없는 요소를 조작해도 JSON.parse는 성공하므로, 기존 검사(JSON 파싱 + 빈 html)만으로는
// "화면은 뜨는데 버튼이 죽은" 프로그램이 그대로 통과해 게시됐다(실측 52건 중 7건).
//
// 한계(중요): 문법과 DOM 정합성만 본다. 무한 루프·잘못된 계산 같은 런타임 로직 오류는 잡지 못한다.
// 완전한 보증이 아니라 '확실히 죽은 것'만 걸러내는 값싼 1차 방어선이다.

/** html에 정적으로 존재하는 id */
function htmlIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  return ids;
}

/**
 * js가 실행 중에 만들어내는 id — 문자열로 조립한 HTML(innerHTML 등), .id 대입, setAttribute.
 * 동적으로 생성되는 요소를 '없는 요소'로 오판해 정상 작품을 막지 않기 위한 보정이다.
 * 따옴표가 이스케이프된 형태("<div id=\"x\">")도 잡도록 역슬래시를 먼저 벗긴다.
 */
function jsCreatedIds(js: string): Set<string> {
  const ids = new Set<string>();
  const unescaped = js.replace(/\\(["'])/g, '$1');
  for (const m of unescaped.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) ids.add(m[1]);
  for (const m of js.matchAll(/\.id\s*=\s*["'`]([^"'`]+)["'`]/g)) ids.add(m[1]);
  for (const m of js.matchAll(/setAttribute\(\s*["']id["']\s*,\s*["']([^"']+)["']\s*\)/g)) ids.add(m[1]);
  return ids;
}

/**
 * 주석만 제거한다(문자열은 보존 — 셀렉터 리터럴이 문자열 안에 있으므로 지우면 안 된다).
 * 1-pass 상태 스캐너라 문자열·템플릿 안의 '//'(예: URL)를 주석으로 오인하지 않는다.
 * 실제로 주석 속 예시 코드(`// 예) getElementById('timer-display')`)를 실제 참조로 오인해
 * 정상 작품을 막은 적이 있어 추가됐다.
 * 정규식 리터럴 같은 희귀 케이스에서 과하게 지울 수 있으나, 그 방향은 '검사를 덜 하게' 되는
 * 안전측(정상 작품을 막지 않음)이라 허용한다.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i];
        const done = src[i] === c;
        i++;
        if (done) break;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** js가 조회하는 id (리터럴로 쓴 것만 — 변수·템플릿으로 조립한 셀렉터는 안전측으로 무시) */
function referencedIds(js: string): string[] {
  const out: string[] = [];
  for (const m of js.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]);
  for (const m of js.matchAll(/querySelector(?:All)?\(\s*["']#([A-Za-z_][\w-]*)["']\s*\)/g)) out.push(m[1]);
  return out;
}

/**
 * 실행 가능성 검사. 통과면 null, 실패면 사유 문자열(로그용 — 사용자에겐 노출하지 않는다).
 *
 * 문법 검사는 new Function으로 "컴파일만" 한다 — 함수를 만들기만 하고 호출하지 않으므로
 * 생성 코드가 실행되지 않는다(부작용 없음).
 * ※ nodejs 런타임 전용. edge 런타임으로 옮기면 new Function이 막히므로 파서로 교체해야 한다.
 */
export function validateGeneratedCode(code: GeneratedCode): string | null {
  const html = code.html ?? '';
  const js = code.javascript ?? '';
  if (!js.trim()) return null; // JS 없는 정적 작품(카드 등)은 검사 대상 아님

  try {
    new Function(js);
  } catch (e) {
    return `JS 문법 오류: ${(e as Error).message}`;
  }

  // 참조 추출은 주석을 벗긴 코드에서 — 주석 속 예시 코드를 실제 참조로 오인하지 않도록.
  // (반대로 '만들어지는 id'는 원문에서 모아 더 관대하게 판단한다.)
  const known = htmlIds(html);
  for (const id of jsCreatedIds(js)) known.add(id);
  const missing = [...new Set(referencedIds(stripComments(js)))].filter((id) => !known.has(id));
  if (missing.length) return `HTML에 없는 요소를 참조: ${missing.join(', ')}`;

  return null;
}
