'use client';

import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { LogIn, LogOut, Crown } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { useAuth } from './AuthProvider';
import LoginDialog from './LoginDialog';
import Button from '@/components/ui/Button';

export default function AuthButton() {
  const { user, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return <div className="h-11 w-20 animate-pulse rounded-full bg-surface-2" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sunshine-soft px-3 py-1.5 text-[13px] font-medium text-sunshine-ink">
            <Crown size={14} aria-hidden /> 관리자
          </span>
        )}
        <span className="hidden max-w-[130px] truncate text-[14px] text-muted lg:inline">
          {user.email ?? user.displayName ?? '사용자'}
        </span>
        <Button variant="ghost" size="icon" onClick={() => signOut(auth)} aria-label="로그아웃" title="로그아웃" className="rounded-full">
          <LogOut size={18} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="min-h-11 rounded-full px-4 text-[15px]">
        <LogIn size={17} aria-hidden /> 로그인
      </Button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
