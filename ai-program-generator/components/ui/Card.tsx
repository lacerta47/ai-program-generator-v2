export default function Card({
  className = '',
  animate = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { animate?: boolean }) {
  return (
    <div
      className={`rounded-[var(--r-lg)] border-2 border-line bg-surface p-5 sm:p-6 ${animate ? 'anim-pop-in' : ''} ${className}`}
      {...props}
    />
  );
}
