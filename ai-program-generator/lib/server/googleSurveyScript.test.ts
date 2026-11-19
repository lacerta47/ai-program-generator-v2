import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

describe('Google survey script', () => {
  it('requires the server secret and only confirms a matching submitted form code', () => {
    const code = 'a'.repeat(64);
    const timestamp = Date.now() - 1000;
    const getResponses = vi.fn(() => [{
      getItemResponses: () => [{ getItem: () => ({ getId: () => 1325396999 }), getResponse: () => code }],
      getTimestamp: () => new Date(timestamp),
    }]);
    const source = readFileSync(resolve(process.cwd(), 'scripts/google-survey-sync.gs'), 'utf8');
    const script = runInNewContext(`${source}\n({ doPost });`, {
      PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-only-'.repeat(5) }) },
      ContentService: {
        MimeType: { JSON: 'json' },
        createTextOutput: (value: string) => ({ setMimeType: () => JSON.parse(value) }),
      },
      FormApp: { openById: () => ({ getResponses }) },
    });
    const post = (body: unknown) => script.doPost({ postData: { contents: JSON.stringify(body) } });
    const body = { secret: 'test-only-'.repeat(5), mode: 'create', code, since: timestamp - 1000 };
    expect(post({ ...body, secret: 'wrong' })).toEqual({ ok: false });
    expect(post({ ...body, mode: '__proto__' })).toEqual({ ok: false });
    expect(getResponses).not.toHaveBeenCalled();
    expect(post(body)).toEqual({ ok: true, completed: true, submittedAt: timestamp });
    expect(post({ ...body, code: 'b'.repeat(64) })).toEqual({ ok: true, completed: false, submittedAt: null });
    expect(post({ ...body, mode: 'easy' })).toEqual({ ok: true, completed: false, submittedAt: null });
  });
});
