/** 작은 막대 추이(순수 CSS). 높이 = value / 최댓값. 0이어도 최소 높이로 보이게. */
export default function Sparkline({ values, max }: { values: number[]; max?: number }) {
  const peak = Math.max(max ?? 0, ...values, 1);
  return (
    <span className="inline-flex h-6 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm bg-brand/70"
          style={{ height: `${Math.max((v / peak) * 100, 8)}%` }}
          title={String(v)}
        />
      ))}
    </span>
  );
}
