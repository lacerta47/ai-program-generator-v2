'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { authedJson } from '@/lib/client/authedFetch';
import { auth } from '@/lib/firebase/client';
import type { GenerationFeedbackMode } from '@/lib/feedback/generation';

const PATH = '/api/me/generation-feedback';

type NotifySuccess = (mode: GenerationFeedbackMode, uid: string, message: string) => void;
const FeedbackContext = createContext<NotifySuccess>(() => {});
export const useGenerationSuccess = () => useContext(FeedbackContext);

export function GenerationFeedbackProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const request = useRef<AbortController | null>(null);
  const dismiss = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    request.current?.abort();
    dismiss.current?.();
    dismiss.current = null;
  }, [pathname, user?.uid]);

  const notify = useCallback<NotifySuccess>((mode, uid, message) => {
    if (auth.currentUser?.uid !== uid) return;
    // 이미 확인 중이면 같은 탭에서 확인 요청을 또 시작하지 않는다.
    if (request.current && !request.current.signal.aborted) {
      toast(message, 'success');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    void authedJson<{ offer: boolean }>(PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
    }).catch(() => ({ offer: false })).then(({ offer }) => {
      if (controller.signal.aborted || auth.currentUser?.uid !== uid) return;
      if (!offer) {
        toast(message, 'success');
        return;
      }
      dismiss.current?.();
      dismiss.current = toast(message, 'success', {
        prompt: '만들어 본 느낌을 설문으로 알려 줄래요? 약 3분 걸려요.',
        label: '설문 답하기',
        href: `/survey/${mode}`,
      });
    }).finally(() => {
      if (request.current === controller) request.current = null;
    });
  }, [toast]);

  return <FeedbackContext.Provider value={notify}>{children}</FeedbackContext.Provider>;
}
