'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// Geist Mono(라틴·숫자)로 "정제된 어른용" 톤. 한글은 적용 안 되고 본문 폰트로 폴백되므로
// 라벨·구조는 영문, 한글(회사 한글명)은 의도적으로 본문 폰트로 둔다.
const MONO = { fontFamily: 'var(--font-geist-mono), ui-monospace, monospace' } as const;

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Developer', href: '/about' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
];

/** 메인 하단 숨은 푸터 — 한참 스크롤하면 등장(fade-up). 회사 홍보 겸 정보. */
export default function LandingFooter() {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <footer
      ref={ref}
      className={`border-t border-line bg-surface-2/40 px-6 pb-12 pt-16 transition-all duration-700 ease-out motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100'
      }`}
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* 브랜드 + 한글 회사명 — 메인과 동일한 샤이니 워드마크 */}
        <p className="lun-shiny font-wordmark text-[30px] leading-none">LUN</p>
        <p className="mt-2 text-[13px] text-muted">아름다운교육연구소</p>

        {/* 영문 태그라인(모노) — 샘플 카피, 교체 가능 */}
        <p style={MONO} className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-muted">
          Write a plan, watch AI build it. Preview, tweak, and share your own programs.
        </p>

        {/* 링크 컬럼(영문·모노) */}
        <div className="mt-10 flex justify-center gap-16 sm:gap-24">
          {COLUMNS.map((col) => (
            <div key={col.title} className="text-left">
              <h3
                style={MONO}
                className="text-[12px] font-bold uppercase tracking-[0.15em] text-ink"
              >
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      style={MONO}
                      className="text-[13px] text-muted transition-colors hover:text-brand-strong dark:hover:text-brand"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* 구분선 + 카피라이트(모노, 전부 라틴이라 모노 룩 유지) */}
        <div className="mt-12 border-t border-line" />
        <p style={MONO} className="mt-6 text-[11px] uppercase tracking-wider text-muted/70">
          © 2026 Beautiful Edu Lab. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
