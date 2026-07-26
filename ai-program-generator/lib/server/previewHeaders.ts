import 'server-only';

// 미리보기 서빙(/api/preview/[id], /api/preview/post/[id]) 공통 보안 헤더.
//
// [왜 여기서 frame-ancestors를 함께 선언하나 — 리뷰 주의]
// next.config.ts의 headers()가 /api/preview/:path*에 frame-ancestors를 걸어 두지만,
// 라우트 핸들러가 Response에 같은 이름(Content-Security-Policy) 헤더를 세팅하면 그 값이
// config 값을 **대체**한다(병합 아님). 실제 프로덕션 응답을 재보면 CSP가
// 'sandbox allow-scripts' 하나뿐이라 frame-ancestors 제한이 걸리지 않았다.
// → 라우트가 최종 승자이므로 여기서 두 directive를 한 헤더로 합쳐 선언한다.
//
// sandbox: 생성 코드를 opaque origin으로 격리(직접 탐색해도 앱 토큰 접근 불가)
// frame-ancestors: 우리 앱 오리진만 이 미리보기를 iframe으로 감쌀 수 있게 제한
//   (미리보기는 교차 사이트 오리진에서 서빙되므로 'self'만으로는 부족 — 앱 오리진을 명시)

const APP = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://ai-program-generator-v2.vercel.app';
// Vercel 프리뷰 배포는 배포마다 URL이 달라 위 APP과 다르다. 그 배포에서도 미리보기가 뜨도록
// 현재 배포 자신의 오리진을 허용목록에 추가한다(프로덕션에선 APP과 동일하거나 무해).
const SELF_DEPLOY = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

const FRAME_ANCESTORS = [
  "frame-ancestors 'self'",
  APP,
  SELF_DEPLOY,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]
  .filter(Boolean)
  .join(' ');

export const PREVIEW_CSP = `sandbox allow-scripts; ${FRAME_ANCESTORS}`;

/** 미리보기 응답 공통 헤더(캐시 금지). 성공 응답에서 캐시가 필요하면 Cache-Control만 덮어쓴다. */
export const PREVIEW_SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Content-Security-Policy': PREVIEW_CSP,
};
