'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import LoadingDots from '@/components/ui/LoadingDots';

/**
 * 관리자 전용 페이지 가드. authLoading 동안 로딩, 비admin이면 토스트+홈 리다이렉트.
 * 진짜 방어는 서버(API admin claim 검증)이고 이건 UX용. Header는 각 페이지가 바깥에서 렌더.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      // 로그인 상태인데 권한이 없을 때만 안내(직접 URL 접근 등). 로그아웃(user 없음)은 조용히 메인으로.
      if (user) toast('관리자만 들어갈 수 있어요.');
      router.replace('/');
    }
  }, [loading, isAdmin, user, router, toast]);

  if (loading || !isAdmin) {
    return (
      <div className="py-16">
        <LoadingDots label="확인 중…" />
      </div>
    );
  }
  return <>{children}</>;
}
