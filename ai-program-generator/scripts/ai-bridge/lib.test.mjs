import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLetter } from './lib.mjs';

test('counts Korean reply and follow-up headings through the three-round limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-bridge-test-'));
  const path = join(dir, 'letter.md');
  try {
    const headings = ['## 답변 (Claude, 시각)', '## 재질문', '## 답변 (Claude, 시각)', '## 재질문', '## 답변 (Claude, 시각)'];
    for (let count = 0; count <= headings.length; count++) {
      writeFileSync(path, `---\nid: test\nfrom: codex\nto: claude\n---\n# 제목\n${headings.slice(0, count).join('\n')}\n`);
      assert.equal(readLetter(path).turns, count);
    }
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});
