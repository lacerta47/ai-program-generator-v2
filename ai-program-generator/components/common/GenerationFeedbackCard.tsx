'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { authedJson } from '@/lib/client/authedFetch';
import { auth } from '@/lib/firebase/client';
import { GENERATION_FEEDBACK_LABELS, type GenerationFeedbackMode, type GenerationFeedbackStatuses } from '@/lib/feedback/generation';

export default function GenerationFeedbackCard({ uid }: { uid: string }) {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<GenerationFeedbackStatuses | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      setError(false);
      void authedJson<GenerationFeedbackStatuses>('/api/me/generation-feedback', {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        cache: 'no-store',
      }).then((result) => {
        if (!controller.signal.aborted && auth.currentUser?.uid === uid) {
          setStatuses((previous) => ({
            create: previous?.create === 'completed' ? 'completed' : result.create,
            easy: previous?.easy === 'completed' ? 'completed' : result.easy,
          }));
        }
      }).catch(() => {
        if (!controller.signal.aborted && auth.currentUser?.uid === uid) setError(true);
      }).finally(() => { pending = false; });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [uid, retry]);

  function open(mode: GenerationFeedbackMode) {
    if (statuses?.[mode] === 'completed') {
      toast('이미 참여한 설문이에요. 답해 줘서 고마워요!', 'success');
      return;
    }
    window.open(`/survey/${mode}`, '_blank', 'noopener,noreferrer');
  }

  return <Card>
    <h2 className="mb-2 text-[22px]">만들기 설문</h2>
    <p className="mb-4 text-[17px] text-muted">만들어 본 느낌을 알려 주세요. 설문마다 한 번씩 참여할 수 있어요.</p>
    {error && <p role="alert" className="mb-3 text-[17px]">참여 상태를 확인하지 못했어요. 다시 확인해 주세요.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {(['create', 'easy'] as const).map((mode) => <Button
        key={mode} variant="soft" className="text-[17px]" onClick={() => open(mode)}
      >{GENERATION_FEEDBACK_LABELS[mode]} 설문{statuses?.[mode] === 'completed' ? ' · 참여 완료' : ''}</Button>)}
    </div>
    {error && <Button className="mt-3" onClick={() => setRetry((value) => value + 1)}>참여 상태 다시 확인</Button>}
  </Card>;
}
