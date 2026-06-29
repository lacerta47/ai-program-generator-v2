import type { GeneratedCode } from './types';

/** 생성 코드 안에서 사진 자리를 가리키는 리터럴 토큰. AI가 이미지 소스로 사용. */
export const PHOTO_TOKEN = '__PHOTO__';

// 사진이 없는데 토큰만 남은 경우 깨지지 않게 1×1 투명 PNG로 대체.
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 코드 3필드의 PHOTO_TOKEN을 data-URI로 치환. photo 없으면 투명 PNG. 토큰 없으면 무변경(no-op). */
export function substitutePhoto(code: GeneratedCode, photo?: string): GeneratedCode {
  const img = photo || TRANSPARENT_PNG;
  // split/join = 리터럴 전역 치환(replaceAll의 $ 특수문자 이슈 회피; data-URI는 $ 포함 가능).
  const sub = (s: string) => s.split(PHOTO_TOKEN).join(img);
  return { html: sub(code.html), css: sub(code.css), javascript: sub(code.javascript) };
}
