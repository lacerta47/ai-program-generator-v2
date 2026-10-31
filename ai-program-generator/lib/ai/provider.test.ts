import { afterEach, expect, it, vi } from 'vitest';
import { getAIProvider, selectSplitProvider, prepareUserGeneration } from './provider';
import { GeminiProvider } from './gemini';
import { BizRouterProvider } from './bizrouter';
import type { GenerateInput, GenerationChunk } from './types';
vi.mock('@/lib/server/generationSlots', () => ({ acquireGenerationSlot: vi.fn() }));
import { acquireGenerationSlot } from '@/lib/server/generationSlots';
import { GenerationBusyError } from './errors';

const code = { html: '<p>ok</p>', css: '', javascript: '' };
const input: GenerateInput = { prompt: '테스트', system: '규칙', mode: 'generate' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.mocked(acquireGenerationSlot).mockReset(); });

it('defaults to Gemini even when a BizRouter key exists', () => {
  vi.stubEnv('AI_PROVIDER', '');
  vi.stubEnv('BIZROUTER_API_KEY', 'test-key');
  expect(getAIProvider()).toBeInstanceOf(GeminiProvider);
});

it('routes paid requests to BizRouter and free requests to Gemini', async () => {
  vi.stubEnv('AI_PROVIDER', 'bizrouter');
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue(code);
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generate').mockResolvedValue(code);
  const provider = getAIProvider();
  await provider.generate({ ...input, tier: 'paid' });
  await provider.generate({ ...input, tier: 'free' });
  expect(bizrouter).toHaveBeenCalledOnce();
  expect(gemini).toHaveBeenCalledOnce();
  expect(gemini).toHaveBeenCalledWith({ ...input, tier: 'free' });
});

it('routes streaming requests and forwards cancellation signals by tier', async () => {
  vi.stubEnv('AI_PROVIDER', 'bizrouter');
  const stream = async function* () { yield { type: 'done' as const, code }; };
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generateStream').mockImplementation(stream);
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generateStream').mockImplementation(stream);
  const provider = getAIProvider();
  const signal = new AbortController().signal;
  for await (const chunk of provider.generateStream({ ...input, tier: 'paid' }, signal)) expect(chunk.type).toBe('done');
  for await (const chunk of provider.generateStream({ ...input, tier: 'free' }, signal)) expect(chunk.type).toBe('done');
  expect(bizrouter).toHaveBeenCalledWith({ ...input, tier: 'paid' }, signal);
  expect(gemini).toHaveBeenCalledWith({ ...input, tier: 'free' }, signal);
});

it('rejects unknown provider settings rather than silently switching', () => {
  vi.stubEnv('AI_PROVIDER', 'unknown');
  expect(() => getAIProvider()).toThrow('AI_PROVIDER');
});

function splitConfig() {
  vi.stubEnv('AI_PROVIDER', 'split');
  vi.stubEnv('GEMINI_API_KEY', 'test-google');
  vi.stubEnv('BIZROUTER_API_KEY', 'test-router');
  vi.stubEnv('BIZROUTER_MODEL', 'google/gemini-3.8-flash');
  vi.stubEnv('BIZROUTER_HIGH_MODEL', 'google/gemini-4-argon');
}

it('assigns the same request consistently and distributes a large sample evenly', () => {
  const routes = Array.from({ length: 1000 }, (_, i) => selectSplitProvider(`request-${i}`));
  expect(routes).toEqual(Array.from({ length: 1000 }, (_, i) => selectSplitProvider(`request-${i}`)));
  expect(routes.filter(x => x === 'gemini').length).toBeGreaterThan(450);
  expect(routes.filter(x => x === 'gemini').length).toBeLessThan(550);
});

it('split routing preserves quality and leaves free examples on Gemini', async () => {
  splitConfig();
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue(code);
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generate').mockResolvedValue(code);
  for (const route of ['gemini', 'bizrouter']) {
    const id = Array.from({ length: 100 }, (_, i) => `request-${i}`).find(id => selectSplitProvider(id) === route)!;
    const provider = getAIProvider(id);
    await provider.generate({ ...input, quality: 'high', tier: 'paid' });
    await provider.generate({ ...input, tier: 'free' });
  }
  expect(bizrouter).toHaveBeenCalledExactlyOnceWith({ ...input, quality: 'high', tier: 'paid' });
  expect(gemini).toHaveBeenCalledTimes(3);
});

it('split streams use the assigned route and never switch after partial output', async () => {
  splitConfig();
  const id = Array.from({ length: 100 }, (_, i) => `request-${i}`).find(id => selectSplitProvider(id) === 'bizrouter')!;
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generateStream');
  vi.spyOn(BizRouterProvider.prototype, 'generateStream').mockImplementation(async function* () {
    yield { type: 'delta', partial: { html: '<main>' } };
    throw new Error('upstream failure');
  });
  const chunks: GenerationChunk[] = [];
  await expect((async () => { for await (const c of getAIProvider(id).generateStream(input)) chunks.push(c); })()).rejects.toThrow('upstream failure');
  expect(chunks).toHaveLength(1);
  expect(gemini).not.toHaveBeenCalled();
});

it('rejects split mode before admission if a key or the pinned models are missing', async () => {
  splitConfig();
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('GEMINI_API_KEY_PAID', '');
  await expect(prepareUserGeneration('request', new AbortController().signal)).rejects.toThrow('두 제공자 키');
  splitConfig();
  vi.stubEnv('BIZROUTER_HIGH_MODEL', 'anthropic/claude-opus-5.5');
  expect(() => getAIProvider('request')).toThrow('기존 Gemini 모델');
});

it('admission uses the same route as generation and returns its lease', async () => {
  splitConfig();
  const signal = new AbortController().signal;
  const release = vi.fn().mockResolvedValue(undefined);
  vi.mocked(acquireGenerationSlot).mockResolvedValue({ signal, release });
  const result = await prepareUserGeneration('admission-test', signal);
  expect(acquireGenerationSlot).toHaveBeenCalledExactlyOnceWith(selectSplitProvider('admission-test'), signal);
  expect(result.signal).toBe(signal);
  await result.release();
  expect(release).toHaveBeenCalledOnce();
  vi.stubEnv('AI_PROVIDER', 'gemini');
  await prepareUserGeneration('legacy', signal);
  expect(acquireGenerationSlot).toHaveBeenCalledOnce();
});

it('BizRouter-first keeps normal traffic on BizRouter without probing Gemini capacity', async () => {
  splitConfig(); vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  const signal = new AbortController().signal;
  vi.mocked(acquireGenerationSlot).mockResolvedValue({ signal, release: async () => {} });
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generate').mockResolvedValue(code);
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue(code);
  const admitted = await prepareUserGeneration('normal', signal);
  await admitted.provider.generate({ ...input, quality: 'high', tier: 'paid' });
  expect(acquireGenerationSlot).toHaveBeenCalledExactlyOnceWith('bizrouter', signal);
  expect(bizrouter).toHaveBeenCalledExactlyOnceWith({ ...input, quality: 'high', tier: 'paid' });
  expect(gemini).not.toHaveBeenCalled();
});

it('spills to Gemini only when BizRouter slots are occupied, preserving quality', async () => {
  splitConfig(); vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  const signal = new AbortController().signal;
  const release = vi.fn().mockResolvedValue(undefined);
  vi.mocked(acquireGenerationSlot).mockRejectedValueOnce(new GenerationBusyError()).mockResolvedValueOnce({ signal, release });
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue(code);
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generate').mockResolvedValue(code);
  const admitted = await prepareUserGeneration('overflow', signal);
  await admitted.provider.generate({ ...input, quality: 'high', tier: 'paid' });
  await admitted.release();
  expect(acquireGenerationSlot).toHaveBeenNthCalledWith(1, 'bizrouter', signal);
  expect(acquireGenerationSlot).toHaveBeenNthCalledWith(2, 'gemini', signal);
  expect(gemini).toHaveBeenCalledExactlyOnceWith({ ...input, quality: 'high', tier: 'paid' });
  expect(bizrouter).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledOnce();
});

it('fails before generation when both paths are full or capacity storage fails', async () => {
  splitConfig(); vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  const signal = new AbortController().signal;
  vi.mocked(acquireGenerationSlot).mockRejectedValue(new GenerationBusyError());
  await expect(prepareUserGeneration('full', signal)).rejects.toBeInstanceOf(GenerationBusyError);
  expect(acquireGenerationSlot).toHaveBeenCalledTimes(2);
  vi.mocked(acquireGenerationSlot).mockReset().mockRejectedValue(new Error('DB unavailable'));
  await expect(prepareUserGeneration('db-error', signal)).rejects.toThrow('DB unavailable');
  expect(acquireGenerationSlot).toHaveBeenCalledOnce();
});

it('does not move a running BizRouter stream to Gemini after an upstream failure', async () => {
  splitConfig(); vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  const signal = new AbortController().signal;
  vi.mocked(acquireGenerationSlot).mockResolvedValue({ signal, release: async () => {} });
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generateStream');
  vi.spyOn(BizRouterProvider.prototype, 'generateStream').mockImplementation(async function* () {
    yield { type: 'delta', partial: { html: '<main>' } };
    throw new Error('HTTP 503');
  });
  const admitted = await prepareUserGeneration('stream-error', signal);
  await expect((async () => { for await (const c of admitted.provider.generateStream(input, signal)) expect(c.type).toBe('delta'); })()).rejects.toThrow('HTTP 503');
  expect(gemini).not.toHaveBeenCalled();
  expect(acquireGenerationSlot).toHaveBeenCalledOnce();
});
