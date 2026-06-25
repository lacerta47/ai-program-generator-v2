'use client';

import { useEffect, useRef, useState } from 'react';
import { Wand2, MousePointerClick, LayoutGrid, LogIn, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/components/common/ThemeProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import Dock, { type DockItem } from '@/components/fx/Dock';

// 일정 시간 무조작이면 네비 라벨을 보여 저학년에게 첫 행동을 안내(자동 진입은 하지 않음).
const IDLE_MS = 4000;
const LINGER_MS = 2000; // 상호작용해도 즉시 숨기지 않고 잠깐 더 노출
const PRIMARY = ['create', 'easy', 'board'];

/** 랜딩 우측 위 네비 — 기능 + 로그인 + 테마 토글을 dock 하나로 통합. */
export default function LandingNav({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const [idle, setIdle] = useState(false);
  const revealedRef = useRef(false);
  const dark = theme === 'dark';

  // 무조작 감지: 마우스·키보드·스크롤·터치 어느 것도 없으면 IDLE_MS 후 라벨 노출.
  // (터치 기기엔 hover가 없으므로 touchstart 포함이 핵심)
  // 이미 노출 중이면 상호작용해도 즉시 숨기지 않고 LINGER_MS 동안 더 보여준 뒤 숨기고,
  // 다시 IDLE_MS 무조작이면 재노출. (상호작용이 이어지면 그동안은 계속 노출 유지)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const set = (v: boolean) => {
      revealedRef.current = v;
      setIdle(v);
    };
    const armReveal = () => {
      timer = setTimeout(() => set(true), IDLE_MS);
    };
    const onActivity = () => {
      clearTimeout(timer);
      if (revealedRef.current) {
        timer = setTimeout(() => {
          set(false);
          armReveal();
        }, LINGER_MS);
      } else {
        armReveal();
      }
    };
    const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    armReveal();
    return () => {
      clearTimeout(timer);
      evs.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, []);

  const items: DockItem[] = [
    { key: 'create', label: '만들기', icon: <Wand2 size={20} aria-hidden />, href: '/create' },
    { key: 'easy', label: '골라서 만들기', icon: <MousePointerClick size={20} aria-hidden />, href: '/easy' },
    { key: 'board', label: '게시판', icon: <LayoutGrid size={20} aria-hidden />, href: '/board' },
    user
      ? { key: 'me', label: '내 정보', icon: <User size={20} aria-hidden />, href: '/mypage' }
      : { key: 'login', label: '로그인', icon: <LogIn size={20} aria-hidden />, onClick: () => setLoginOpen(true) },
    {
      key: 'theme',
      label: dark ? '라이트 모드' : '다크 모드',
      icon: dark ? <Moon size={20} aria-hidden /> : <Sun size={20} aria-hidden />,
      onClick: toggle,
    },
  ];

  return (
    <>
      <div className="relative">
        <Dock items={items} compact={compact} revealed={idle} primaryKeys={PRIMARY} />
        <p
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-full mt-1 text-center text-[13px] text-brand transition-opacity duration-300 ${
            idle ? 'opacity-100' : 'opacity-0'
          }`}
        >
          무엇부터 할까요? 여기서 골라요 ↗
        </p>
      </div>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
