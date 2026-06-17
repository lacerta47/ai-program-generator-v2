'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '@/components/common/ThemeProvider';

// ogl(WebGL) 번들은 클라이언트에서만 비동기 로드
const Particles = dynamic(() => import('./Particles'), { ssr: false });

// 파티클 색 — 배경 위에서 은은하게 보이도록 모드별 브랜드 팔레트
const COLORS = {
  light: ['#5B7CFA', '#9B7CF0', '#3FC8B4'],
  dark: ['#aab8ff', '#cdb9ee', '#8fe3d2'],
} as const;

/** 랜딩 전체 배경용 파티클. 부모에 position: relative 필요. reduced-motion이면 렌더 안 함. */
export default function LandingParticles() {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setEnabled(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Particles
        className="h-full w-full"
        particleColors={[...COLORS[theme]]}
        particleCount={300}
        particleSpread={12}
        speed={0.08}
        particleBaseSize={90}
        alphaParticles
        moveParticlesOnHover={false}
        pixelRatio={1}
      />
    </div>
  );
}
