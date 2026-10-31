import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizRouterProvider } from './bizrouter';
import { GateError, UserFacingError } from './errors';
import type { GenerateInput } from './types';

const input: GenerateInput = { prompt: '만들기', system: '규칙', mode: 'generate' };
const output = JSON.stringify({ html: '<main>안녕</main>', css: '', javascript: '', logicSummary: '설명', conceptTags: ['순서', '가짜'], nextChallenge: '도전', conceptNotes: { 순서: '예시' } });
const line = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
function stream(text: string): Response {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }), { status: 200 });
}
function response(content = output, reason = 'stop', done = true): Response {
  return stream(line({ choices: [{ delta: { content }, finish_reason: null }] }) +
    line({ choices: [{ delta: {}, finish_reason: reason }] }) +
    line({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 20, thinking_tokens: 5 } }) +
    (done ? 'data: [DONE]\r\n\r\n' : ''));
}
async function collect(provider: BizRouterProvider, value = input) {
  const result = [];
  for await (const chunk of provider.generateStream(value)) result.push(chunk);
  return result;
}
beforeEach(() => {
  vi.stubEnv('BIZROUTER_API_KEY', 'test-key');
  vi.stubEnv('BIZROUTER_MODEL', 'test/standard');
  vi.stubEnv('BIZROUTER_HIGH_MODEL', 'test/high');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('BizRouter provider', () => {
  it.each([
    ['standard', 'google/gemini-3.8-flash'],
    ['high', 'google/gemini-4-argon'],
  ] as const)('keeps the existing Gemini %s model when using a BizRouter key', async (quality, model) => {
    vi.stubEnv('BIZROUTER_MODEL', 'google/gemini-3.8-flash');
    vi.stubEnv('BIZROUTER_HIGH_MODEL', 'google/gemini-4-argon');
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    await collect(new BizRouterProvider(), { ...input, quality, tier: 'paid' });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.bizrouter.ai/v1/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(request.body).model).toBe(model);
  });

  it('handles fragmented UTF-8 SSE, validates code and separates thinking tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    const chunks = await collect(new BizRouterProvider());
    expect(chunks.at(-1)).toMatchObject({ type: 'done', code: { html: '<main>안녕</main>' }, usage: { input: 10, output: 15, thinking: 5 }, meta: { conceptTags: ['순서'], conceptNotes: { 순서: '예시' } } });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.bizrouter.ai/v1/chat/completions');
    expect(JSON.parse(request.body)).toMatchObject({ model: 'test/standard', stream: true, response_format: { type: 'json_schema' } });
  });

  it('selects the high model and sends image input in the supported message format', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    await collect(new BizRouterProvider(), { ...input, quality: 'high', photo: { mimeType: 'image/png', data: 'YWJj' } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('test/high');
    expect(body.messages[1].content[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,YWJj' } });
  });

  it.each([['length', true], ['stop', false]])('rejects incomplete or truncated streams (%s)', async (reason, done) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(output, reason, done)));
    await expect(collect(new BizRouterProvider())).rejects.toBeInstanceOf(UserFacingError);
  });

  it('rejects invalid code through the existing generation gate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(JSON.stringify({ html: '<main>ok</main>', css: '', javascript: 'const = ;' }))));
    await expect(collect(new BizRouterProvider())).rejects.toBeInstanceOf(GateError);
  });

  it('fails without configuration and never calls the network', async () => {
    vi.stubEnv('BIZROUTER_MODEL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(collect(new BizRouterProvider())).rejects.toThrow('설정이 없습니다');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose the provider response body on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret detail', { status: 403 })));
    await expect(collect(new BizRouterProvider())).rejects.toThrow('BizRouter HTTP 403');
  });

  it('passes the caller cancellation signal to the HTTP request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    for await (const chunk of new BizRouterProvider().generateStream(input, controller.signal)) {
      expect(chunk).toBeDefined();
    }
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('rejects stream errors even after partial output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream(line({ choices: [{ delta: { content: '{' } }] }) + line({ error: { message: 'private error' } }))));
    await expect(collect(new BizRouterProvider())).rejects.toThrow('BizRouter 스트림 오류');
  });
});
