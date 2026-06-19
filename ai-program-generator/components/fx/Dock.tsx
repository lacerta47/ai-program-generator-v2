'use client';

import { useRef } from 'react';

export interface DockItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

// 커서와의 거리로 타일을 키우는 macOS dock 느낌(무의존). 값은 살짝 보수적으로.
const RANGE = 110; // px — 영향 범위
const MAX_SCALE = 1.3; // 커서 바로 위 타일 최대 배율

/** 가벼운 자체 구현 dock. prefers-reduced-motion이면 확대 안 함. compact면 살짝 작게(툴팁 크기는 유지). */
export default function Dock({ items, compact = false }: { items: DockItem[]; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  const reduce = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function magnify(clientX: number) {
    if (reduce()) return;
    ref.current?.querySelectorAll<HTMLElement>('[data-tile]').forEach((t) => {
      const r = t.getBoundingClientRect();
      const d = Math.abs(clientX - (r.left + r.width / 2));
      const s = d < RANGE ? 1 + (MAX_SCALE - 1) * (1 - d / RANGE) : 1;
      t.style.transform = `scale(${s})`;
    });
  }
  function reset() {
    ref.current?.querySelectorAll<HTMLElement>('[data-tile]').forEach((t) => {
      t.style.transform = '';
    });
  }

  return (
    <div
      ref={ref}
      onMouseMove={(e) => magnify(e.clientX)}
      onMouseLeave={reset}
      className={`flex items-center rounded-full border-2 border-line bg-surface/80 backdrop-blur-sm ${
        compact ? 'gap-1.5 px-2 py-1' : 'gap-2.5 px-2.5 py-1.5'
      }`}
    >
      {items.map((it) => {
        const tile = (
          <span
            data-tile
            className={`grid place-items-center rounded-full text-ink transition-transform duration-150 ease-out hover:bg-brand-soft hover:text-brand-strong dark:hover:text-brand ${
              compact ? 'h-9 w-9' : 'h-11 w-11'
            }`}
          >
            {it.icon}
          </span>
        );
        return (
          <span key={it.key} className="group/d relative flex flex-col items-center">
            {it.href ? (
              <a href={it.href} aria-label={it.label} className="press block">
                {tile}
              </a>
            ) : (
              <button type="button" onClick={it.onClick} aria-label={it.label} className="press block">
                {tile}
              </button>
            )}
            <span className="pointer-events-none absolute top-full z-10 mt-3 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[12.5px] font-medium text-bg opacity-0 transition-opacity duration-150 group-hover/d:opacity-100">
              {it.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
