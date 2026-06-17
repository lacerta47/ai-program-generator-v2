'use client';

import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';

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
          return (
            <button
              key={s.id}
              onClick={() => onEditStep?.(i)}
              className={`press rounded-[var(--r-md)] px-3 py-2 text-left text-[14px] ${
                active
                  ? 'border-2 border-brand bg-brand-soft/50 text-ink'
                  : v
                    ? 'bg-surface-2 text-ink hover:bg-brand-soft/40'
                    : 'border-2 border-dashed border-line text-muted hover:border-brand/40'
              }`}
            >
              {v || s.question}
            </button>
          );
        })}
      </div>
    </div>
  );
}
