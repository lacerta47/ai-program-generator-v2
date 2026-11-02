import { authedFetch } from '@/lib/client/authedFetch';
import type { GeneratedCode, GenerateMode, GenerationMeta } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

interface StreamOpts {
  /** 부분 코드 도착 콜백(라이브 표시용). */
  onDelta?: (partial: Partial<GeneratedCode>) => void;
  /** 교육 메타(logicSummary·conceptTags) 도착 콜백 — 게시물 저장용(있을 때만 호출). */
  onMeta?: (meta: GenerationMeta) => void;
  signal?: AbortSignal;
  /** 슬롯 부족으로 기다릴 때 true, 입장하거나 중단하면 false. */
  onWaiting?: (waiting: boolean) => void;
  /** 사진 1장(data-URI). 멀티모달 생성용 — 서버가 검증·전달. */
  photo?: string;
  /** 선택지 만들기의 유형 id(PROGRAM_TYPES id) — 서버가 참고 예시·유형 가이드·모델 정책에 사용한다. */
  programType?: string;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

/** 실행 전 슬롯 부족만 재시도한다. 통신 실패는 이미 실행됐는지 판별할 수 없다. */
async function waitForAdmission(body: string, opts: StreamOpts): Promise<Response> {
  let deadline: number | undefined;
  let retries = 0;
  try {
    for (;;) {
      opts.signal?.throwIfAborted();
      const res = await authedFetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: opts.signal,
      });
      opts.signal?.throwIfAborted();
      if (res.ok && res.body) return res;
      const data = await res.json().catch(() => ({}));
      if (res.status !== 503 || data?.code !== 'generation_busy' || data?.retryable !== true) {
        throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
      }
      deadline ??= Date.now() + 120_000;
      const header = res.headers.get('Retry-After');
      const seconds = header === null ? NaN : Number(header);
      const retryAfter = Number.isFinite(seconds) && seconds >= 0
        ? seconds * 1000 : Math.max(0, Date.parse(header ?? '') - Date.now()) || 3000;
      const delay = Math.max(retryAfter, Math.min(20_000, 3000 * 2 ** retries)) + Math.floor(Math.random() * 1000);
      if (retries >= 10 || Date.now() + delay >= deadline) {
        throw new Error('아직 친구들이 만들고 있어요. 잠깐 쉬었다가 다시 해볼까요?');
      }
      opts.onWaiting?.(true);
      await pause(delay, opts.signal);
      if (Date.now() >= deadline) throw new Error('아직 친구들이 만들고 있어요. 잠깐 쉬었다가 다시 해볼까요?');
      retries++;
    }
  } finally {
    opts.onWaiting?.(false);
  }
}

/** 클라이언트에서 /api/generate(NDJSON 스트림)를 호출. onDelta로 부분 코드를 받고 최종을 반환. */
export async function requestGenerateStream(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
  opts: StreamOpts = {},
): Promise<GeneratedCode> {
  const res = await waitForAdmission(JSON.stringify({ prompt, mode, variant, photo: opts.photo, programType: opts.programType }), opts);

  const reader = res.body!.getReader();
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
