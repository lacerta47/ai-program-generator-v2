'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { LogIn, LogOut, Crown, User, AlertCircle } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { getUserProfile } from '@/lib/firebase/users';
import { countReports } from '@/lib/firebase/reports';
import { useAuth } from './AuthProvider';
import LoginDialog from './LoginDialog';
import Button from '@/components/ui/Button';

export default function AuthButton() {
  const { user, isAdmin, isTeacher, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNickname(null);
      return;
    }
    let alive = true;
    getUserProfile(user.uid).then((p) => {
      if (alive) setNickname(p?.nickname ?? null);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    countReports()
      .then(setReportCount)
      .catch((e) => console.error('신고 수 조회 실패:', e));
  }, [isAdmin]);

  if (loading) {
    return <div className="h-11 w-20 animate-pulse rounded-full bg-surface-2" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {!user.emailVerified && !isTeacher && (
          <Link
            href="/mypage"
            title="이메일 인증이 필요해요"
            className="press inline-flex items-center gap-1 rounded-full bg-coral-soft px-3 py-1.5 text-[13px] font-medium text-coral-ink hover:brightness-95"
          >
            <AlertCircle size={14} aria-hidden /> 인증 필요
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className="press inline-flex items-center gap-1 rounded-full bg-sunshine-soft px-3 py-1.5 text-[13px] font-medium text-sunshine-ink hover:brightness-95"
          >
            <Crown size={14} aria-hidden /> 관리자{reportCount > 0 ? ` · 신고 ${reportCount}` : ''}
          </Link>
        )}
        <Link
          href="/mypage"
          title="내 정보"
          className="press hidden items-center gap-1 rounded-full border-2 border-line px-3 py-1.5 text-[14px] text-ink hover:border-brand/50 sm:inline-flex"
        >
          {nickname ?? '별명 정하기'}
          <User size={14} className="text-muted" aria-hidden />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut(auth)}
          aria-label="로그아웃"
          title="로그아웃"
          className="rounded-full"
        >
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
