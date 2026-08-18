import type { Metadata } from 'next';
import { Jua, Gowun_Dodum, Chakra_Petch, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import VisitBeacon from '@/components/common/VisitBeacon';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmProvider';

const jua = Jua({ weight: '400', subsets: ['latin'], variable: '--font-jua', display: 'swap' });
const gowun = Gowun_Dodum({ weight: '400', subsets: ['latin'], variable: '--font-gowun', display: 'swap' });
// LUN 워드마크 글꼴(각진 테크) — 랜딩·헤더 로고 공용
const chakra = Chakra_Petch({ weight: '700', subsets: ['latin'], variable: '--font-wordmark', display: 'swap' });
// 푸터 등 라틴·숫자 정제 톤(랜딩 푸터 전용 액센트)
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

// metadataBase — OG 태그 등의 절대 URL 기준. 커스텀 도메인 반영(NEXT_PUBLIC_APP_ORIGIN).
const SITE = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://eduai-lun.co.kr';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // 한글 음차(에듀에이아이룬·룬)를 제목·설명에 자연스럽게 넣어 한글 브랜드 검색과 연결한다.
  title: 'LUN(룬) — 초등 저학년 AI 코딩',
  description:
    '에듀에이아이룬(LUN·룬)은 초등 저학년을 위한 AI 코딩 놀이터예요. 논리를 펼치면, 마법이 시작돼요. 계획을 쓰거나 골라서 AI로 프로그램을 만들어요.',
  openGraph: {
    title: 'LUN(룬) — 논리를 펼치면, 마법이 시작돼요',
    description: '에듀에이아이룬(LUN·룬) — 초등 저학년을 위한 AI 코딩 놀이터. 계획을 쓰거나 골라서 나만의 프로그램을 만들어요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'LUN',
  },
  // 네이버 서치어드바이저 사이트 소유확인 — <head>에 meta 태그로 출력됨
  other: {
    'naver-site-verification': '64666ca46d21ec7e7f1e91a6235c5919f38768e0',
  },
};

// 하이드레이션 전에 테마 클래스를 적용해 깜빡임(FOUC) 방지
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

// 구조화 데이터(JSON-LD) — 브랜드 한글 음차를 alternateName으로 알려 "에듀에이아이룬"·"룬" 검색과 연결.
const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LUN',
  alternateName: ['룬', '에듀에이아이룬', 'eduai-lun'],
  url: SITE,
  description: '에듀에이아이룬(LUN·룬) — 초등 저학년을 위한 AI 코딩 놀이터.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // 테마 스크립트가 하이드레이션 전에 .dark를 붙이므로 html 속성 경고는 억제
    <html lang="ko" suppressHydrationWarning className={`${jua.variable} ${gowun.variable} ${chakra.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <VisitBeacon />
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
