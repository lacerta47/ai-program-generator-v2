'use client';

import { useState } from 'react';
import { Wand2, MousePointerClick, LayoutGrid, LogIn, User } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import ThemeToggle from '@/components/common/ThemeToggle';
import Dock, { type DockItem } from '@/components/fx/Dock';

/** 랜딩 우측 위 네비 — dock(기능 + 로그인) + 테마 토글. */
export default function LandingNav() {
  const { user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const items: DockItem[] = [
    { key: 'create', label: '만들기', icon: <Wand2 size={20} aria-hidden />, href: '/create' },
    { key: 'easy', label: '골라서 만들기', icon: <MousePointerClick size={20} aria-hidden />, href: '/easy' },
    { key: 'board', label: '게시판', icon: <LayoutGrid size={20} aria-hidden />, href: '/board' },
    user
      ? { key: 'me', label: '내 정보', icon: <User size={20} aria-hidden />, href: '/mypage' }
      : { key: 'login', label: '로그인', icon: <LogIn size={20} aria-hidden />, onClick: () => setLoginOpen(true) },
  ];

  return (
    <div className="flex items-center gap-2">
      <Dock items={items} />
      <ThemeToggle />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
