'use client';

export type ChipColor = 'brand' | 'mint' | 'sunshine' | 'coral' | 'grape';

const palette: Record<ChipColor, { active: string; idle: string }> = {
  brand: {
    active: 'bg-brand text-brand-ink border-brand',
    idle: 'bg-brand-soft text-brand-strong border-transparent hover:border-brand/50 dark:text-brand',
  },
  mint: {
    active: 'bg-mint text-[oklch(0.2_0.06_175)] border-mint',
    idle: 'bg-mint-soft text-mint-ink border-transparent hover:border-mint/60',
  },
  sunshine: {
    active: 'bg-sunshine text-[oklch(0.25_0.08_75)] border-sunshine',
    idle: 'bg-sunshine-soft text-sunshine-ink border-transparent hover:border-sunshine/60',
  },
  coral: {
    active: 'bg-coral text-[oklch(0.99_0_0)] border-coral',
    idle: 'bg-coral-soft text-coral-ink border-transparent hover:border-coral/60',
  },
  grape: {
    active: 'bg-grape text-[oklch(0.99_0_0)] border-grape',
    idle: 'bg-grape-soft text-grape-ink border-transparent hover:border-grape/60',
  },
};

export const CHIP_COLORS: ChipColor[] = ['brand', 'mint', 'sunshine', 'coral', 'grape'];

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ChipColor;
  active?: boolean;
}

export default function Chip({ color = 'brand', active = false, className = '', ...props }: Props) {
  const c = palette[color];
  return (
    <button
      className={`press inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-medium ${active ? c.active : c.idle} ${className}`}
      {...props}
    />
  );
}
