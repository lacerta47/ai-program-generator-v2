import { afterAll, beforeAll, expect, test, vi } from 'vitest';

vi.mock('@/lib/firebase/admin', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required; live database is forbidden');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  return { adminDb: getFirestore(initializeApp({ projectId: 'demo-lun-rules' }, 'generation-slots-test')) };
});
import { acquireGenerationSlot } from '@/lib/server/generationSlots';
import { adminDb } from '@/lib/firebase/admin';
import { GenerationBusyError } from '@/lib/ai/errors';
import { prepareUserGeneration } from '@/lib/ai/provider';
import { GeminiProvider } from '@/lib/ai/gemini';
import { BizRouterProvider } from '@/lib/ai/bizrouter';

beforeAll(async () => {
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '2');
  await Promise.all(['gemini', 'bizrouter'].flatMap(route => [0, 1].map(i => adminDb.doc(`generationSlots/${route}-${i}`).delete())));
});
afterAll(async () => {
  await Promise.all(['gemini', 'bizrouter'].flatMap(route => [0, 1].map(i => adminDb.doc(`generationSlots/${route}-${i}`).delete())));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await adminDb.terminate();
});

test('real emulator transactions admit at most two parallel owners and reuse released slots', async () => {
  const signal = new AbortController().signal;
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => acquireGenerationSlot('gemini', signal)));
  const leases = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
  try {
    expect(leases).toHaveLength(2);
    for (const result of results) if (result.status === 'rejected') expect(result.reason).toBeInstanceOf(GenerationBusyError);
    await leases[0].release();
    const replacement = await acquireGenerationSlot('gemini', signal);
    await replacement.release();
  } finally { await Promise.all(leases.map(x => x.release())); }
}, 30_000);

test('BizRouter-first uses primary slots, spills overflow, refuses full capacity and returns to primary after release', async () => {
  vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  vi.stubEnv('GEN_BIZROUTER_CONCURRENCY', '2');
  vi.stubEnv('GEMINI_API_KEY', 'fixture-only');
  vi.stubEnv('BIZROUTER_API_KEY', 'fixture-only');
  vi.stubEnv('BIZROUTER_MODEL', 'google/gemini-3.8-flash');
  vi.stubEnv('BIZROUTER_HIGH_MODEL', 'google/gemini-4-argon');
  const code = { html: '<main>test</main>', css: '', javascript: '' };
  const bizrouter = vi.spyOn(BizRouterProvider.prototype, 'generate').mockResolvedValue(code);
  const gemini = vi.spyOn(GeminiProvider.prototype, 'generate').mockResolvedValue(code);
  const leases: Awaited<ReturnType<typeof prepareUserGeneration>>[] = [];
  try {
    const input = { prompt: 'test', system: 'test', mode: 'generate' as const, tier: 'paid' as const };
    for (let i = 0; i < 4; i++) {
      const lease = await prepareUserGeneration(`burst-${i}`, new AbortController().signal);
      leases.push(lease);
      await lease.provider.generate(input);
    }
    expect(bizrouter).toHaveBeenCalledTimes(2);
    expect(gemini).toHaveBeenCalledTimes(2);
    await expect(prepareUserGeneration('full', new AbortController().signal)).rejects.toBeInstanceOf(GenerationBusyError);
    await leases[0].release();
    const replacement = await prepareUserGeneration('recovered', new AbortController().signal);
    leases.push(replacement);
    await replacement.provider.generate(input);
    expect(bizrouter).toHaveBeenCalledTimes(3);
    expect(gemini).toHaveBeenCalledTimes(2);
  } finally { await Promise.all(leases.map(x => x.release())); }
}, 30_000);
