import { auth } from '@/lib/firebase/client';
import type { GeneratedCode, GenerateMode } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

interface StreamOpts {
  /** 부분 코드 도착 콜백(라이브 표시용). */
  onDelta?: (partial: Partial<GeneratedCode>) => void;
  signal?: AbortSignal;
}

/** 클라이언트에서 /api/generate(NDJSON 스트림)를 호출. onDelta로 부분 코드를 받고 최종을 반환. */
export async function requestGenerateStream(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
  opts: StreamOpts = {},
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
    signal: opts.signal,
  });

  // 스트림 시작 전 에러(인증·검증·한도)는 일반 JSON 응답
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let final: GeneratedCode | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as
        | { type: 'delta'; partial: Partial<GeneratedCode> }
        | { type: 'done'; code: GeneratedCode }
        | { type: 'error'; error: string };
      if (msg.type === 'delta') opts.onDelta?.(msg.partial);
      else if (msg.type === 'done') final = msg.code;
      else if (msg.type === 'error') throw new Error(msg.error);
    }
  }

  if (!final) throw new Error('생성 결과를 받지 못했어요. 다시 해볼까요?');
  return final;
}
