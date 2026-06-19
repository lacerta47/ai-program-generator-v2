import type { Metadata } from 'next';
import { Jua, Gowun_Dodum, Chakra_Petch, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { ConfirmProvider } from '@/components/ui/ConfirmProvider';

const jua = Jua({ weight: '400', subsets: ['latin'], variable: '--font-jua', display: 'swap' });
const gowun = Gowun_Dodum({ weight: '400', subsets: ['latin'], variable: '--font-gowun', display: 'swap' });
// LUN 워드마크 글꼴(각진 테크) — 랜딩·헤더 로고 공용
const chakra = Chakra_Petch({ weight: '700', subsets: ['latin'], variable: '--font-wordmark', display: 'swap' });
// 푸터 등 라틴·숫자 정제 톤(랜딩 푸터 전용 액센트)
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'LUN — Logic Unfold Next',
  description: '논리를 펼치면, 마법이 시작돼요. 계획을 쓰거나 골라서 AI로 프로그램을 만들어요.',
};

// 하이드레이션 전에 테마 클래스를 적용해 깜빡임(FOUC) 방지
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // 테마 스크립트가 하이드레이션 전에 .dark를 붙이므로 html 속성 경고는 억제
    <html lang="ko" suppressHydrationWarning className={`${jua.variable} ${gowun.variable} ${chakra.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
