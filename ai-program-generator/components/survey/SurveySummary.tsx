'use client';

import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';

export default function SurveySummary({
  type,
  steps,
  answers,
}: {
  type: ProgramType;
  steps: SurveyStep[]; // 현재 노출 단계
  answers: SurveyAnswers;
}) {
  const labelOf = (step: SurveyStep): string => {
    const a = answers[step.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    const labels = step.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
    return labels.join(', ');
  };

  return (
    <div className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <p className="mb-2 text-[14px] font-medium text-muted">🧺 내가 고른 것</p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-[14px] text-brand-strong dark:text-brand">
          {type.icon} {type.label}
        </span>
        {steps.map((s) => {
          const v = labelOf(s);
          return (
            <span
              key={s.id}
              className={`rounded-full px-3 py-1 text-[14px] ${
                v ? 'bg-surface-2 text-ink' : 'border-2 border-dashed border-line text-muted'
              }`}
            >
              {v || '?'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
