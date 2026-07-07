'use client';

// 생성물의 로직을 저학년 쉬운말로 보여주는 카드(교육 Phase 2, #1 로직 오버레이 + #2 개념 배지).
// logicSummary("① … ② … ③ 만약 …")는 Phase 0 저장값을 표시. 개념 배지는 code가 있으면
// 정적 분석(detectConcepts, 코드 사실 기반 — 구버전 글도 소급)이 우선, 없으면 conceptTags 폴백.
// 마커(①②③)가 있으면 스텝으로 쪼개고, 없으면 통짜로. 로직·개념 둘 다 없으면 안 그린다.

import { useMemo } from 'react';
import type { GeneratedCode } from '@/lib/ai/types';
import { detectConcepts } from '@/lib/edu/detectConcepts';
import ConceptBadges, { hasKnownConcepts } from './ConceptBadges';

/** "① … ② … ③ …" → 스텝 배열. 동그라미 숫자(①~⑩) 앞에서 분할, 마커 없으면 [원문]. */
function splitSteps(text: string): string[] {
  const parts = text
    .split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

export default function LogicCard({
  logicSummary,
  conceptTags,
  code,
  className = '',
}: {
  logicSummary?: string;
  /** 저장된 태그(Gemini) — code가 없을 때만 폴백으로 사용 */
  conceptTags?: string[];
  /** 생성 코드 — 있으면 배지를 코드에서 직접 탐지(표시의 진실원천) */
  code?: GeneratedCode;
  className?: string;
}) {
  const tags = useMemo(() => (code ? detectConcepts(code) : conceptTags), [code, conceptTags]);
  const text = logicSummary?.trim();
  const hasConcepts = hasKnownConcepts(tags);
  if (!text && !hasConcepts) return null;
  const steps = text ? splitSteps(text) : [];

  return (
    <section
      className={`rounded-[var(--r-md)] border-2 border-mint/30 bg-mint-soft px-4 py-3 ${className}`}
      aria-label="이 프로그램이 움직이는 방법"
    >
      <p className="mb-1.5 flex items-center gap-1.5 text-[14.5px] font-medium text-mint-ink">
        <span aria-hidden>🧩</span> 이 프로그램은 이렇게 움직여요
      </p>
      {steps.length > 1 ? (
        <ul className="flex flex-col gap-1">
          {steps.map((s, i) => (
            <li key={i} className="text-[14.5px] leading-relaxed text-mint-ink">
              {s}
            </li>
          ))}
        </ul>
      ) : text ? (
        <p className="text-[14.5px] leading-relaxed text-mint-ink">{text}</p>
      ) : null}
      {hasConcepts && <ConceptBadges tags={tags} className="mt-2.5" />}
    </section>
  );
}
