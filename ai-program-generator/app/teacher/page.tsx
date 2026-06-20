'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import LoadingDots from '@/components/ui/LoadingDots';

interface TeacherInfo {
  name: string;
  totalQuota: number;
}

async function fetchTeacherMe(): Promise<TeacherInfo> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요해요.');
  const idToken = await u.getIdToken();
  const res = await fetch('/api/teacher/me', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as TeacherInfo;
}

export default function TeacherPage() {
  const { user, loading, isTeacher } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<TeacherInfo | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isTeacher) {
      router.replace('/');
      return;
    }
    fetchTeacherMe()
      .then(setInfo)
      .catch((e) => console.error('선생님 정보 조회 실패:', e));
  }, [loading, user, isTeacher, router]);

  return (
    <main className="min-h-screen">
      <Header />
      {loading || !user || !isTeacher ? (
        <div className="py-16">
          <LoadingDots label="확인 중…" />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          <h1 className="text-[24px]">{info?.name ? `${info.name} 선생님` : '선생님'}</h1>
          <p className="mt-1 text-[14px] text-muted">총 한도 {info ? `${info.totalQuota}회` : '…'}</p>
          <div className="mt-6 rounded-[var(--r-lg)] border-2 border-dashed border-line p-8 text-center text-muted">
            내 반 관리는 준비 중이에요.
          </div>
        </div>
      )}
    </main>
  );
}
