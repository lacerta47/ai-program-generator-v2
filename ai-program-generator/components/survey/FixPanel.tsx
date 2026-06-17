'use client';

import { Wrench } from 'lucide-react';
import { QUICK_FIXES } from '@/lib/survey/fixes';
import Button from '@/components/ui/Button';
import Chip, { CHIP_COLORS } from '@/components/ui/Chip';
import { TextArea } from '@/components/ui/Field';

/** 결과 화면의 '고치기' 패널 — 빠른 수정 칩(다중) + 직접 입력 + 한 번에 고치기 버튼. */
export default function FixPanel({
  picks,
  onTogglePick,
  text,
  onTextChange,
  onFix,
}: {
  picks: string[];
  onTogglePick: (id: string) => void;
  text: string;
  onTextChange: (value: string) => void;
  onFix: () => void;
}) {
  const nothing = picks.length === 0 && !text.trim();

  return (
    <section className="mt-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <h3 className="text-[18px]">고치고 싶은 곳이 있나요?</h3>
      <p className="mt-0.5 text-[14px] text-muted">고를 수 있는 만큼 고르고, 더 하고 싶은 말은 직접 적어요</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_FIXES.map((f, i) => (
          <Chip
            key={f.id}
            color={CHIP_COLORS[i % CHIP_COLORS.length]}
            active={picks.includes(f.id)}
            onClick={() => onTogglePick(f.id)}
          >
            <span aria-hidden>{f.icon}</span> {f.label}
          </Chip>
        ))}
      </div>

      <div className="mt-3">
        <TextArea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="직접 말할래요 — 예: 점수가 보이게 해줘"
          maxLength={2000}
          aria-label="직접 수정 요청 입력"
        />
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={onFix}
        disabled={nothing}
        className="mt-3 w-full"
      >
        <Wrench size={20} aria-hidden /> 이대로 고쳐줘!
      </Button>
    </section>
  );
}
