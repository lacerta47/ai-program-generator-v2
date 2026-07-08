'use client';

// 작품이 사용한 컴퓨팅 개념을 색상 배지로 표시(교육 Phase 2, #2). 배지를 누르면 저학년 설명이 열림.
// 개념 메타(아이콘·색·설명)는 lib/edu/concepts.ts를 공유(도감과 동일 소스). 고정 순서·중복 제거.

import { useState } from 'react';
import { CONCEPT_ORDER, CONCEPT_BY_KEY } from '@/lib/edu/concepts';

export { hasKnownConcepts } from '@/lib/edu/concepts';

export default function ConceptBadges({ tags, className = '' }: { tags?: string[]; className?: string }) {
  const uniq = CONCEPT_ORDER.filter((c) => tags?.includes(c)); // 중복 제거 + 고정 순서
  const [open, setOpen] = useState<string | null>(null);
  if (uniq.length === 0) return null;
  const openMeta = open ? CONCEPT_BY_KEY[open] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5" aria-label="이 작품이 사용한 개념 (누르면 설명이 나와요)">
        {uniq.map((c) => {
          const { icon: Icon, label, badge } = CONCEPT_BY_KEY[c];
          const active = open === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setOpen(active ? null : c)}
              aria-expanded={active}
              aria-label={`${label} 개념 설명 ${active ? '닫기' : '보기'}`}
              className={`press inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-[12.5px] font-medium ${badge} ${
                active ? 'ring-2 ring-current/40' : ''
              }`}
            >
              <Icon size={13} aria-hidden /> {label}
            </button>
          );
        })}
      </div>
      {openMeta && (
        <p
          role="note"
          className={`anim-pop-in mt-2 rounded-[var(--r-md)] px-3 py-2 text-[13.5px] leading-relaxed ${openMeta.soft}`}
        >
          <strong>{openMeta.label}</strong> — {openMeta.desc}
        </p>
      )}
    </div>
  );
}
