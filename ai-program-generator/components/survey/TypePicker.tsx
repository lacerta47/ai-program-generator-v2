'use client';

import type { ProgramType } from '@/lib/survey/types';

export default function TypePicker({
  types,
  onPick,
}: {
  types: ProgramType[];
  onPick: (type: ProgramType) => void;
}) {
  return (
    <div className="anim-pop-in">
      <h2 className="text-center text-[26px]">무엇을 만들까?</h2>
      <p className="mt-1 mb-6 text-center text-[16px] text-muted">만들고 싶은 걸 골라요</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="press lift flex flex-col items-center gap-2 rounded-[var(--r-lg)] border-2 border-line bg-surface p-6 hover:border-brand/60"
          >
            <span className="text-[56px] leading-none" aria-hidden>{t.icon}</span>
            <span className="text-[18px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
