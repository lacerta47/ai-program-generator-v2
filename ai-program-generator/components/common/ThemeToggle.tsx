'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={dark ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기'}
      title={dark ? '라이트 모드로' : '다크 모드로'}
      className="press relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-line bg-surface text-ink hover:border-brand/50"
    >
      <span
        className="absolute transition-all duration-300"
        style={{
          transform: dark ? 'translateY(0) rotate(0deg)' : 'translateY(28px) rotate(90deg)',
          opacity: dark ? 1 : 0,
        }}
      >
        <Moon size={19} className="text-grape" />
      </span>
      <span
        className="absolute transition-all duration-300"
        style={{
          transform: dark ? 'translateY(-28px) rotate(-90deg)' : 'translateY(0) rotate(0deg)',
          opacity: dark ? 0 : 1,
        }}
      >
        <Sun size={19} className="text-sunshine-ink" />
      </span>
    </button>
  );
}
