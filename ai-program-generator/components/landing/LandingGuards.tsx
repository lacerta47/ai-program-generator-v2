'use client';

import { useEffect } from 'react';

/**
 * 랜딩에서만 우클릭(contextmenu)·드래그(dragstart)·텍스트 선택을 막는다.
 * 랜딩이 떠 있는 동안만 적용되고, 다른 페이지로 이동하면 cleanup으로 원복.
 * (참고: 완전한 차단이 아니라 가벼운 억제 — 개발자도구/단축키로는 우회 가능.)
 */
export default function LandingGuards() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.body.style.setProperty('-webkit-user-select', 'none');
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.removeProperty('-webkit-user-select');
    };
  }, []);

  return null;
}
