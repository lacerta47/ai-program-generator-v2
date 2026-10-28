import { afterEach, describe, expect, test, vi } from 'vitest';
import { previewOrigin } from './previewOrigin';

describe('미리보기 출처', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test('운영 앱과 같은 출처를 거부한다', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'eduai-lun.co.kr', port: '', origin: 'https://eduai-lun.co.kr' } });
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_ORIGIN', 'https://eduai-lun.co.kr');
    expect(previewOrigin).toThrow('PREVIEW_ORIGIN_UNSAFE');
  });

  test('별도 HTTPS 출처만 반환한다', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:', hostname: 'eduai-lun.co.kr', port: '', origin: 'https://eduai-lun.co.kr' } });
    vi.stubEnv('NEXT_PUBLIC_PREVIEW_ORIGIN', 'https://ai-program-generator-v2-preview.vercel.app/');
    expect(previewOrigin()).toBe('https://ai-program-generator-v2-preview.vercel.app');
  });

  test('로컬 개발에서는 localhost와 127.0.0.1을 교차 사용한다', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:', hostname: 'localhost', port: '3000', origin: 'http://localhost:3000' } });
    expect(previewOrigin()).toBe('http://127.0.0.1:3000');
  });
});
