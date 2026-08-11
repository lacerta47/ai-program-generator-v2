import type { MetadataRoute } from 'next';

// 검색엔진에 알릴 공개 페이지 목록. 로그인이 필요한 화면(마이페이지·교사·관리자)과
// 개인 작품 공유링크는 제외한다(robots.ts와 일치).
const SITE = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://eduai-lun.co.kr';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
    { path: '', priority: 1.0, freq: 'weekly' }, // 랜딩
    { path: '/create', priority: 0.8, freq: 'monthly' },
    { path: '/easy', priority: 0.8, freq: 'monthly' },
    { path: '/board', priority: 0.8, freq: 'daily' }, // 작품이 계속 늘어남
    { path: '/about', priority: 0.5, freq: 'yearly' },
    { path: '/privacy', priority: 0.3, freq: 'yearly' },
    { path: '/terms', priority: 0.3, freq: 'yearly' },
  ];
  return pages.map(({ path, priority, freq }) => ({
    url: `${SITE}${path}`,
    changeFrequency: freq,
    priority,
  }));
}
