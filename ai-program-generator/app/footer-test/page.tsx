import { Geist_Mono } from 'next/font/google';
import LandingFooter from '@/components/landing/LandingFooter';

// 시안 전용: Geist Mono를 이 페이지에만 로드. 채택 시 layout으로 옮긴다.
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

/**
 * 푸터 디자인 시안(메인 미반영). 메인처럼 히어로 → 빈 여백(void) → 한참 내리면 숨은 푸터 등장.
 * 실제 메인(app/page.tsx)은 그대로 두고 여기서만 미리보기.
 */
export default function FooterTestPage() {
  return (
    <div className={geistMono.variable}>
      {/* 히어로 자리(시안용 placeholder — 실제 메인은 LUN 워드마크) */}
      <section className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-wordmark text-[120px] leading-none text-ink sm:text-[200px]">LUN</h1>
        <p className="text-[13px] text-muted/70">↓ 한참 내려보세요 (푸터 시안)</p>
      </section>

      {/* 발견까지의 빈 여백 */}
      <div className="h-[60vh]" aria-hidden />

      <LandingFooter />
    </div>
  );
}
