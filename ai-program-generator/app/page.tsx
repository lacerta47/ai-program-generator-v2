import { Chakra_Petch } from 'next/font/google';
import LandingNav from '@/components/landing/LandingNav';
import LandingGuards from '@/components/landing/LandingGuards';

// LUN 워드마크 글꼴(각진 테크 느낌)
const chakra = Chakra_Petch({ weight: '700', subsets: ['latin'] });

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LandingGuards />

      <div className="absolute right-4 top-4 z-20">
        <LandingNav />
      </div>

      {/* LUN — 반짝임 + 호버하면 아래로 확장 문구 표시 */}
      <div className="group anim-pop-in flex flex-col items-center">
        <h1 className="text-[125px] leading-none sm:text-[216px]">
          <span className={`lun-shiny ${chakra.className}`}>LUN</span>
        </h1>
        <p className="mt-3 -translate-y-1 text-[13px] font-medium uppercase tracking-[0.4em] text-brand-strong opacity-0 transition-all duration-[600ms] group-hover:translate-y-0 group-hover:opacity-100 dark:text-brand">
          Logic&nbsp;·&nbsp;Unfold&nbsp;·&nbsp;Next
        </p>
      </div>

      <footer className="absolute inset-x-0 bottom-6 text-center text-[12.5px] text-muted/60">
        논리를 펼치면, 마법이 시작돼요
      </footer>
    </main>
  );
}
