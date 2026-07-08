'use client';

import { Wrench } from 'lucide-react';
import Button from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';

/**
 * 결과 화면의 '고치기' 패널 — 디버깅 대화(교육 Phase 1).
 * "이렇게 되면 좋겠어요"(기대·필수) + "지금은 이래요"(실제·선택) 두 칸으로
 * 관찰·가설을 아이 스스로 언어화하게 한다. easy 탭이라 아주 쉬운 말 + 이모지 힌트.
 */
export default function FixPanel({
  want,
  onWantChange,
  actual,
  onActualChange,
  onFix,
  challenge,
}: {
  want: string;
  onWantChange: (value: string) => void;
  actual: string;
  onActualChange: (value: string) => void;
  onFix: () => void;
  /** 교육(#6) — AI가 제안하는 다음 도전. '이렇게 되면 좋겠어요' 칸의 힌트(placeholder)로만. */
  challenge?: string;
}) {
  const nothing = !want.trim();

  return (
    <section className="mt-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <h3 className="text-[18px]">고치고 싶은 곳이 있나요?</h3>
      <p className="mt-0.5 text-[14px] text-muted">어떻게 되면 좋을지 먼저 말해요. 지금 뭐가 이상한지도 알려주면 더 잘 고쳐요!</p>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-medium text-ink">✨ 이렇게 되면 좋겠어요</span>
          <TextArea
            value={want}
            onChange={(e) => onWantChange(e.target.value)}
            placeholder={challenge || '예: 정답을 맞히면 폭죽이 팡 터져요'}
            maxLength={2000}
            rows={2}
            aria-label="이렇게 되면 좋겠어요 (바라는 모습)"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-medium text-muted">😅 지금은 이래요 <span className="text-[13px] font-normal">(없으면 비워도 돼요)</span></span>
          <TextArea
            value={actual}
            onChange={(e) => onActualChange(e.target.value)}
            placeholder="예: 맞혀도 아무 일도 안 일어나요"
            maxLength={2000}
            rows={2}
            aria-label="지금은 이래요 (지금 모습, 선택)"
          />
        </label>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={onFix}
        disabled={nothing}
        className="mt-3 w-full"
      >
        <Wrench size={20} aria-hidden /> 이렇게 고쳐줘!
      </Button>
    </section>
  );
}
