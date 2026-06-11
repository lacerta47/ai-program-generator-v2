import type { Metadata } from 'next';
import { Jua, Gowun_Dodum } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';

const jua = Jua({ weight: '400', subsets: ['latin'], variable: '--font-jua', display: 'swap' });
const gowun = Gowun_Dodum({ weight: '400', subsets: ['latin'], variable: '--font-gowun', display: 'swap' });

export const metadata: Metadata = {
  title: 'AI 프로그램 생성기',
  description: '계획서를 쓰면 AI가 프로그램을 만들어줘요',
};

// 하이드레이션 전에 테마 클래스를 적용해 깜빡임(FOUC) 방지
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // 테마 스크립트가 하이드레이션 전에 .dark를 붙이므로 html 속성 경고는 억제
    <html lang="ko" suppressHydrationWarning className={`${jua.variable} ${gowun.variable}`}>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
