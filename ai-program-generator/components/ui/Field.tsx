'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

const baseCls =
  'w-full rounded-[var(--r-md)] border-2 border-line bg-surface px-4 text-[16px] text-ink outline-none transition-[border-color,box-shadow,transform] duration-150 placeholder:text-muted/80 focus:border-brand focus:shadow-[0_0_0_4px_var(--brand-soft)] dark:bg-surface-2';

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
      <span className="inline-flex items-center gap-1 text-[15px] font-medium text-muted">
        {text} {required && <span className="text-coral">*</span>}
        {tip && <HelpTip>{tip}</HelpTip>}
      </span>
      {children}
    </label>
  );
}

export function HelpTip({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // 바깥 클릭/Escape로만 닫기 — blur 기반 닫기는 label의 포커스 위임과 충돌해
  // "닫혔다가 곧바로 다시 열리는" 현상을 일으킨다.
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    // preventDefault: label 활성화(입력란 포커스 이동)가 말풍선 클릭마다 일어나지 않도록
    <span ref={wrapRef} className="relative inline-flex" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        aria-label="작성 도움말 보기"
        aria-expanded={pinned}
        onClick={() => setPinned((p) => !p)}
        className={`grid h-6 w-6 place-items-center rounded-full transition-colors ${
          pinned
            ? 'bg-brand text-brand-ink'
            : 'text-muted/70 hover:bg-brand-soft hover:text-brand-strong dark:hover:text-brand'
        }`}
      >
        <CircleHelp size={15} />
      </button>
      <span
        role="tooltip"
        className={`anim-pop-in absolute left-0 top-full z-20 mt-1.5 w-72 max-w-[78vw] rounded-[var(--r-md)] border-2 border-brand/60 bg-surface p-3.5 text-[13.5px] font-normal leading-relaxed text-ink shadow-[0_10px_30px_oklch(0.2_0.02_285/0.35)] ${
          pinned ? 'block' : 'hidden'
        }`}
      >
        {children}
      </span>
    </span>
  );
}
