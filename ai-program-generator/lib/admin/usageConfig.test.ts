import { afterAll, beforeEach, expect, test, vi } from 'vitest';

const { get, set, remove } = vi.hoisted(() => {
  vi.stubEnv('GEN_TOTAL_LIMIT', '');
  vi.stubEnv('GEN_DAILY_LIMIT', '20');
  return { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
});
vi.mock('@/lib/firebase/admin', () => ({ adminDb: { doc: (path: string) => ({
  get: () => get(path), set: (data: unknown) => set(path, data), delete: () => remove(path),
}) } }));
import { configuredTotalLimit, readEffectiveTotalLimit, setUserLimit, clearUserLimit } from './usageConfig';

beforeEach(() => { get.mockReset(); set.mockReset(); remove.mockReset(); });
afterAll(() => vi.unstubAllEnvs());

test('설정과 맞춤 한도가 없으면 일반 회원 기본 총 한도는 5회', async () => {
  get.mockResolvedValue({ data: () => undefined });
  expect(await readEffectiveTotalLimit('member')).toBe(5);
});

test('기존 전역 일일 20회와 환경변수는 기본 총 5회를 덮어쓰지 않는다', async () => {
  get.mockImplementation(async (path) => ({ data: () => path === 'config/usage' ? { dailyLimit: 20 } : undefined }));
  expect(await readEffectiveTotalLimit('member')).toBe(5);
});

test('기존 한도 숫자를 계승하고 새 총 한도와 0 설정을 우선한다', () => {
  expect(configuredTotalLimit({ dailyLimit: 20 })).toBe(20);
  expect(configuredTotalLimit({ dailyLimit: 20, totalLimit: 0 })).toBe(0);
  expect(configuredTotalLimit({ totalLimit: 5 })).toBe(5);
  expect(configuredTotalLimit(undefined)).toBeNull();
});

test('회원 맞춤값이 전역값보다 우선한다', async () => {
  get.mockResolvedValue({ data: () => ({ dailyLimit: 7 }) });
  expect(await readEffectiveTotalLimit('member')).toBe(7);
  expect(get).toHaveBeenCalledTimes(1);
});

test('맞춤값이 없으면 전역 총 한도를 읽는다', async () => {
  get.mockImplementation(async (path) => ({ data: () => path === 'config/usage' ? { totalLimit: 20 } : undefined }));
  expect(await readEffectiveTotalLimit('member')).toBe(20);
});

test('DB 오류를 기본값으로 바꾸어 생성을 허용하지 않는다', async () => {
  get.mockRejectedValue(new Error('db unavailable'));
  await expect(readEffectiveTotalLimit('member')).rejects.toThrow('db unavailable');
});

test('한도 수정/기본값 복귀는 누적 사용량을 초기화하지 않는다', async () => {
  await setUserLimit('member', 30);
  expect(set).toHaveBeenCalledWith('limits/member', expect.objectContaining({ totalLimit: 30 }));
  await clearUserLimit('member');
  expect(remove).toHaveBeenCalledWith('limits/member');
  expect(set).toHaveBeenCalledTimes(1);
});
