import type { GeneratedCode } from './types';

/** 생성 코드 안에서 사진 자리를 가리키는 리터럴 토큰. AI가 이미지 소스로 사용. */
export const PHOTO_TOKEN = '__PHOTO__';

// 사진이 없는데 토큰만 남은 경우 깨지지 않게 1×1 투명 PNG로 대체.
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// 한 필드가 치환 후 커질 수 있는 상한(6MB). 정상 다중참조(퍼즐 등)는 넉넉히 허용하되,
// __PHOTO__ 토큰을 수천 개 반복해 큰 사진으로 부풀리는 메모리 폭증(서빙 시점 OOM/RangeError) DoS를 막는다.
const MAX_EXPANDED = 6_000_000;

/** 코드 3필드의 PHOTO_TOKEN을 data-URI로 치환. photo 없으면 투명 PNG. 토큰 없으면 무변경(no-op). */
export function substitutePhoto(code: GeneratedCode, photo?: string): GeneratedCode {
  const img = photo || TRANSPARENT_PNG;
  // split/join = 리터럴 전역 치환(replaceAll의 $ 특수문자 이슈 회피; data-URI는 $ 포함 가능).
  const sub = (s: string) => {
    const parts = s.split(PHOTO_TOKEN);
    const n = parts.length - 1;
    if (n === 0) return s;
    // 확장 후 크기가 상한 초과면(대량 토큰 × 큰 사진) 큰 사진 대신 작은 투명 PNG로 치환 → 메모리 바운드.
    const chosen = s.length + n * (img.length - PHOTO_TOKEN.length) > MAX_EXPANDED ? TRANSPARENT_PNG : img;
    return parts.join(chosen);
  };
  return { html: sub(code.html), css: sub(code.css), javascript: sub(code.javascript) };
}
