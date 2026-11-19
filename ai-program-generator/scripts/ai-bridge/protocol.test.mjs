import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settingsFor, validateLetter, validateReviewContext, planExecution, commandArgs, parseResponse, replyIdentity, requireSuccess } from './protocol.mjs';
import { buildPrompt } from './lib.mjs';

const sha = 'a'.repeat(40);
const head = 'b'.repeat(40);
const letter = { path: '/letters/test.md', meta: { id: '2026-11-19-test', from: 'codex', to: 'claude', kind: 'review', sha }, text: 'test' };
const header = `원문 id: ${letter.meta.id} · 확인 HEAD: ${head} · 검토 SHA: ${sha}`;
const jsonl = (...events) => events.map((event) => JSON.stringify(event)).join('\n');

test('requires pinned models and explicit supported effort', () => {
  assert.deepEqual(settingsFor({ claude: { model: 'claude-opus-5-5', effort: 'medium' } }, 'claude'),
    { model: 'claude-opus-5-5', effort: 'medium', tier: 'normal' });
  for (const value of [{ model: 'opus', effort: 'medium' }, { model: 'OPUS', effort: 'medium' }, { model: '', effort: 'medium' },
    { model: 'claude-fable-5-2' }, { model: 'claude-fable-5-2', effort: 'automatic' }]) {
    assert.throws(() => settingsFor({ claude: value }, 'claude'));
  }
});

test('high tier uses its own pinned settings and never falls back silently', () => {
  const config = { claude: { model: 'claude-opus-5-5', effort: 'medium' },
    tiers: { high: { claude: { model: 'claude-fable-5-2', effort: 'high' } } } };
  assert.deepEqual(settingsFor(config, 'claude', 'high'), { model: 'claude-fable-5-2', effort: 'high', tier: 'high' });
  assert.throws(() => settingsFor(config, 'codex', 'high'));
  assert.throws(() => settingsFor(config, 'claude', 'urgent'));
  const shipped = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
  for (const target of ['codex', 'claude']) for (const tier of ['normal', 'high']) settingsFor(shipped, target, tier);
});

test('rejects short SHA, unknown tier, and letters routed to the wrong reviewer', () => {
  validateLetter(letter, 'claude');
  validateLetter({ meta: { ...letter.meta, tier: 'high' } }, 'claude');
  assert.throws(() => validateLetter({ meta: { ...letter.meta, sha: 'abcdef1' } }, 'claude'));
  assert.throws(() => validateLetter({ meta: { ...letter.meta, tier: 'urgent' } }, 'claude'));
  assert.throws(() => validateLetter(letter, 'codex'));
});

test('uses the current tree only when it is exactly the reviewed commit and clean', () => {
  assert.equal(planExecution(sha, sha, false), 'current');
  assert.equal(planExecution(sha, head, false), 'temp_worktree');
  assert.equal(planExecution(sha, sha, true), 'temp_worktree');
});

test('both CLIs receive explicit settings without weakening session or tool restrictions', () => {
  const codex = commandArgs('codex', { model: 'gpt-6.1-sol', effort: 'medium' }, '/repo');
  assert.equal(codex[codex.indexOf('--model') + 1], 'gpt-6.1-sol');
  assert.ok(codex.includes('model_reasoning_effort="medium"'));
  assert.ok(codex.includes('read-only') && codex.includes('--ephemeral') && codex.includes('--json'));
  assert.ok(codex.includes('--ignore-user-config'));
  const claude = commandArgs('claude', { model: 'claude-fable-5-2', effort: 'medium' }, '/repo');
  assert.equal(claude[claude.indexOf('--model') + 1], 'claude-fable-5-2');
  assert.equal(claude[claude.indexOf('--effort') + 1], 'medium');
  assert.ok(claude.includes('stream-json') && claude.includes('--no-session-persistence'));
  assert.equal(claude[claude.indexOf('--permission-mode') + 1], 'dontAsk');
  assert.ok(!claude.includes('Edit') && !claude.includes('Write'));
  assert.ok(claude.includes('--safe-mode') && claude.includes('--strict-mcp-config') && claude.includes('mcp__*'));
  assert.ok(claude.includes('--restricted') && claude.includes('Read(**/.env.local)') && claude.includes('Read(**/serviceAccountKey.json)'));
  assert.equal(claude[claude.indexOf('--tools') + 1], 'Read,Glob,Grep');
  assert.ok(claude.includes('{"mcpServers":{}}'));
  assert.ok(!claude.some((arg) => arg.startsWith('Bash(') && arg.includes('*')));
});

test('requires the reviewed commit to match a clean working tree', () => {
  validateReviewContext(sha, sha, false);
  assert.throws(() => validateReviewContext(sha, head, false));
  assert.throws(() => validateReviewContext(sha, sha, true));
});

test('uses assistant response model, ignoring selected model, helper usage, and self-report', () => {
  const result = parseResponse('claude', jsonl(
    { type: 'system', subtype: 'init', model: 'requested-model' },
    { type: 'assistant', message: { model: 'actual-model', content: [] } },
    { type: 'assistant', message: { model: '<synthetic>' } },
    { type: 'result', subtype: 'success', is_error: false, result: 'I am requested-model',
      modelUsage: { 'helper-model': {} }, usage: { input_tokens: 12, output_tokens: 4, arbitrary: 'not copied' } },
  ));
  assert.deepEqual(result.response_models, ['actual-model']);
  assert.equal(result.response_model_source, 'assistant.message.model');
  assert.deepEqual(result.usage, { input_tokens: 12, output_tokens: 4 });
});

test('keeps all observed reply models rather than hiding a model switch', () => {
  const result = parseResponse('claude', jsonl(
    { type: 'assistant', message: { model: 'first-model' } },
    { type: 'assistant', message: { model: 'second-model' } },
    { type: 'result', subtype: 'success', result: 'reply' },
  ));
  assert.deepEqual(result.response_models, ['first-model', 'second-model']);
});

test('marks Codex response model unavailable instead of inventing it from text', () => {
  const result = parseResponse('codex', jsonl(
    { type: 'thread.started', thread_id: 'example' },
    { type: 'item.completed', item: { type: 'agent_message', text: 'I use model-X' } },
    { type: 'turn.completed', usage: { input_tokens: 20, output_tokens: 5 } },
  ));
  assert.deepEqual(result.response_models, []);
  assert.equal(result.response_model_source, 'not_exposed_by_cli');
  assert.equal(result.reply, 'I use model-X');
});

test('rejects malformed, failed, and incomplete structured responses', () => {
  assert.throws(() => parseResponse('claude', 'not json'));
  assert.throws(() => parseResponse('claude', jsonl({ type: 'result', subtype: 'error', result: 'partial' })));
  assert.throws(() => parseResponse('codex', jsonl({ type: 'item.completed', item: { type: 'agent_message', text: 'partial' } })));
  assert.throws(() => parseResponse('codex', jsonl({ type: 'turn.failed' }, { type: 'turn.completed' })));
});

test('checks letter identity, caller HEAD, and reviewed SHA separately', () => {
  assert.deepEqual(replyIdentity(header, letter, head), { reported_head: head, reported_review_sha: sha });
  assert.equal(replyIdentity(header.replace(head, '미확인'), letter, head).reported_head, null);
  assert.throws(() => replyIdentity(header.replace(sha, 'c'.repeat(40)), letter, head));
  assert.throws(() => replyIdentity(header.replace(head, sha), letter, head));
  assert.throws(() => replyIdentity(`Acknowledged\n${header}`, letter, head));
});

test('preserves available usage and model evidence from a failed Claude result', () => {
  assert.throws(() => parseResponse('claude', jsonl(
    { type: 'assistant', message: { model: 'observed-model' } },
    { type: 'result', subtype: 'error_max_turns', is_error: true, usage: { output_tokens: 17 } },
  )), (error) => {
    assert.deepEqual(error.evidence.response_models, ['observed-model']);
    assert.equal(error.evidence.usage.output_tokens, 17);
    return true;
  });
});

test('keeps valid prefix evidence when output is truncated, without accepting a reply', () => {
  const partial = jsonl(
    { type: 'assistant', message: { model: 'observed-model' } },
    { type: 'result', subtype: 'success', result: 'partial reply', usage: { output_tokens: 7 } },
  ) + '\n{"unfinished';
  assert.throws(() => parseResponse('claude', partial), (error) => {
    assert.deepEqual(error.evidence.response_models, ['observed-model']);
    assert.equal(error.evidence.usage.output_tokens, 7);
    return true;
  });
});

test('nonzero exit, timeout, and empty stdout are never treated as replies', () => {
  assert.throws(() => requireSuccess({ status: 1, stdout: 'partial' }));
  assert.throws(() => requireSuccess({ status: 0, stdout: 'partial', timedOut: true }));
  assert.throws(() => requireSuccess({ status: 0, stdout: '' }));
  requireSuccess({ status: 0, stdout: 'response' });
});

test('both directions receive identical master policy and SHA header requirements', () => {
  const policy = 'Shared rules: preserve main and user work.';
  for (const target of ['codex', 'claude']) {
    const prompt = buildPrompt(letter, target, policy);
    assert.ok(prompt.includes(policy));
    assert.ok(prompt.includes(`검토 SHA: ${sha}`));
    assert.ok(prompt.includes('자기보고로 확정하지 마세요'));
  }
});
