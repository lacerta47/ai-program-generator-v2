'use client';

import type { SurveyStep } from '@/lib/survey/types';

export default function StepScreen({
  step,
  index,
  total,
  value,
  onChoose,
}: {
  step: SurveyStep;
  index: number; // 0-based 현재 단계
  total: number;
  value: string | string[] | undefined;
  onChoose: (optionId: string) => void; // 단일: 즉시 진행 / 다중: 토글
}) {
  const selected = (id: string) =>
    Array.isArray(value) ? value.includes(id) : value === id;

  return (
    <div className="anim-pop-in">
      {/* 진행 표시 */}
      <div className="mb-5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i <= index ? 'bg-brand' : 'bg-surface-2'}`}
          />
        ))}
        <span className="ml-2 shrink-0 text-[14px] text-muted">
          {index + 1} / {total}
        </span>
      </div>

      <h2 className="mb-5 text-[24px]">{step.question}</h2>
      {step.multi && <p className="mb-3 -mt-3 text-[14px] text-muted">여러 개 골라도 돼요</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChoose(o.id)}
            className={`press flex items-center gap-3 rounded-[var(--r-lg)] border-2 p-4 text-left ${
              selected(o.id)
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-surface hover:border-brand/50'
            }`}
          >
            {o.icon && <span className="text-[34px] leading-none" aria-hidden>{o.icon}</span>}
            <span className="text-[18px] font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
