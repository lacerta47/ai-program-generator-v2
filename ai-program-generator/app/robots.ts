import type { MetadataRoute } from 'next';

// 검색엔진 크롤링 규칙. 공개 페이지는 허용, 로그인/관리/개인영역·API·공유링크는 차단.
// (공유링크 /share/*는 반 공용 관람 PIN 뒤의 개인 작품이라 색인 대상 아님 — 미리보기 자체도 noindex)
const SITE = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://eduai-lun.co.kr';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/teacher', '/mypage', '/api/', '/share/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
