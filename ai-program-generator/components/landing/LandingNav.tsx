'use client';

import { useState } from 'react';
import { Wand2, MousePointerClick, LayoutGrid, LogIn, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useTheme } from '@/components/common/ThemeProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import Dock, { type DockItem } from '@/components/fx/Dock';

/** 랜딩 우측 위 네비 — 기능 + 로그인 + 테마 토글을 dock 하나로 통합. */
export default function LandingNav({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [loginOpen, setLoginOpen] = useState(false);
  const dark = theme === 'dark';

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
      <Dock items={items} compact={compact} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}
