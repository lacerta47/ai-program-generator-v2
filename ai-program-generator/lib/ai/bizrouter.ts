import type { AIProvider, GeneratedCode, GenerateInput, GenerationChunk, TokenUsage } from './types';
import { parsePartialCode } from './partialJson';
import { GateError, UserFacingError } from './errors';
import { gateReasonKey, validateGeneratedCode } from './validateCode';

const ENDPOINT = 'https://api.bizrouter.ai/v1/chat/completions';
const CONCEPTS = ['순서', '조건', '반복', '입력', '출력'];
const MAX_RESPONSE_CHARS = 2_000_000;
const stringField = { type: 'string' };
const schema = {
  type: 'object',
  properties: {
    html: stringField, css: stringField, javascript: stringField,
    logicSummary: stringField, conceptTags: { type: 'array', items: stringField },
    nextChallenge: stringField,
    conceptNotes: {
      type: 'object',
      properties: Object.fromEntries(CONCEPTS.map((key) => [key, stringField])),
      required: CONCEPTS,
      additionalProperties: false,
    },
  },
  required: ['html', 'css', 'javascript', 'logicSummary', 'conceptTags', 'nextChallenge', 'conceptNotes'],
  additionalProperties: false,
};

/** BizRouter SSE: 네트워크 청크와 이벤트 경계는 다를 수 있다. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > MAX_RESPONSE_CHARS) throw new Error('BizRouter 이벤트가 너무 큽니다.');
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, '');
        buffer = buffer.slice(end + 1);
        if (line.startsWith('data:')) yield line.slice(5).trimStart();
      }
      if (done) {
        if (buffer.trim()) throw new Error('BizRouter 스트림이 중간에 끝났습니다.');
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function finish(raw: string): { code: GeneratedCode; meta: NonNullable<Extract<GenerationChunk, { type: 'done' }>['meta']> } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new UserFacingError('앗, 결과를 정리하다 살짝 꼬였어요. 다시 한 번 만들어 볼까요?'); }
  const p = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const code = {
    html: typeof p.html === 'string' ? p.html : '',
    css: typeof p.css === 'string' ? p.css : '',
    javascript: typeof p.javascript === 'string' ? p.javascript : '',
  };
  if (!code.html.trim()) throw new UserFacingError('AI가 빈 결과를 만들었어요. 다시 한 번 만들어 볼까요?');
  const invalid = validateGeneratedCode(code);
  if (invalid) throw new GateError('앗, 만든 프로그램이 잘 움직이지 않아요. 다시 한 번 만들어 볼까요?', gateReasonKey(invalid), invalid);
  const notes = p.conceptNotes && typeof p.conceptNotes === 'object' && !Array.isArray(p.conceptNotes)
    ? p.conceptNotes as Record<string, unknown> : {};
  return { code, meta: {
    logicSummary: typeof p.logicSummary === 'string' ? p.logicSummary.slice(0, 2000) : '',
    conceptTags: Array.isArray(p.conceptTags) ? p.conceptTags.filter((t): t is string => typeof t === 'string' && CONCEPTS.includes(t)).slice(0, 5) : [],
    nextChallenge: typeof p.nextChallenge === 'string' ? p.nextChallenge.trim().slice(0, 120) : '',
    conceptNotes: Object.fromEntries(CONCEPTS.flatMap((key) => typeof notes[key] === 'string' && notes[key].trim() ? [[key, notes[key].trim().slice(0, 60)]] : [])),
  } };
}

export class BizRouterProvider implements AIProvider {
  async *generateStream(input: GenerateInput, signal?: AbortSignal): AsyncGenerator<GenerationChunk> {
    const key = process.env.BIZROUTER_API_KEY;
    const model = (input.quality === 'high' && process.env.BIZROUTER_HIGH_MODEL) || process.env.BIZROUTER_MODEL;
    if (!key || !model) throw new Error('BizRouter 키 또는 모델 설정이 없습니다.');
    const content = input.photo
      ? [{ type: 'text', text: input.prompt }, { type: 'image_url', image_url: { url: `data:${input.photo.mimeType};base64,${input.photo.data}` } }]
      : input.prompt;
    const response = await fetch(ENDPOINT, {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages: [{ role: 'system', content: input.system }, { role: 'user', content }],
        stream: true, stream_options: { include_usage: true }, max_tokens: input.fast ? 8192 : 32768,
        response_format: { type: 'json_schema', json_schema: { name: 'lun_program', strict: true, schema } },
      }),
    });
    if (!response.ok) throw new Error(`BizRouter HTTP ${response.status}`);
    if (!response.body) throw new Error('BizRouter 응답 스트림이 없습니다.');
    let raw = '';
    let lastParsed = 0;
    let lastSignature = '';
    let usage: TokenUsage | undefined;
    let completed = false;
    let finishReason: unknown;
    for await (const data of events(response.body)) {
      if (data === '[DONE]') { completed = true; break; }
      const chunk = JSON.parse(data) as { error?: unknown; choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>; usage?: { prompt_tokens?: number; completion_tokens?: number; thinking_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } };
      if (chunk.error) throw new Error('BizRouter 스트림 오류');
      const choice = chunk.choices?.[0];
      if (choice?.finish_reason != null) finishReason = choice.finish_reason;
      if (chunk.usage) {
        const thinking = chunk.usage.thinking_tokens ?? chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0;
        usage = { input: chunk.usage.prompt_tokens ?? 0, output: Math.max(0, (chunk.usage.completion_tokens ?? 0) - thinking), thinking };
      }
      if (typeof choice?.delta?.content !== 'string') continue;
      raw += choice.delta.content;
      if (raw.length > MAX_RESPONSE_CHARS) throw new Error('BizRouter 응답이 너무 큽니다.');
      if (raw.length - lastParsed < 512) continue;
      lastParsed = raw.length;
      const partial = parsePartialCode(raw);
      const signature = JSON.stringify(partial);
      if (signature !== lastSignature) { lastSignature = signature; yield { type: 'delta', partial }; }
    }
    if (!completed || finishReason !== 'stop') throw new UserFacingError('앗, 결과가 끝까지 도착하지 않았어요. 다시 한 번 만들어 볼까요?');
    yield { type: 'done', ...finish(raw), usage };
  }

  async generate(input: GenerateInput): Promise<GeneratedCode> {
    for await (const chunk of this.generateStream(input)) if (chunk.type === 'done') return chunk.code;
    throw new Error('BizRouter 결과가 없습니다.');
  }
}
