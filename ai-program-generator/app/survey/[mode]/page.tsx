'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import Header from '@/components/common/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';
import { authedJson } from '@/lib/client/authedFetch';
import { auth } from '@/lib/firebase/client';
import { GENERATION_FEEDBACK_LABELS } from '@/lib/feedback/generation';

export default function SurveyPage({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = use(params);
  const { user, loading } = useAuth();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const valid = mode === 'create' || mode === 'easy';

  useEffect(() => {
    if (loading || !user || !valid) return;
    const uid = user.uid;
    const controller = new AbortController();
    setError('');
    void authedJson<{ url: string }>('/api/me/generation-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, action: 'open' }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    }).then(({ url }) => {
      if (!controller.signal.aborted && auth.currentUser?.uid === uid) window.location.replace(url);
    }).catch((cause) => {
      if (!controller.signal.aborted && auth.currentUser?.uid === uid) {
        setError(cause instanceof Error ? cause.message : '설문을 열지 못했어요. 다시 눌러 주세요.');
      }
    });
    return () => controller.abort();
  }, [loading, user, mode, valid, attempt]);

  return <main className="min-h-screen">
    <Header />
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <Card>
        <h1 className="mb-4 text-[24px]">{valid ? GENERATION_FEEDBACK_LABELS[mode] : '만들기'} 설문</h1>
        {!valid ? <p className="text-[17px]">설문 주소를 확인해 주세요.</p>
          : loading ? <LoadingDots label="확인 중…" />
          : !user ? <p className="text-[17px]">로그인한 뒤 설문에 참여해 주세요.</p>
          : error ? <>
            <p role="alert" className="mb-4 text-[17px]">{error}</p>
            <Button onClick={() => setAttempt((value) => value + 1)}>다시 확인</Button>
          </> : <LoadingDots label="설문 참여 여부를 확인하고 있어요…" />}
        <Link href="/mypage" className="press mt-4 inline-flex min-h-11 items-center text-[17px] text-brand-strong">내 정보로 가기</Link>
      </Card>
    </div>
  </main>;
}
