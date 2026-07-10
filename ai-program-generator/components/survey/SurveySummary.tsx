'use client';

import { useState } from 'react';
import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';
import { ROLES } from '@/lib/survey/roles';
import { CONCEPT_BY_KEY } from '@/lib/edu/concepts';

export default function SurveySummary({
  type,
  steps,
  answers,
  currentStepId,
  onEditType,
  onEditStep,
}: {
  type: ProgramType;
  steps: SurveyStep[]; // 현재 노출 단계
  answers: SurveyAnswers;
  currentStepId?: string;
  onEditType?: () => void;
  onEditStep?: (index: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const labelOf = (step: SurveyStep): string => {
    const a = answers[step.id];
    if (a === AI_PICK) return '아무거나 🎲';
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    return step.options
      .filter((o) => ids.includes(o.id))
      .map((o) => o.label)
      .join(', ');
  };

  return (
    <div className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <p className="text-[14px] font-medium text-muted">🧺 내가 고른 것</p>
      <p className="mb-3 text-[12px] text-muted">눌러서 다시 고를 수 있어요</p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onEditType}
          className="press flex items-center gap-1.5 rounded-[var(--r-md)] bg-brand-soft px-3 py-2 text-left text-[14px] font-medium text-brand-strong dark:text-brand"
        >
          <span aria-hidden>{type.icon}</span> {type.label}
        </button>
        {steps.map((s, i) => {
          const v = labelOf(s);
          const active = s.id === currentStepId;
          const role = s.role ? ROLES[s.role] : undefined;
          const showRole = !!role && !!v; // 답한 항목 + 역할 있을 때만
          const open = openId === s.id;
          const concept = role?.concept ? CONCEPT_BY_KEY[role.concept] : undefined;
          const ConceptIcon = concept?.icon;
          return (
            <div key={s.id}>
              <div className="flex items-stretch gap-1.5">
                <button
                  onClick={() => onEditStep?.(i)}
                  className={`press flex-1 rounded-[var(--r-md)] px-3 py-2 text-left text-[14px] ${
                    active
                      ? 'border-2 border-brand bg-brand-soft/50 text-ink'
                      : v
                        ? 'bg-surface-2 text-ink hover:bg-brand-soft/40'
                        : 'border-2 border-dashed border-line text-muted hover:border-brand/40'
                  }`}
                >
                  {showRole && (
                    <span className="mr-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                      {role!.label}
                    </span>
                  )}
                  {v || s.question}
                </button>
                {showRole && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(open ? null : s.id);
                    }}
                    aria-expanded={open}
                    aria-label={`${role!.label} 역할 설명 ${open ? '닫기' : '보기'}`}
                    className={`press grid w-9 shrink-0 place-items-center rounded-[var(--r-md)] border-2 text-[15px] ${
                      open
                        ? 'border-brand bg-brand-soft text-brand-strong dark:text-brand'
                        : 'border-line text-muted hover:border-brand/40'
                    }`}
                  >
                    ⓘ
                  </button>
                )}
              </div>
              {showRole && open && (
                <div className="anim-pop-in mt-1.5 rounded-[var(--r-md)] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink">
                  <p>{s.roleHint ?? role!.hint}</p>
                  {concept && ConceptIcon && (
                    <span
                      className={`anim-pop-in mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${concept.soft}`}
                    >
                      <ConceptIcon size={13} aria-hidden /> 이건 '{concept.label}' 개념이에요
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
