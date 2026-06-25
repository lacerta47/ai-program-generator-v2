'use client';

import { usePathname } from 'next/navigation';

/**
 * 라우트 진입 전환(C-lite) — 랜딩→앱(및 앱 내 이동)의 하드컷을 부드럽게.
 * template은 네비게이션마다 재마운트되므로 매 진입에 페이드+살짝 줌이 재생된다.
 * 랜딩(/)은 자체 인트로(Lenis 스크롤)라 제외. reduced-motion은 globals.css 전역 가드로 자동 정지.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return <>{children}</>;
  return <div className="page-enter">{children}</div>;
}
