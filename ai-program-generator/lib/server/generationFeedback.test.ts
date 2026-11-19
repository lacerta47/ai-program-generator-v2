import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/me/generation-feedback/route';

const { verify, runTransaction } = vi.hoisted(() => ({
  verify: vi.fn(),
  runTransaction: vi.fn(),
}));
vi.mock('@/lib/server/verifyActiveToken', () => ({ verifyActiveToken: verify }));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { doc: (path: string) => path, runTransaction } }));

type Entry = { offeredAt: number };
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
});
