import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLetter, appendFailure, appendReply } from './lib.mjs';

test('counts Korean reply and follow-up headings through the three-round limit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-bridge-test-'));
  const path = join(dir, 'letter.md');
  try {
    const headings = ['## 답변 (Claude, 시각)', '## 재질문', '## 답변 (Claude, 시각)', '## 재질문', '## 답변 (Claude, 시각)'];
    for (let count = 0; count <= headings.length; count++) {
      writeFileSync(path, `---\nid: test\nfrom: codex\nto: claude\n---\n# 제목\n${headings.slice(0, count).join('\n')}\n`);
      assert.equal(readLetter(path).turns, count);
      assert.equal(readLetter(path).answered, count % 2 === 1);
    }
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});

test('keeps failure evidence without counting it as a successful round', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-bridge-audit-'));
  const path = join(dir, 'letter.md');
  try {
    writeFileSync(path, '---\nid: test\n---\n# Question\n');
    appendFailure(path, { status: 'failed', phase: 'decode', usage: { output_tokens: 17 } });
    assert.equal(readLetter(path).turns, 0);
    assert.equal(readLetter(path).answered, false);
    assert.ok(readFileSync(path, 'utf8').includes('"output_tokens": 17'));
    appendReply(path, 'Claude', 'reply', null, { status: 'success', review_sha: 'a'.repeat(40) });
    assert.equal(readLetter(path).turns, 1);
    assert.equal(readLetter(path).answered, true);
    assert.ok(readFileSync(path, 'utf8').includes('"review_sha": "' + 'a'.repeat(40) + '"'));
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});

test('ignores reply and follow-up examples inside Markdown fences', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-bridge-fences-'));
  const path = join(dir, 'letter.md');
  const reply = '## 답변 (Claude, 시각)';
  const cases = [
    { lines: ['```md', '## 답변', '```'], turns: 0, answered: false },
    { lines: [reply, '  ~~~md', '## 재질문', ' ~~~~'], turns: 1, answered: true },
    { lines: ['````md', '```', '~~~~', '```` trailing', '## 답변', '`````', reply], turns: 1, answered: true },
    { lines: ['```inline```', reply, '## 재질문'], turns: 2, answered: false },
    { lines: ['    ```md', reply], turns: 1, answered: true },
  ];
  try {
    for (const { lines, turns, answered } of cases) {
      writeFileSync(path, ['---', 'id: test', '---', ...lines].join('\r\n'));
      const letter = readLetter(path);
      assert.equal(letter.turns, turns, lines.join('\n'));
      assert.equal(letter.answered, answered, lines.join('\n'));
    }
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});

test('keeps appended replies and failure records outside unclosed fences', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-bridge-close-fences-'));
  const path = join(dir, 'letter.md');
  const question = '---\nid: test\n---\n~~~md\n## 답변\nexample';
  try {
    writeFileSync(path, question);
    appendReply(path, 'Claude', 'answer\n````md\n## 재질문\nexample', null, { status: 'success' });
    const answered = readLetter(path);
    assert.equal(answered.turns, 1);
    assert.equal(answered.answered, true);
    assert.match(answered.text, /example\n~~~\n\n## 답변 /);
    assert.match(answered.text, /example\n````\n\n### 호출 기록/);

    writeFileSync(path, question);
    appendFailure(path, { status: 'failed' });
    const failed = readLetter(path);
    assert.equal(failed.turns, 0);
    assert.equal(failed.answered, false);
    assert.match(failed.text, /example\n~~~\n\n## 호출 실패 /);
  } finally {
    unlinkSync(path);
    rmdirSync(dir);
  }
});
