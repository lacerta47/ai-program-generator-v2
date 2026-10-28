import { describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { PREVIEW_CSP } from './previewHeaders';

describe('미리보기 CSP', () => {
  test('스크립트 격리와 외부 통신 차단을 함께 강제한다', () => {
    expect(PREVIEW_CSP).toContain('sandbox allow-scripts');
    expect(PREVIEW_CSP).toContain("default-src 'none'");
    expect(PREVIEW_CSP).toContain("connect-src 'none'");
    expect(PREVIEW_CSP).toContain('img-src data: blob:');
    expect(PREVIEW_CSP).toContain('https://eduai-lun.co.kr');
  });
});
