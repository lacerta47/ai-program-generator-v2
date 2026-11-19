import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/me/generation-feedback/route';

const { verify, runTransaction, statuses, open } = vi.hoisted(() => ({
  verify: vi.fn(),
  runTransaction: vi.fn(),
  statuses: vi.fn(),
  open: vi.fn(),
}));
vi.mock('@/lib/server/surveyCompletion', () => ({ getSurveyStatuses: statuses, openSurvey: open }));
vi.mock('@/lib/server/verifyActiveToken', () => ({ verifyActiveToken: verify }));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { doc: (path: string) => path, runTransaction } }));

type Entry = { offeredAt?: number; code?: string; codeCreatedAt?: number; completedAt?: number };
type Feedback = Partial<Record<'create' | 'easy', Entry>>;
const records = new Map<string, Feedback>();

function request(body: unknown, token = 'alice') {
  return new NextRequest('https://example.test/api/me/generation-feedback', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  statuses.mockReset().mockResolvedValue({ create: 'available', easy: 'completed' });
  open.mockReset().mockResolvedValue('https://docs.google.com/forms/example');
  records.clear();
  verify.mockReset().mockImplementation(async (token: string) => {
    if (token === 'blocked') throw new Error('ACCOUNT_BLOCKED');
    return { uid: token };
  });
  runTransaction.mockReset().mockImplementation(async (apply) => apply({
    get: async (path: string) => ({ get: (mode: keyof Feedback) => records.get(path)?.[mode] }),
    set: (path: string, fields: Feedback) => records.set(path, { ...records.get(path), ...fields }),
  }));
});

describe('generation feedback', () => {
  it('offers each creation flow once for each authenticated account', async () => {
    expect(await (await POST(request({ mode: 'create' }))).json()).toEqual({ offer: true });
    expect(await (await POST(request({ mode: 'create' }))).json()).toEqual({ offer: false });
    expect(await (await POST(request({ mode: 'easy' }))).json()).toEqual({ offer: true });
    expect(await (await POST(request({ mode: 'easy' }))).json()).toEqual({ offer: false });
    expect(await (await POST(request({ mode: 'create' }, 'bob'))).json()).toEqual({ offer: true });
  });

  it('stores only the invitation under the UID from authentication', async () => {
    expect(await (await POST(request({ mode: 'easy', uid: 'bob' }))).json()).toEqual({ offer: true });
    expect(records.get('generationFeedback/alice')).toEqual({ easy: { offeredAt: expect.any(Number) } });
    expect(records.has('generationFeedback/bob')).toBe(false);
  });

  it('can still offer after an unfinished survey was opened from My Page', async () => {
    records.set('generationFeedback/alice', { create: { code: 'a'.repeat(64), codeCreatedAt: 1 } });
    expect(await (await POST(request({ mode: 'create' }))).json()).toEqual({ offer: true });
    expect(records.get('generationFeedback/alice')?.create?.code).toBe('a'.repeat(64));
  });

  it('does not invite an account that already submitted through My Page', async () => {
    records.set('generationFeedback/alice', { easy: { completedAt: 1 } });
    expect(await (await POST(request({ mode: 'easy' }))).json()).toEqual({ offer: false });
  });

  it('rejects unauthenticated, blocked and invalid submissions before writing', async () => {
    expect((await POST(request({ mode: 'create' }, ''))).status).toBe(401);
    expect((await POST(request({ mode: 'create' }, 'blocked'))).status).toBe(401);
    expect((await POST(request({ mode: 'other' }))).status).toBe(400);
    expect((await POST(request({ mode: 'easy', answer: 'easy' }))).status).toBe(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without writing an invitation', async () => {
    const req = new NextRequest('https://example.test/api/me/generation-feedback', {
      method: 'POST',
      headers: { Authorization: 'Bearer alice' },
      body: '{',
    });
    expect((await POST(req)).status).toBe(400);
    expect(runTransaction).not.toHaveBeenCalled();
  });

  it('reports a database failure without creating an invitation', async () => {
    runTransaction.mockRejectedValueOnce(new Error('database unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await POST(request({ mode: 'create' }))).status).toBe(500);
      expect(records.size).toBe(0);
    } finally {
      log.mockRestore();
    }
  });

  it('reads participation only for the authenticated account and disables caching', async () => {
    const response = await GET(request(null));
    expect(await response.json()).toEqual({ create: 'available', easy: 'completed' });
    expect(statuses).toHaveBeenCalledWith('alice');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await GET(request(null, ''))).status).toBe(401);
  });

  it('opens an unfinished survey and blocks a completed one', async () => {
    expect((await POST(request({ mode: 'easy', action: 'open', uid: 'bob' }))).status).toBe(200);
    expect(open).toHaveBeenCalledWith('alice', 'easy');
    open.mockResolvedValueOnce(null);
    const response = await POST(request({ mode: 'easy', action: 'open' }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('이미 참여한 설문');
  });

  it('does not trust a client completion request and fails closed if Google is unavailable', async () => {
    expect((await POST(request({ mode: 'easy', action: 'complete' }))).status).toBe(400);
    statuses.mockRejectedValueOnce(new Error('unavailable'));
    expect((await GET(request(null))).status).toBe(503);
    open.mockRejectedValueOnce(new Error('unavailable'));
    expect((await POST(request({ mode: 'easy', action: 'open' }))).status).toBe(503);
  });
});
