// 생성물의 로직을 저학년 쉬운말로 보여주는 카드(교육 Phase 2, #1 로직 설명 오버레이).
// Phase 0에서 생성·저장되는 logicSummary("① … ② … ③ 만약 …")를 표시만 한다.
// 마커(①②③)가 있으면 스텝으로 쪼개고, 없으면 통짜로. 값이 없으면(구버전·미측정 글) 아무것도 안 그린다.

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
  className = '',
}: {
  logicSummary?: string;
  className?: string;
}) {
  const text = logicSummary?.trim();
  if (!text) return null;
  const steps = splitSteps(text);

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
      ) : (
        <p className="text-[14.5px] leading-relaxed text-mint-ink">{text}</p>
      )}
    </section>
  );
}
