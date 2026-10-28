import { beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ data: undefined as Record<string, unknown> | undefined }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: { doc: () => ({ get: async () => ({ data: () => state.data }) }) },
}));

import { PHOTO_CONSENT_VERSION, hasPhotoConsent } from './photoConsent';

describe('사진 국외 전송 동의', () => {
  beforeEach(() => { state.data = undefined; });

  test('현재 방침 버전과 동의 시각이 모두 있어야 인정한다', async () => {
    expect(await hasPhotoConsent('student-a')).toBe(false);
    state.data = { policyVersion: 'old', agreedAt: Date.now() };
    expect(await hasPhotoConsent('student-a')).toBe(false);
    state.data = { policyVersion: PHOTO_CONSENT_VERSION, agreedAt: Date.now() };
    expect(await hasPhotoConsent('student-a')).toBe(true);
  });
});
