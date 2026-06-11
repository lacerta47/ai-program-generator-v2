'use client';

import { forwardRef } from 'react';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-ink border-2 border-transparent hover:bg-brand-strong shadow-[0_4px_0_0_var(--brand-strong)] hover:shadow-[0_3px_0_0_var(--brand-strong)] hover:translate-y-[1px] active:shadow-none active:translate-y-[4px]',
  soft:
    'bg-brand-soft text-brand-strong border-2 border-transparent hover:border-brand/40 dark:text-brand',
  ghost:
    'bg-surface text-ink border-2 border-line hover:border-brand/50 hover:bg-surface-2',
  danger:
    'bg-coral-soft text-coral-ink border-2 border-transparent hover:border-coral/50',
};

const sizes: Record<Size, string> = {
  md: 'min-h-12 px-5 text-[16px]',
  lg: 'min-h-14 px-7 text-[19px] font-display',
  icon: 'h-12 w-12 p-0',
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'ghost', size = 'md', className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`press inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
});

export default Button;
