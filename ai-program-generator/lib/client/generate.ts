import { authedFetch } from '@/lib/client/authedFetch';
import type { GeneratedCode, GenerateMode, GenerationMeta } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

interface StreamOpts {
  /** 부분 코드 도착 콜백(라이브 표시용). */
  onDelta?: (partial: Partial<GeneratedCode>) => void;
  /** 교육 메타(logicSummary·conceptTags) 도착 콜백 — 게시물 저장용(있을 때만 호출). */
  onMeta?: (meta: GenerationMeta) => void;
  signal?: AbortSignal;
  /** 사진 1장(data-URI). 멀티모달 생성용 — 서버가 검증·전달. */
  photo?: string;
}

/** 클라이언트에서 /api/generate(NDJSON 스트림)를 호출. onDelta로 부분 코드를 받고 최종을 반환. */
export async function requestGenerateStream(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
  opts: StreamOpts = {},
): Promise<GeneratedCode> {
  const res = await authedFetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, mode, variant, photo: opts.photo }),
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
      let msg:
        | { type: 'delta'; partial: Partial<GeneratedCode> }
        | { type: 'done'; code: GeneratedCode; meta?: GenerationMeta }
        | { type: 'error'; error: string };
      try {
        msg = JSON.parse(line);
      } catch {
        // 프록시/네트워크가 끼워넣은 비표준 라인은 무시하고 계속(정상 NDJSON만 처리)
        continue;
      }
      if (msg.type === 'delta') opts.onDelta?.(msg.partial);
      else if (msg.type === 'done') {
        final = msg.code;
        if (msg.meta) opts.onMeta?.(msg.meta);
      } else if (msg.type === 'error') throw new Error(msg.error);
    }
  }

  if (!final) throw new Error('생성 결과를 받지 못했어요. 다시 해볼까요?');
  return final;
}
