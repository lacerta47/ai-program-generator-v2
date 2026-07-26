import type { NextConfig } from 'next';

// 보안 응답 헤더. 미리보기(생성 코드)는 교차오리진 iframe으로 로드되므로,
// 전역 X-Frame-Options: DENY를 걸면 미리보기가 깨진다 → /api/preview/* 는 경로별로 분리한다.
// 앱(프로덕션) 오리진 — 미리보기 라우트의 frame-ancestors 허용목록에 쓰인다(미리보기는 교차오리진이라
// 'self'로는 부족). 커스텀 도메인/도메인 변경 시 NEXT_PUBLIC_APP_ORIGIN을 설정(PREVIEW_ORIGIN과 동일 패턴) — L6.
const APP = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://ai-program-generator-v2.vercel.app';
const PREVIEW = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN || 'https://ai-program-generator-v2-preview.vercel.app';
const AUTHDOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
  : 'https://test-ai-builder.firebaseapp.com';

// 어디에도 안 깨지는 공통 안전 헤더
const safeHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

// 메인 앱 CSP. 인라인(테마·Next 하이드레이션) 때문에 'unsafe-inline' 허용하되 외부 스크립트 주입은 차단.
// 롤아웃 완료: Report-Only로 먼저 배포→라이브에서 위반 0 확인 후 강제('Content-Security-Policy')로 승격함(PR #73).
// (script-src의 'unsafe-inline'은 인라인 테마/하이드레이션 때문에 남긴 의도된 트레이드오프 — nonce/hash 전환은 후속.)
// 개발 모드 전용: Next.js React Fast Refresh(HMR)가 eval을 쓰므로 dev에서만 'unsafe-eval'을 허용한다.
// 프로덕션 빌드는 eval을 쓰지 않으므로 강제 유지(값에 'unsafe-eval' 미포함) — dev만 열고 prod는 그대로.
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isDev ? "'unsafe-eval'" : '',
  'https://www.gstatic.com https://www.google.com https://apis.google.com',
]
  .filter(Boolean)
  .join(' ');

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://www.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://www.google.com",
  `frame-src 'self' ${PREVIEW} ${AUTHDOMAIN} https://accounts.google.com https://www.google.com`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      // (A) 모든 경로: 공통 안전 헤더
      { source: '/:path*', headers: safeHeaders },

      // (B) 미리보기 서빙 경로: sandbox(코드 격리) + frame-ancestors(앱 오리진만 임베드 허용).
      //
      // [실측 주의 — 두 directive를 반드시 함께 둘 것]
      // 라우트 핸들러가 Response에 세팅한 Content-Security-Policy와 이 config 값은 '병합되지 않고'
      // 한쪽이 다른 쪽을 통째로 대체한다. 그런데 어느 쪽이 이기는지가 환경마다 달랐다:
      //   · 프로덕션(Vercel): 라우트 값이 이김 → config의 frame-ancestors가 적용 안 됐음
      //   · 로컬 dev:        config 값이 이김 → 라우트의 sandbox가 적용 안 됐음
      // 그래서 한쪽에만 넣으면 환경에 따라 한 directive가 조용히 사라진다.
      // → 양쪽(여기 + lib/server/previewHeaders.ts)에 sandbox·frame-ancestors를 모두 선언해
      //   누가 이기든 두 방어가 살아있게 한다. 한쪽을 고치면 다른 쪽도 함께 고칠 것.
      {
        source: '/api/preview/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `sandbox allow-scripts; frame-ancestors 'self' ${APP} http://localhost:3000 http://127.0.0.1:3000`,
          },
        ],
      },

      // (C) 미리보기 외 전 경로: 클릭재킹 차단 + CSP 강제
      // (라이브 브라우저에서 로그인·파이어스토어·생성·미리보기 iframe 전 경로 CSP 위반 0 확인 후 강제로 승격)
      {
        source: '/((?!api/preview/).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
