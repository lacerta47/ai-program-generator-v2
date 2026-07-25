'use client';

import type { SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';

export default function StepScreen({
  step,
  index,
  total,
  value,
  onChoose,
  canPhoto = false,
}: {
  step: SurveyStep;
  index: number; // 0-based 현재 단계
  total: number;
  value: string | string[] | undefined;
  onChoose: (optionId: string) => void; // 단일: 즉시 진행 / 다중: 토글
  /** 사진 첨부 가능 계정(학생·교사)인지 — false면 needsPhoto 옵션을 숨긴다(고르고도 못 올리는 막다른 길 방지) */
  canPhoto?: boolean;
}) {
  const selected = (id: string) =>
    Array.isArray(value) ? value.includes(id) : value === id;
  const options = step.options.filter((o) => !o.needsPhoto || canPhoto);

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
        {options.map((o) => (
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

        {/* 단일선택 단계엔 '아무거나 좋아!'(AI가 그 부분을 알아서 정함)를 자동으로 붙인다 */}
        {!step.multi && (
          <button
            onClick={() => onChoose(AI_PICK)}
            className={`press flex items-center gap-3 rounded-[var(--r-lg)] border-2 border-dashed p-4 text-left sm:col-span-2 ${
              selected(AI_PICK)
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-surface-2 hover:border-brand/50'
            }`}
          >
            <span className="text-[34px] leading-none" aria-hidden>🎲</span>
            <span className="text-[18px] font-medium">
              아무거나 좋아!{' '}
              <span className="text-[14px] font-normal text-muted">(AI가 골라줘)</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
