import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_PLAN } from '@/lib/firebase/types';
import { stashEasyDraft, takeEasyDraft, type EasyBridgeDraft } from './easyBridge';

const draft: EasyBridgeDraft = {
  uid: 'student-a',
  code: { html: '작품', css: '', javascript: '' },
  plan: EMPTY_PLAN,
  genPrompt: '요청',
  photo: null,
  meta: { logicSummary: '설명' },
};

describe('easy handoff', () => {
  beforeEach(() => {
    const entries = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      setItem: (key: string, value: string) => entries.set(key, value),
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => entries.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('passes one snapshot and consumes it once', () => {
    expect(stashEasyDraft(draft)).toBe(true);
    expect(takeEasyDraft('student-a')).toEqual({
      code: draft.code, plan: draft.plan, genPrompt: draft.genPrompt, photo: draft.photo, meta: draft.meta,
    });
    expect(takeEasyDraft('student-a')).toBeNull();
  });

  it('discards a work handed off by a different account', () => {
    stashEasyDraft(draft);
    expect(takeEasyDraft('student-b')).toBeNull();
    expect(takeEasyDraft('student-a')).toBeNull();
  });

  it('reports storage failure so the creator can stay on the same screen', () => {
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
    expect(stashEasyDraft(draft)).toBe(false);
  });
});
