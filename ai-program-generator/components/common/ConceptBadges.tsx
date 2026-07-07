'use client';

// 작품이 사용한 컴퓨팅 개념(conceptTags)을 색상 배지로 표시(교육 Phase 2, #2 개념 태그).
// Phase 0에서 이미 생성·저장되는 conceptTags(순서·조건·반복·입력·출력 부분집합)를 표시만 한다.
// 배지를 누르면 그 개념의 저학년 설명이 아래에 열린다(같은 배지 다시 누르면 닫힘).
// 이모지 장식 대신 lucide 아이콘 사용(프로젝트 정책). 알 수 없는 태그는 무시, 고정 순서·중복 제거.
// Tailwind는 런타임 조합 클래스를 못 뽑으므로 색 클래스는 전부 리터럴로 매핑한다.

import { useState } from 'react';
import { ListOrdered, GitBranch, Repeat, Keyboard, MessageSquare, type LucideIcon } from 'lucide-react';

interface ConceptMeta {
  icon: LucideIcon;
  label: string;
  /** 저학년 쉬운말 설명(클릭 시 표시) */
  desc: string;
  /** 배지 pill 색(테두리+글자, 바탕은 surface로 카드색과 구분) */
  badge: string;
  /** 설명 패널 색(soft 바탕+ink 글자) */
  panel: string;
}

const CONCEPT_META: Record<string, ConceptMeta> = {
  순서: {
    icon: ListOrdered,
    label: '순서',
    desc: '일이 정한 차례대로 하나씩 일어나요. 첫째 → 둘째 → 셋째!',
    badge: 'border-brand/50 text-brand-strong dark:text-brand',
    panel: 'bg-brand-soft text-brand-strong dark:text-brand',
  },
  조건: {
    icon: GitBranch,
    label: '조건',
    desc: "'만약 ~하면 ~해요'처럼, 상황에 따라 다른 일이 일어나요.",
    badge: 'border-coral/60 text-coral-ink',
    panel: 'bg-coral-soft text-coral-ink',
  },
  반복: {
    icon: Repeat,
    label: '반복',
    desc: '같은 일을 여러 번 되풀이해요. 매번 다시 만들지 않아도 돼요!',
    badge: 'border-grape/60 text-grape-ink',
    panel: 'bg-grape-soft text-grape-ink',
  },
  입력: {
    icon: Keyboard,
    label: '입력',
    desc: '내가 프로그램에게 알려주는 것이에요 — 누르기, 적기, 고르기!',
    badge: 'border-sunshine/70 text-sunshine-ink',
    panel: 'bg-sunshine-soft text-sunshine-ink',
  },
  출력: {
    icon: MessageSquare,
    label: '출력',
    desc: '프로그램이 나에게 보여주거나 들려주는 것이에요.',
    badge: 'border-mint/60 text-mint-ink',
    panel: 'bg-mint-soft text-mint-ink',
  },
};
const ORDER = ['순서', '조건', '반복', '입력', '출력'];

/** conceptTags에 알려진 개념이 하나라도 있으면 true (부모의 렌더 가드용). */
export function hasKnownConcepts(tags?: string[]): boolean {
  return !!tags && tags.some((t) => t in CONCEPT_META);
}

export default function ConceptBadges({ tags, className = '' }: { tags?: string[]; className?: string }) {
  const uniq = ORDER.filter((c) => tags?.includes(c)); // 중복 제거 + 고정 순서
  const [open, setOpen] = useState<string | null>(null);
  if (uniq.length === 0) return null;
  const openMeta = open ? CONCEPT_META[open] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5" aria-label="이 작품이 사용한 개념 (누르면 설명이 나와요)">
        {uniq.map((c) => {
          const { icon: Icon, label, badge } = CONCEPT_META[c];
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
          className={`anim-pop-in mt-2 rounded-[var(--r-md)] px-3 py-2 text-[13.5px] leading-relaxed ${openMeta.panel}`}
        >
          <strong>{openMeta.label}</strong> — {openMeta.desc}
        </p>
      )}
    </div>
  );
}
