export default function LoadingDots({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="flex items-end gap-2">
        {(['var(--brand)', 'var(--mint)', 'var(--sunshine)'] as const).map((c, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 rounded-full"
            style={{
              backgroundColor: c,
              animation: 'dot-bounce 1.1s ease-in-out infinite',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      {label && <p className="text-[16px] text-muted">{label}</p>}
    </div>
  );
}
