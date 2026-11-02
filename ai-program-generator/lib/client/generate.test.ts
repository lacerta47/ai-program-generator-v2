import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/client/authedFetch', () => ({ authedFetch: fetchMock }));
import { requestGenerateStream } from './generate';

const code = { html: '<main>test</main>', css: '', javascript: '' };
const busy = (retryAfter = '3') => Response.json({ error: '혼잡', code: 'generation_busy', retryable: true }, { status: 503, headers: { 'Retry-After': retryAfter } });
const success = () => new Response(JSON.stringify({ type: 'done', code }) + '\n');

beforeEach(() => {
  fetchMock.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-31T00:00:00Z'));
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

test.each(['generate', 'modify'] as const)('%s 혼잡 뒤 동일한 입력·사진·유형으로 재시도하고 정상 스트림을 받는다', async (mode) => {
  fetchMock.mockResolvedValueOnce(busy()).mockResolvedValueOnce(success());
  const onWaiting = vi.fn();
  const promise = requestGenerateStream('내 계획', mode, 'survey', { photo: 'fixture-photo', programType: 'quiz', onWaiting });
  await vi.advanceTimersByTimeAsync(0);
  expect(onWaiting).toHaveBeenLastCalledWith(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3500);
  expect(await promise).toEqual(code);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ prompt: '내 계획', mode, variant: 'survey', photo: 'fixture-photo', programType: 'quiz' });
  expect(onWaiting).toHaveBeenLastCalledWith(false);
  expect(vi.getTimerCount()).toBe(0);
});

test.each(['7', 'Sat, 31 Oct 2026 00:00:07 GMT'])('Retry-After %s와 무작위 지연 전에 호출하지 않는다', async (header) => {
  fetchMock.mockResolvedValueOnce(busy(header)).mockResolvedValueOnce(success());
  const promise = requestGenerateStream('계획', 'generate');
  await vi.advanceTimersByTimeAsync(7499);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(await promise).toEqual(code);
});

test('연속 혼잡은 재시도 간격을 늘린다', async () => {
  fetchMock.mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockResolvedValueOnce(success());
  const promise = requestGenerateStream('계획', 'generate');
  await vi.advanceTimersByTimeAsync(3500);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(6499);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(await promise).toEqual(code);
});

test.each([400, 401, 403, 429, 500, 503])('일반 HTTP %i 오류는 자동 재시도하지 않는다', async (status) => {
  fetchMock.mockResolvedValue(Response.json({ error: '중단' }, { status }));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow('중단');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('혼잡 코드만 있고 명시적 재시도 허용이 없으면 중단한다', async () => {
  fetchMock.mockResolvedValue(Response.json({ code: 'generation_busy' }, { status: 503 }));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow('503');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('공급사 접수 여부가 불명확한 통신 실패는 다시 보내지 않는다', async () => {
  fetchMock.mockRejectedValue(new TypeError('connection lost'));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow('connection lost');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('부분 출력 뒤의 스트림 오류는 다시 생성하지 않는다', async () => {
  const onDelta = vi.fn();
  fetchMock.mockResolvedValue(new Response([
    JSON.stringify({ type: 'delta', partial: { html: '<main>' } }),
    JSON.stringify({ type: 'error', error: '공급사 오류' }), '',
  ].join('\n')));
  await expect(requestGenerateStream('계획', 'generate', 'default', { onDelta })).rejects.toThrow('공급사 오류');
  expect(onDelta).toHaveBeenCalledOnce();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('완료 데이터 없이 끝난 스트림도 자동 재호출하지 않는다', async () => {
  fetchMock.mockResolvedValue(new Response(''));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow('생성 결과를 받지 못했어요');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('대기 취소는 타이머를 제거하고 추가 요청을 막는다', async () => {
  fetchMock.mockResolvedValue(busy());
  const controller = new AbortController();
  const onWaiting = vi.fn();
  const promise = requestGenerateStream('계획', 'generate', 'default', { signal: controller.signal, onWaiting });
  const rejected = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await rejected;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(onWaiting).toHaveBeenLastCalledWith(false);
  expect(vi.getTimerCount()).toBe(0);
});

test('취소된 요청은 최초 입장 요청도 보내지 않는다', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(requestGenerateStream('계획', 'generate', 'default', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('반복 혼잡은 120초·최대 10회 재시도 범위 안에서 끝난다', async () => {
  const start = Date.now();
  fetchMock.mockImplementation(async () => busy());
  const onWaiting = vi.fn();
  const result = requestGenerateStream('계획', 'generate', 'default', { onWaiting }).catch(e => e);
  await vi.runAllTimersAsync();
  expect((await result).message).toContain('잠깐 쉬었다가');
  expect(Date.now() - start).toBeLessThanOrEqual(120_000);
  expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(11);
  expect(onWaiting).toHaveBeenLastCalledWith(false);
  expect(vi.getTimerCount()).toBe(0);
});

test('백그라운드 탭의 지연된 타이머가 대기 기한을 넘기면 새 요청을 보내지 않는다', async () => {
  fetchMock.mockImplementation(async () => busy());
  const result = requestGenerateStream('계획', 'generate').catch(e => e);
  await vi.advanceTimersByTimeAsync(0);
  vi.setSystemTime(Date.now() + 120_001);
  await vi.advanceTimersByTimeAsync(3500);
  expect((await result).message).toContain('잠깐 쉬었다가');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('서버의 대기 지시가 남은 2분을 넘으면 조기 재호출하지 않는다', async () => {
  fetchMock.mockResolvedValue(busy('180'));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow('잠깐 쉬었다가');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

test('두 번째 입장 요청의 응답을 기다리다 취소하면 추가 재시도를 하지 않는다', async () => {
  const controller = new AbortController();
  fetchMock.mockResolvedValueOnce(busy()).mockImplementationOnce((_path, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
  }));
  const result = requestGenerateStream('계획', 'generate', 'default', { signal: controller.signal }).catch(e => e);
  await vi.advanceTimersByTimeAsync(3500);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

test('학생 30명의 독립 대기 중 5명 취소 시 25명만 한 번 재입장한다', async () => {
  const attempts = new Map<string, number>();
  fetchMock.mockImplementation(async (_path, init) => {
    const prompt = JSON.parse(init.body).prompt;
    const count = (attempts.get(prompt) ?? 0) + 1;
    attempts.set(prompt, count);
    return count === 1 ? busy() : success();
  });
  const controllers = Array.from({ length: 30 }, () => new AbortController());
  const results = controllers.map((controller, i) => requestGenerateStream('학생-' + i, 'generate', 'default', { signal: controller.signal }).catch(e => e));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetchMock).toHaveBeenCalledTimes(30);
  controllers.slice(0, 5).forEach(controller => controller.abort());
  await vi.runAllTimersAsync();
  const completed = await Promise.all(results);
  expect(completed.slice(0, 5).every(x => x.name === 'AbortError')).toBe(true);
  expect(completed.slice(5).every(x => x.html === code.html)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(55);
  expect(vi.getTimerCount()).toBe(0);
});

test.each([401, 403, 429, 500])('재시도 허용 코드가 붙어도 HTTP %i는 재시도하지 않는다', async (status) => {
  fetchMock.mockResolvedValue(Response.json({ code: 'generation_busy', retryable: true }, { status }));
  await expect(requestGenerateStream('계획', 'generate')).rejects.toThrow(String(status));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
