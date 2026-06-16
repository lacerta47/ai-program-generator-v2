import { auth } from '@/lib/firebase/client';
import type { GeneratedCode, GenerateMode } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

/** 클라이언트에서 /api/generate 를 호출하는 헬퍼 (로그인 필수) */
export async function requestGenerate(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
): Promise<GeneratedCode> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인해야 프로그램을 만들 수 있어요.');
  }
  const idToken = await user.getIdToken();

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ prompt, mode, variant }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  }
  return data as GeneratedCode;
}
