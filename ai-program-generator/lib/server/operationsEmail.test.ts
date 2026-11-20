import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/cron/operations-email/route';
import { GET as health } from '@/app/api/health/route';

const { doc, collection, allUserCreationMs, countByCreatedAt } = vi.hoisted(() => ({
  doc: vi.fn(),
  collection: vi.fn(),
  allUserCreationMs: vi.fn(),
  countByCreatedAt: vi.fn(),
}));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { doc, collection } }));
vi.mock('@/lib/server/operationsCounts', () => ({ allUserCreationMs, countByCreatedAt }));

function request(query = '', secret = 'mock-cron') {
  return new NextRequest(`https://example.test/api/cron/operations-email${query}`, {
    headers: { authorization: `Bearer ${secret}` },
  });
}

const fetchMail = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T00:05:00Z'));
  vi.stubEnv('CRON_SECRET', 'mock-cron');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('Resend', 'mock-resend');
  vi.stubEnv('LUN_OPERATIONS_EMAIL_FROM', 'LUN <alerts@example.test>');
  vi.stubEnv('LUN_OPERATIONS_EMAIL_TO', 'admin@example.test');
  vi.stubGlobal('fetch', fetchMail);
  fetchMail.mockImplementation(async () => Response.json({ id: 'mock-email' }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('LUN operations email', () => {
  it('does not access the database or email provider for unauthorized or Preview requests', async () => {
    expect((await GET(request('', 'incorrect'))).status).toBe(401);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await (await GET(request())).json()).toEqual({ status: 'production_only' });
    expect(doc).not.toHaveBeenCalled();
    expect(countByCreatedAt).not.toHaveBeenCalled();
    expect(fetchMail).not.toHaveBeenCalled();
  });

  it('summarizes the previous KST day and distinguishes new pending reports from total pending', async () => {
    const start = Date.parse('2026-11-09T15:00:00Z');
    const end = Date.parse('2026-11-10T15:00:00Z');
    allUserCreationMs.mockResolvedValue([start - 1, start, end - 1, end]);
    doc.mockReturnValue({ get: async () => new Map([['visits', 12], ['genCount', 7]]) });
    collection.mockReturnValue({ count: () => ({ get: async () => ({ data: () => ({ count: 3 }) }) }) });
    countByCreatedAt.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

    expect(await (await GET(request())).json()).toEqual({ status: 'accepted' });
    expect(doc).toHaveBeenCalledWith('stats/2026-11-10');
    expect(countByCreatedAt).toHaveBeenCalledWith('posts', start, end);
    expect(countByCreatedAt).toHaveBeenCalledWith('reports', start, end);
    const [url, options] = fetchMail.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options?.headers).toMatchObject({ 'Idempotency-Key': 'lun-daily/2026-11-10' });
    const message = JSON.parse(String(options?.body));
    expect(message.to).toEqual(['admin@example.test']);
    expect(message.text).toContain('가입 2건');
    expect(message.text).toContain('생성 완료 7건');
    expect(message.text).toContain('당일 접수분 중 미처리 신고 1건');
    expect(message.text).toContain('현재 전체 미처리 신고 3건');
  });

  it('only sends an hourly alert for a completed window with pending reports', async () => {
    countByCreatedAt.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    expect(await (await GET(request('?mode=reports'))).json()).toEqual({ status: 'no_reports' });
    expect(fetchMail).not.toHaveBeenCalled();

    expect(await (await GET(request('?mode=reports'))).json()).toEqual({ status: 'accepted' });
    expect(countByCreatedAt).toHaveBeenCalledWith('reports', Date.parse('2026-11-10T23:00:00Z'), Date.parse('2026-11-11T00:00:00Z'));
    expect(fetchMail.mock.calls[0][1]?.headers).toMatchObject({ 'Idempotency-Key': 'lun-reports/2026-11-10T23:00:00.000Z' });
    expect(doc).not.toHaveBeenCalled();
    expect(allUserCreationMs).not.toHaveBeenCalled();
  });

  it('distinguishes an already used period from a request still in progress', async () => {
    countByCreatedAt.mockResolvedValue(1);
    fetchMail.mockResolvedValueOnce(Response.json({ name: 'invalid_idempotent_request' }, { status: 409 }));
    fetchMail.mockResolvedValueOnce(Response.json({ name: 'concurrent_idempotent_requests' }, { status: 409 }));
    expect(await (await GET(request('?mode=reports'))).json()).toEqual({ status: 'duplicate_period' });
    expect((await GET(request('?mode=reports'))).status).toBe(502);
  });

  it('exposes only uncached process liveness in the public health response', async () => {
    const response = health();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true });
    expect(doc).not.toHaveBeenCalled();
  });
});
