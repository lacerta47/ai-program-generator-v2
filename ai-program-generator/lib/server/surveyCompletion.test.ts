import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSurveyStatuses, openSurvey } from './surveyCompletion';

const { rows, fetchMock } = vi.hoisted(() => ({
  rows: new Map<string, Record<string, Record<string, unknown>>>(),
  fetchMock: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => {
  const snapshot = (path: string) => ({ get: (mode: string) => rows.get(path)?.[mode] });
  return { adminDb: {
    doc: (path: string) => ({ path, get: async () => snapshot(path) }),
    runTransaction: async (apply: (tx: unknown) => unknown) => apply({
      get: async (ref: { path: string }) => snapshot(ref.path),
      set: (ref: { path: string }, fields: Record<string, Record<string, unknown>>) => {
        rows.set(ref.path, { ...rows.get(ref.path), ...fields });
      },
    }),
  } };
});

const code = 'a'.repeat(64);
let since: number;
beforeEach(() => {
  rows.clear();
  since = Date.now() - 10000;
  vi.stubEnv('GOOGLE_SURVEY_SYNC_URL', 'https://script.google.com/macros/s/example/exec');
  vi.stubEnv('GOOGLE_SURVEY_SYNC_SECRET', 'test-only-'.repeat(5));
  fetchMock.mockReset().mockImplementation(async () => Response.json({ ok: true, completed: false, submittedAt: null }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('Google survey completion', () => {
  it('keeps an old invitation and issues a random code instead of exposing the account ID', async () => {
    rows.set('generationFeedback/alice', { create: { offeredAt: since } });
    const url = new URL((await openSurvey('alice', 'create'))!);
    expect(url.hostname).toBe('docs.google.com');
    expect(url.searchParams.get('entry.745368034')).toMatch(/^[a-f0-9]{64}$/);
    expect(url.href).not.toContain('alice');
    expect(rows.get('generationFeedback/alice')?.create.offeredAt).toBe(since);
    expect(rows.get('generationFeedback/alice')?.create.completedAt).toBeUndefined();
  });

  it('only marks completion after Google confirms a submitted matching code', async () => {
    rows.set('generationFeedback/alice', { create: { code, codeCreatedAt: since }, easy: { offeredAt: since } });
    fetchMock.mockImplementation(async () => Response.json({ ok: true, completed: true, submittedAt: since + 5000 }));
    expect(await openSurvey('alice', 'create')).toBeNull();
    expect(rows.get('generationFeedback/alice')?.create.completedAt).toBe(since + 5000);
    expect(await getSurveyStatuses('alice')).toEqual({ create: 'completed', easy: 'available' });
    expect(await openSurvey('alice', 'create')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('allows reopening without submission and uses the same code', async () => {
    rows.set('generationFeedback/alice', { easy: { code, codeCreatedAt: since } });
    const first = await openSurvey('alice', 'easy');
    expect(await openSurvey('alice', 'easy')).toBe(first);
    expect(new URL(first!).searchParams.get('entry.1109935147')).toBe(code);
    expect(await getSurveyStatuses('alice')).toEqual({ create: 'available', easy: 'available' });
    expect(rows.get('generationFeedback/alice')?.easy.completedAt).toBeUndefined();
  });

  it('blocks opening on an authentication, transport or response validation failure', async () => {
    rows.set('generationFeedback/alice', { create: { code, codeCreatedAt: since } });
    for (const result of [
      { ok: false },
      { ok: true, completed: 'true' },
      { ok: true, completed: true, submittedAt: since - 120000 },
      { ok: true, completed: true, submittedAt: Date.now() + 120000 },
    ]) {
      fetchMock.mockResolvedValueOnce(Response.json(result));
      await expect(openSurvey('alice', 'create')).rejects.toThrow();
    }
    fetchMock.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(openSurvey('alice', 'create')).rejects.toThrow();
    expect(rows.get('generationFeedback/alice')?.create.completedAt).toBeUndefined();
  });

  it('rejects an unconfigured or non-Google sync URL before issuing codes', async () => {
    vi.stubEnv('GOOGLE_SURVEY_SYNC_URL', 'https://example.com/exec');
    await expect(openSurvey('alice', 'create')).rejects.toThrow();
    expect(rows.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
