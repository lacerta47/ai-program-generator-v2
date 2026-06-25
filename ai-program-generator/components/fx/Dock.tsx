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

/**
 * 가벼운 자체 구현 dock. prefers-reduced-motion이면 확대 안 함.
 * - 아이콘은 둥근 pill 안에, 한국어 라벨은 pill **바깥**(아래 행)에 표시.
 * - `revealed`: 라벨 행을 보이게 + `primaryKeys` 항목(아이콘·라벨)을 브랜드색으로 강조.
 *   (랜딩에서 일정 시간 무조작 시 켜서 저학년에게 첫 행동을 안내)
 * - 라벨 행은 항상 자리(높이)를 차지하고 opacity만 전환 → 레이아웃 점프 없음.
 */
export default function Dock({
  items,
  compact = false,
  revealed = false,
  primaryKeys = [],
}: {
  items: DockItem[];
  compact?: boolean;
  revealed?: boolean;
  primaryKeys?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pri = new Set(primaryKeys);

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
    <div ref={ref} onMouseMove={(e) => magnify(e.clientX)} onMouseLeave={reset} className={compact ? 'w-[256px]' : 'w-[276px]'}>
      <div
        className={`flex items-center rounded-full border-2 border-line bg-surface/80 backdrop-blur-sm transition-shadow duration-200 ${
          compact ? 'gap-1 px-2 py-1' : 'gap-1.5 px-2.5 py-1.5'
        } ${revealed ? 'lun-attn shadow-[0_0_0_3px_var(--brand-soft)]' : ''}`}
      >
        {items.map((it) => {
          const on = revealed && pri.has(it.key);
          const tile = (
            <span
              data-tile
              className={`grid w-full place-items-center rounded-full transition-[transform,background-color,color] duration-150 ease-out ${
                compact ? 'h-9' : 'h-11'
              } ${on ? 'bg-brand-soft text-brand' : 'text-ink hover:bg-brand-soft hover:text-brand-strong dark:hover:text-brand'}`}
            >
              {it.icon}
            </span>
          );
          return (
            <span key={it.key} className="flex-1 basis-0">
              {it.href ? (
                <a href={it.href} aria-label={it.label} className="press block">
                  {tile}
                </a>
              ) : (
                <button type="button" onClick={it.onClick} aria-label={it.label} className="press block w-full">
                  {tile}
                </button>
              )}
            </span>
          );
        })}
      </div>
      <div
        aria-hidden
        className={`mt-1.5 flex transition-opacity duration-300 ${compact ? 'gap-1 px-2' : 'gap-1.5 px-2.5'} ${
          revealed ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {items.map((it) => {
          const on = revealed && pri.has(it.key);
          return (
            <span
              key={it.key}
              className={`flex-1 basis-0 text-center text-[13px] leading-tight [word-break:keep-all] ${
                on ? 'font-medium text-brand' : 'text-muted'
              }`}
            >
              {it.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
