// 로딩 화면용 오리지널 캐릭터: 작은 로봇이 모니터 앞에서 코드를 짜는 장면.
// 외부 에셋 없이 순수 CSS로만 그려서 저작권 문제가 없다.
// (모션은 globals.css의 reduced-motion 가드로 자동 정지)
export default function BuilderBot() {
  return (
    <div aria-hidden className="flex items-end justify-center gap-3">
      {/* 모니터 — 색색 코드 줄이 차오른다 */}
      <div className="flex flex-col items-center">
        <div className="flex h-[84px] w-[120px] flex-col gap-2 rounded-[12px] border-[3px] border-line bg-surface-2 p-3">
          {(
            [
              ['var(--mint)', '74%', 'code-line-1'],
              ['var(--brand)', '52%', 'code-line-2'],
              ['var(--sunshine)', '86%', 'code-line-3'],
              ['var(--grape)', '62%', 'code-line-4'],
            ] as const
          ).map(([color, width, anim]) => (
            <span
              key={anim}
              className="h-[7px] rounded-full"
              style={{
                width,
                backgroundColor: color,
                transformOrigin: 'left center',
                animation: `${anim} 3.6s ease-out infinite`,
              }}
            />
          ))}
        </div>
        <span className="h-2.5 w-[14px] bg-line" />
        <span className="h-1.5 w-12 rounded-full bg-line" />
      </div>

      {/* 로봇 */}
      <div style={{ animation: 'bot-bob 1.6s ease-in-out infinite' }}>
        {/* 안테나 */}
        <div className="flex flex-col items-center">
          <span
            className="h-2.5 w-2.5 rounded-full bg-sunshine"
            style={{ animation: 'antenna-pulse 1.2s ease-in-out infinite' }}
          />
          <span className="h-2 w-[3px] rounded bg-brand-strong" />
        </div>
        {/* 머리 (모니터 쪽을 바라보게 눈을 왼쪽으로) */}
        <div className="flex h-9 w-12 items-center justify-start gap-1.5 rounded-[12px] bg-brand pl-2.5">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-white"
              style={{ animation: 'bot-blink 3.2s ease-in-out infinite' }}
            />
          ))}
        </div>
        {/* 몸통 + 타자 치는 팔 */}
        <div className="relative mx-auto mt-0.5 h-6 w-9 rounded-[9px] bg-brand-soft">
          <span
            className="absolute -left-2.5 top-1.5 h-[5px] w-3.5 rounded-full bg-brand"
            style={{ transformOrigin: 'right center', animation: 'bot-tap 0.5s ease-in-out infinite' }}
          />
          <span
            className="absolute -left-2.5 top-3.5 h-[5px] w-3.5 rounded-full bg-brand"
            style={{
              transformOrigin: 'right center',
              animation: 'bot-tap 0.5s ease-in-out infinite',
              animationDelay: '0.25s',
            }}
          />
        </div>
      </div>
    </div>
  );
}
