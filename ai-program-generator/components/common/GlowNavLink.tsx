'use client';

import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import BorderGlow from '@/components/fx/BorderGlow';

// 글로우 메시 색: 파티클과 같은 브랜드 계열, 모드별 분리
const MESH = {
  light: ['#5B7CFA', '#9B7CF0', '#3FC8B4'],
  dark: ['#aab8ff', '#cdb9ee', '#8fe3d2'],
} as const;
// 외곽 글로우(HSL "h s l") — 브랜드 블루
const GLOW = { light: '228 94 67', dark: '228 100 80' } as const;

interface Props {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}

export default function GlowNavLink({ href, active = false, children }: Props) {
  const { theme } = useTheme();

  return (
    <BorderGlow
      animated={false}
      edgeSensitivity={60}
      colors={[...MESH[theme]]}
      glowColor={GLOW[theme]}
      glowRadius={22}
      glowIntensity={0.85}
      borderRadius={999}
      backgroundColor={active ? 'var(--brand)' : 'var(--surface)'}
      className={active ? 'border-transparent' : 'border-line'}
    >
      <Link
        href={href}
        className={`group inline-flex min-h-11 items-center gap-1.5 px-4 text-[16.5px] font-medium ${
          active ? 'text-brand-ink' : 'text-muted hover:text-brand-strong dark:hover:text-brand'
        }`}
      >
        {children}
      </Link>
    </BorderGlow>
  );
}
