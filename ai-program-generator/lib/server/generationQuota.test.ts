import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(), limit: vi.fn(), reserve: vi.fn(), refund: vi.fn(),
  studentReserve: vi.fn(), studentRefund: vi.fn(), stream: vi.fn(), exemplar: vi.fn(),
  transaction: vi.fn(), get: vi.fn(), set: vi.fn(), provider: vi.fn(), release: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/verifyActiveToken', () => ({ verifyActiveToken: mocks.verify }));
vi.mock('@/lib/admin/usageConfig', () => ({ readEffectiveTotalLimit: mocks.limit, ROLE_DAILY_LIMIT: 100 }));
vi.mock('@/lib/server/memberQuota', () => ({ reserveMemberQuota: mocks.reserve, refundMemberQuota: mocks.refund }));
vi.mock('@/lib/server/studentQuota', () => ({ reserveStudentQuota: mocks.studentReserve, refundStudentQuota: mocks.studentRefund }));
vi.mock('@/lib/ai/provider', () => ({ prepareUserGeneration: mocks.provider }));
vi.mock('@/lib/admin/exemplars', () => ({ getExemplar: mocks.exemplar, isProgramTypeId: () => false }));
vi.mock('@/lib/ai/typeGuides', () => ({ getTypeGuide: () => '' }));
vi.mock('@/lib/server/genRate', () => ({ allowGenerate: async () => true }));
vi.mock('@/lib/server/photoConsent', () => ({ hasPhotoConsent: async () => true }));
vi.mock('@/lib/server/gateStats', () => ({ recordGateFail: vi.fn() }));
vi.mock('@/lib/firebase/admin', () => ({ adminDb: {
  doc: (path: string) => ({ path, get: () => mocks.get(path) }),
  collection: () => ({ doc: (path: string) => ({ path }) }),
  runTransaction: mocks.transaction,
} }));

import { POST } from '@/app/api/generate/route';
import { GenerationBusyError, UserFacingError } from '@/lib/ai/errors';
import { GET as getUsage } from '@/app/api/me/usage/route';
const request = () => new NextRequest('http://localhost/api/generate', {
  method: 'POST', headers: { authorization: 'Bearer mock-token' },
  body: JSON.stringify({ prompt: '테스트', mode: 'generate' }),
});

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.verify.mockResolvedValue({ uid: 'member', email_verified: true });
  mocks.limit.mockResolvedValue(20);
  mocks.reserve.mockResolvedValue(true);
  mocks.studentReserve.mockResolvedValue({ ok: true });
  mocks.release.mockResolvedValue(undefined);
  mocks.provider.mockImplementation(async (_id, signal) => ({ provider: { generateStream: mocks.stream }, signal, release: mocks.release }));
  mocks.exemplar.mockResolvedValue(null);
  mocks.stream.mockImplementation(async function* () { yield { type: 'done', code: { html: '<main>test</main>' } }; });
  mocks.get.mockResolvedValue({ data: () => ({ count: 3 }) });
  mocks.transaction.mockImplementation(async (fn) => fn({
    get: async () => ({ data: () => ({ count: 0 }) }), set: mocks.set,
  }));
});

describe('생성 API 역할별 한도 연결 — 실제 AI 호출 없음', () => {
  test.each(['google.com', 'password'])('%s 일반 회원은 총 한도 경로를 사용', async (provider) => {
    mocks.verify.mockResolvedValue({ uid: 'member', email_verified: true, firebase: { sign_in_provider: provider } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"type":"done"');
    expect(mocks.reserve).toHaveBeenCalledWith('member', 20, 1, expect.any(String));
    expect(mocks.studentReserve).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  test('총 한도 소진 시 AI를 호출하지 않고 추가 이용 안내', async () => {
    mocks.reserve.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain('총 20번');
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  test('한도 조회 실패 시 생성과 차감을 진행하지 않는다', async () => {
    mocks.limit.mockRejectedValue(new Error('DB unavailable'));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  test('생성 준비 실패에도 선점한 총 한도를 환불한다', async () => {
    mocks.exemplar.mockRejectedValue(new Error('exemplar unavailable'));
    expect((await POST(request())).status).toBe(500);
    expect(mocks.refund).toHaveBeenCalledTimes(1);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  test('AI 실패 시 총 한도를 예약일 기준으로 환불한다', async () => {
    mocks.stream.mockImplementation(async function* () { yield { type: 'delta', text: 'mock' }; throw new Error('mock failure'); });
    const response = await POST(request());
    expect(await response.text()).toContain('"type":"error"');
    const reservation = mocks.reserve.mock.calls[0];
    expect(mocks.refund).toHaveBeenCalledExactlyOnceWith('member', 1, reservation[3]);
  });

  test('스트림 취소와 뒤늦은 오류가 겹쳐도 환불은 한 번만 한다', async () => {
    let resume!: () => void;
    const wait = new Promise<void>((resolve) => { resume = resolve; });
    mocks.stream.mockImplementation(async function* () {
      yield { type: 'delta', text: 'mock' };
      await wait;
      throw new Error('cancelled mock');
    });
    const response = await POST(request());
    const reader = response.body!.getReader();
    await reader.read();
    const cancelled = reader.cancel();
    resume();
    await cancelled;
    await vi.waitFor(() => expect(mocks.refund).toHaveBeenCalledTimes(1));
  });

  test('학생은 기존 학급 한도를 사용한다', async () => {
    mocks.verify.mockResolvedValue({ uid: 'student', student: true });
    const response = await POST(request());
    await response.text();
    expect(mocks.studentReserve).toHaveBeenCalledWith('student', 1, expect.any(String));
    expect(mocks.reserve).not.toHaveBeenCalled();
  });

  test.each(['teacher', 'admin'])('%s는 기존 일일 카운터를 사용한다', async (role) => {
    mocks.verify.mockResolvedValue({ uid: role, [role]: true });
    const response = await POST(request());
    await response.text();
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining(role) }), expect.objectContaining({ count: 1 }), { merge: true });
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
});

test('슬롯이 가득 차면 한도 예약·환불·AI 호출 없이 재시도 안내', async () => {
  mocks.provider.mockRejectedValue(new GenerationBusyError());
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(Number(response.headers.get('Retry-After'))).toBeGreaterThanOrEqual(3);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.refund).not.toHaveBeenCalled();
  expect(mocks.stream).not.toHaveBeenCalled();
});

test('입력·인증 검증 실패 시 슬롯도 예약하지 않는다', async () => {
  const response = await POST(new NextRequest('http://localhost/api/generate', { method: 'POST' }));
  expect(response.status).toBe(401);
  expect(mocks.provider).not.toHaveBeenCalled();
});

test('성공·실패 모두 슬롯을 한 번 해제한다', async () => {
  const response = await POST(request());
  await response.text();
  await vi.waitFor(() => expect(mocks.release).toHaveBeenCalledOnce());
});

test('임대 갱신 실패는 사용자 취소와 달리 오류를 전달하고 한 번 환불한다', async () => {
  const lost = new AbortController();
  mocks.provider.mockResolvedValue({ provider: { generateStream: mocks.stream }, signal: lost.signal, release: mocks.release });
  mocks.stream.mockImplementation(async function* () {
    yield { type: 'delta', partial: { html: '<main>' } };
    lost.abort(new UserFacingError('연결을 확인하지 못했어요.'));
    lost.signal.throwIfAborted();
  });
  expect(await (await POST(request())).text()).toContain('연결을 확인하지 못했어요.');
  expect(mocks.refund).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
});

test('마이페이지는 일반 회원의 총 사용량과 kind=total을 반환한다', async () => {
  const response = await getUsage(new NextRequest('http://localhost/api/me/usage', { headers: { authorization: 'Bearer mock-token' } }));
  expect(await response.json()).toEqual({ used: 3, limit: 20, unlimited: false, kind: 'total' });
  expect(mocks.get).toHaveBeenCalledWith('memberUsage/member');
});

test('전환 후 사용 이력이 없는 회원은 총 사용 0회로 표시한다', async () => {
  mocks.get.mockResolvedValue({ data: () => undefined });
  const response = await getUsage(new NextRequest('http://localhost/api/me/usage', { headers: { authorization: 'Bearer mock-token' } }));
  expect(await response.json()).toEqual({ used: 0, limit: 20, unlimited: false, kind: 'total' });
});
