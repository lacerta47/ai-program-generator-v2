'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp } from 'lucide-react';

// 라벨과 동일한 굵기(font-medium)로 맞춰 입력 글씨도 또렷하게 — 둘 다 Gowun Dodum
const baseCls =
  'w-full rounded-[var(--r-md)] border-2 border-line bg-surface px-4 text-[16px] font-medium text-ink outline-none transition-[border-color,box-shadow,transform] duration-150 placeholder:text-muted/80 placeholder:font-normal focus:border-brand focus:shadow-[0_0_0_4px_var(--brand-soft)] dark:bg-surface-2';

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = '', ...props }, ref) {
    return <input ref={ref} className={`min-h-12 ${baseCls} ${className}`} {...props} />;
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = '', ...props }, ref) {
  return (
    <textarea ref={ref} className={`min-h-[72px] resize-y py-3 ${baseCls} ${className}`} {...props} />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', ...props }, ref) {
    return <select ref={ref} className={`min-h-12 cursor-pointer ${baseCls} ${className}`} {...props} />;
  },
);

export function Label({
  text,
  required,
  tip,
  children,
}: {
  text: string;
  required?: boolean;
  /** 작성 팁 — 라벨 옆 ? 아이콘에 호버하거나 누르면 말풍선으로 표시 */
  tip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="inline-flex items-center gap-1 font-display text-[20px] font-normal text-muted">
        {text} {required && <span className="text-coral">*</span>}
        {tip && <HelpTip>{tip}</HelpTip>}
      </span>
      {children}
    </label>
  );
}

export function HelpTip({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false);
  // 말풍선을 body로 portal해 fixed로 띄운다(미리보기 iframe·패널 등 어떤 칸보다 위에 보이게).
  const [pos, setPos] = useState<React.CSSProperties | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);

  // 바깥 클릭/Escape로 닫기 + 스크롤/리사이즈 시 닫기(고정 위치 어긋남 방지).
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    const onMove = () => setPinned(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [pinned]);

  function toggle() {
    if (pinned) {
      setPinned(false);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const W = 288; // w-72
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
    // 아래 공간이 부족하면 위로 펼침(아이콘 위쪽에 bottom 기준 고정 — transform 없이 anim과 충돌 방지)
    const openUp = window.innerHeight - r.bottom < 280;
    setPos({
      position: 'fixed',
      left,
      ...(openUp ? { bottom: window.innerHeight - r.top + 8 } : { top: r.bottom + 8 }),
    });
    setPinned(true);
  }

  return (
    // preventDefault: label 활성화(입력란 포커스 이동)가 말풍선 클릭마다 일어나지 않도록
    <span className="relative inline-flex" onClick={(e) => e.preventDefault()}>
      <button
        ref={btnRef}
        type="button"
        aria-label="작성 도움말 보기"
        aria-expanded={pinned}
        onClick={toggle}
        className={`-my-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
          pinned
            ? 'bg-brand text-brand-ink'
            : 'text-muted/70 hover:bg-brand-soft hover:text-brand-strong dark:hover:text-brand'
        }`}
      >
        <CircleHelp size={17} />
      </button>
      {pinned &&
        pos &&
        createPortal(
          <span
            ref={popRef}
            role="tooltip"
            style={pos}
            className="anim-pop-in z-[60] block w-72 max-w-[80vw] rounded-[var(--r-md)] border-2 border-brand/60 bg-surface p-3.5 text-[13.5px] font-normal leading-relaxed text-ink shadow-[0_10px_30px_oklch(0.2_0.02_285/0.35)]"
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
