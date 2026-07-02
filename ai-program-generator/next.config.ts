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
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com",
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

      // (B) 미리보기 서빙 경로: 앱 오리진이 iframe으로 감쌀 수 있게 허용(프로세스 격리 유지)
      {
        source: '/api/preview/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors 'self' ${APP} http://localhost:3000 http://127.0.0.1:3000`,
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
