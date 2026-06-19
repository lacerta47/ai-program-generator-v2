'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Lenis from 'lenis';
import LandingFooter from './LandingFooter';
import LandingNav from './LandingNav';

/**
 * 시안: 묵직한(Lenis 관성) 스크롤 + LUN 워드마크가 스크롤을 따라 머물다(sticky)
 * 푸터에 다다르면 페이드아웃 → 푸터 fade-up 등장. 스크롤바 숨김.
 * reduced-motion이면 Lenis 끄고 네이티브 스크롤(페이드는 스크롤 연동이라 유지).
 */
export default function FooterScrollExperience() {
  const lunRef = useRef<HTMLHeadingElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const [navOpen, setNavOpen] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('hide-scrollbar');
    // 항상 최상단에서 시작(브라우저 스크롤 복원 끄고 0으로)
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 스크롤 진행도 → LUN: 내릴수록 "커지다가" 끝(페이드 직전)에 가장 크고, 마지막 구간에서 페이드아웃.
    // 스크롤 직접 연동이라 reduced-motion에도 안전.
    const onScroll = () => {
      const vh = window.innerHeight;
      const y = window.scrollY;
      // 트랙(h-[600vh])의 sticky 구간 ≈ 5vh 동안 진행도 0→1
      const p = Math.min(1, Math.max(0, y / (vh * 5)));
      if (lunRef.current) {
        const scale = 1 + p * 0.7; // 내릴수록 커짐(최대 ~1.7x) → 페이드 직전이 가장 큼
        const fadeStart = 0.9; // 마지막 10% 구간에서만 급격히 페이드
        const op = p < fadeStart ? 1 : Math.max(0, 1 - (p - fadeStart) / (1 - fadeStart));
        lunRef.current.style.transform = `scale(${scale})`;
        lunRef.current.style.opacity = String(op);
      }
      const fade = String(Math.max(0, 1 - y / (vh * 0.4)));
      if (hintRef.current) hintRef.current.style.opacity = fade;
      if (taglineRef.current) taglineRef.current.style.opacity = fade;
    };

    let lenis: Lenis | null = null;
    let raf = 0;
    if (!reduce) {
      // lerp 낮을수록 더 묵직/관성↑. wheelMultiplier로 한 번에 덜 움직이게 → "쫀쫀"
      lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.1 });
      lenis.on('scroll', onScroll);
      const loop = (t: number) => {
        lenis!.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else {
      window.addEventListener('scroll', onScroll, { passive: true });
    }
    onScroll();

    return () => {
      root.classList.remove('hide-scrollbar');
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
      if (lenis) {
        lenis.destroy();
        cancelAnimationFrame(raf);
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    };
  }, []);

  return (
    <>
      {/* 접기/펴기 토글 — 항상 우상단 고정 */}
      <button
        onClick={() => setNavOpen((o) => !o)}
        aria-label={navOpen ? '메뉴 접기' : '메뉴 펴기'}
        aria-expanded={navOpen}
        className="press fixed right-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-surface/90 text-ink backdrop-blur-sm hover:border-brand/50 hover:text-brand-strong dark:hover:text-brand"
      >
        {navOpen ? <X size={19} aria-hidden /> : <Menu size={19} aria-hidden />}
      </button>

      {/* 네비게이션(토글 왼쪽). 접으면 슬라이드+페이드아웃 */}
      <div
        className={`fixed right-[68px] top-4 z-30 transition-all duration-300 ease-out motion-reduce:transition-none ${
          navOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-3 opacity-0'
        }`}
        aria-hidden={!navOpen}
      >
        <LandingNav />
      </div>

      {/* LUN 트랙 — 긴 구간(약 3배) 동안 sticky로 머물며 커지다 페이드 */}
      <div className="relative h-[600vh]">
        <div className="sticky top-0 flex h-screen flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center">
          <h1
            ref={lunRef}
            className="text-[125px] leading-none will-change-[opacity,transform] sm:text-[216px]"
          >
            <span className="lun-shiny font-wordmark">LUN</span>
          </h1>
          <p
            ref={hintRef}
            className="-translate-y-1 text-[13px] font-medium uppercase tracking-[0.4em] text-brand-strong dark:text-brand"
          >
            Logic&nbsp;·&nbsp;Unfold&nbsp;·&nbsp;Next
          </p>
          {/* 기존 메인 하단 문구 — 초기 상태에 노출, 스크롤 시 페이드 */}
          <p ref={taglineRef} className="absolute inset-x-0 bottom-8 text-[12.5px] text-muted/60">
            논리를 펼치면, 마법이 시작돼요
          </p>
        </div>
      </div>

      <LandingFooter />
    </>
  );
}
