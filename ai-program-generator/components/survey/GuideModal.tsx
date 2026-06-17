'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Wand2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

// 페이지마다 파스텔 분위기를 바꿔 아기자기하게
const ACCENTS = ['bg-brand-soft', 'bg-mint-soft', 'bg-sunshine-soft'];
const TOTAL = 3;

// 둥둥 떠다니는 모션(전역 keyframes 재사용; prefers-reduced-motion 가드는 globals.css가 처리)
const floatA = (dur: number, delay = 0): React.CSSProperties => ({
  animation: `float-a ${dur}s ease-in-out ${delay}s infinite`,
});
const floatB = (dur: number, delay = 0): React.CSSProperties => ({
  animation: `float-b ${dur}s ease-in-out ${delay}s infinite`,
});

/** /easy(골라서 만들기) 가이드 — 3장 캐러셀. 첫 방문 자동 + 도움말 버튼 재오픈. */
export default function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [page, setPage] = useState(0);
  // 재오픈할 땐 항상 1장부터
  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  const last = page === TOTAL - 1;

  return (
    <Modal open={open} onClose={onClose} label="골라서 만들기 안내" className="max-w-xl p-0">
      <button
        onClick={onClose}
        aria-label="닫기"
        className="press absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
      >
        <X size={20} aria-hidden />
      </button>

      <div className={`rounded-t-[22px] px-6 pb-7 pt-10 ${ACCENTS[page]}`}>
        {page === 0 && <PageThink />}
        {page === 1 && <PageChoose />}
        {page === 2 && <PageMake />}
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className={`press inline-flex items-center gap-1 text-[15px] text-muted hover:text-ink ${
            page === 0 ? 'invisible' : ''
          }`}
        >
          <ArrowLeft size={18} aria-hidden /> 이전
        </button>

        <div className="flex items-center gap-2" aria-hidden>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              className={`h-2.5 rounded-full transition-all duration-200 ${
                i === page ? 'w-7 bg-brand' : 'w-2.5 bg-line'
              }`}
            />
          ))}
        </div>

        {last ? (
          <Button variant="primary" onClick={onClose}>
            <Wand2 size={18} aria-hidden /> 시작하기!
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setPage((p) => Math.min(TOTAL - 1, p + 1))}>
            다음 <ArrowRight size={18} aria-hidden />
          </Button>
        )}
      </div>
    </Modal>
  );
}

// 1장 — 생각하기
function PageThink() {
  const pill = 'rounded-full border-2 border-line bg-surface px-4 py-2 text-[16px] font-medium';
  return (
    <div className="anim-pop-in text-center">
      <div className="mb-5 flex items-end justify-center gap-3">
        <span className={pill} style={floatB(3.4)} aria-hidden>
          🎨 그림판
        </span>
        <span className="text-[52px] leading-none" style={floatA(3.0)} aria-hidden>
          💭
        </span>
        <span className={pill} style={floatA(3.8, 0.5)} aria-hidden>
          ❓ 퀴즈
        </span>
      </div>
      <h2 className="font-display text-[27px] text-ink">무엇을 만들지 떠올려요</h2>
      <p className="mx-auto mt-2 max-w-sm text-[17px] text-muted">
        그림판? 게임? 퀴즈? 만들고 싶은 걸 머릿속에 그려봐요
      </p>
      <p className="mx-auto mt-5 max-w-md rounded-[var(--r-md)] bg-surface/70 px-4 py-3 text-[16px] leading-relaxed text-ink">
        프로그램은 작은 선택들이 모여서 만들어져요.
        <br />
        글로 안 써도 돼요 — 그냥 <b>고르면</b> 돼요!
      </p>
    </div>
  );
}

// 2장 — 골라보기
function PageChoose() {
  const bullets = [
    { icon: '🟢', text: '여러 개 골라도 되는 단계도 있어요' },
    { icon: '🎲', text: '잘 모르겠으면 “아무거나 좋아!” — AI가 골라줘요' },
    { icon: '🤖', text: '급하면 “나머지는 AI가” 한 번에' },
    { icon: '🧺', text: '왼쪽 “내가 고른 것”에서 언제든 다시 골라요' },
  ];
  return (
    <div className="anim-pop-in">
      <h2 className="text-center font-display text-[27px] text-ink">하나씩 골라요</h2>
      <p className="mt-2 text-center text-[17px] text-muted">마음에 드는 카드를 톡톡 눌러요</p>

      <div className="mx-auto mt-5 flex max-w-sm items-center justify-center gap-2.5">
        <span
          className="rounded-[var(--r-md)] border-2 border-line bg-surface px-4 py-3 text-[16px]"
          style={floatA(3.2)}
        >
          🐶 강아지
        </span>
        <span
          className="rounded-[var(--r-md)] border-2 border-brand bg-surface px-4 py-3 text-[16px] font-medium text-brand-strong dark:text-brand"
          style={floatB(3.0, 0.3)}
        >
          🐱 고양이 ✓
        </span>
        <span
          className="rounded-[var(--r-md)] border-2 border-line bg-surface px-4 py-3 text-[16px]"
          style={floatA(3.6, 0.6)}
        >
          🐰 토끼
        </span>
      </div>

      <div className="stagger mx-auto mt-5 flex max-w-md flex-col gap-2">
        {bullets.map((b) => (
          <div
            key={b.text}
            className="flex items-center gap-3 rounded-[var(--r-md)] bg-surface/70 px-4 py-2.5"
          >
            <span className="text-[24px] leading-none" aria-hidden>
              {b.icon}
            </span>
            <span className="text-[15.5px] text-ink">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3장 — 만들어지는 과정
function PageMake() {
  return (
    <div className="anim-pop-in text-center">
      <h2 className="font-display text-[27px] text-ink">AI가 뚝딱 만들어요</h2>
      <p className="mt-2 text-[17px] text-muted">고른 게 모여서 진짜 프로그램이 돼요!</p>

      <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3">
        <Stage emoji="🧺" label="내 선택들" />
        <ArrowRight className="shrink-0 text-muted" size={22} aria-hidden />
        <Stage emoji="🤖" label="AI가 뚝딱" floatStyle={floatB(2.6)} />
        <ArrowRight className="shrink-0 text-muted" size={22} aria-hidden />
        <Stage emoji="🎉" label="완성!" />
      </div>

      <p className="mx-auto mt-6 max-w-md rounded-[var(--r-md)] bg-surface/70 px-4 py-3 text-[16px] leading-relaxed text-ink">
        진짜 프로그래머도 큰 생각을 <b>작은 조각</b>으로 나눠서 만들어요. 여러분도 똑같이 하고 있는
        거예요!
      </p>
    </div>
  );
}

function Stage({
  emoji,
  label,
  floatStyle,
}: {
  emoji: string;
  label: string;
  floatStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex w-[84px] flex-col items-center gap-1.5 rounded-[var(--r-md)] border-2 border-line bg-surface px-2 py-3">
      <span className="text-[38px] leading-none" style={floatStyle} aria-hidden>
        {emoji}
      </span>
      <span className="text-[14px] font-medium text-ink">{label}</span>
    </div>
  );
}
