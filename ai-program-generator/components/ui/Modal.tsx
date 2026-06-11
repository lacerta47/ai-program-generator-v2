'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 스크린리더용 대화상자 이름 */
  label: string;
  /** 내용 카드 추가 클래스 (보통 max-w-* p-*) */
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 공용 모달: portal(document.body) + 백드롭 + Esc 닫기 + 포커스 트랩 + 배경 스크롤 잠금.
 * (portal인 이유: 헤더의 backdrop-blur가 fixed 기준점을 가로채는 함정 — CLAUDE.md 참조)
 */
export default function Modal({ open, onClose, label, className = 'max-w-sm p-6', children }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // 포커스 트랩: Tab이 모달 밖으로 못 나가게
      const items = [...(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !cardRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !cardRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    // 첫 포커스: 입력란 우선, 없으면 닫기 외 첫 버튼, 그것도 없으면 카드 자체
    const t = window.setTimeout(() => {
      const card = cardRef.current;
      if (!card) return;
      const target =
        card.querySelector<HTMLElement>('input, select, textarea') ??
        [...card.querySelectorAll<HTMLElement>('button')].find((b) => b.getAttribute('aria-label') !== '닫기') ??
        card;
      target.focus();
    }, 30);

    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[oklch(0.2_0.02_285/0.55)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`anim-pop relative max-h-[92vh] w-full overflow-y-auto rounded-[24px] border-2 border-line bg-surface outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
