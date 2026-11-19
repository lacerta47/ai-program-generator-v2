import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, MAX_TURNS, readLetter, appendReply, buildPrompt, runCli, pickLetter } from './lib.mjs';
import { settingsFor, validateLetter, commandArgs, parseResponse, replyIdentity, requireSuccess } from './protocol.mjs';

export function runBridge(target) {
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
  const path = pickLetter(target, process.argv[2]);
  const letter = readLetter(path);
  validateLetter(letter, target);
  if (letter.turns >= MAX_TURNS * 2 - 1) throw new Error(`왕복 상한(${MAX_TURNS})에 도달: ${path}`);
  const settings = settingsFor(JSON.parse(readFileSync(join(ROOT, 'scripts/ai-bridge/config.json'), 'utf8')), target);
  const reviewSha = git('rev-parse', '--verify', `${letter.meta.sha}^{commit}`);
  const head = git('rev-parse', 'HEAD');
  const dirty = Boolean(git('status', '--porcelain', '--untracked-files=all'));
  const policyPath = join(ROOT, 'AGENTS.md');
  const policy = readFileSync(policyPath, 'utf8');
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  const policyHash = hash(policy);
  const bin = process.env[target === 'codex' ? 'CODEX_BIN' : 'CLAUDE_BIN'] || target;
  const version = runCli(bin, ['--version'], { timeoutMs: 15_000 });
  requireSuccess(version);
  const started = Date.now();
  const result = runCli(bin, commandArgs(target, settings, ROOT), {
    input: buildPrompt(letter, target, policy), timeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 600_000),
  });
  requireSuccess(result);
  const parsed = parseResponse(target, result.stdout);
  const identity = replyIdentity(parsed.reply, letter, head);
  const headAfter = git('rev-parse', 'HEAD');
  if (headAfter !== head || hash(readFileSync(policyPath, 'utf8')) !== policyHash || readLetter(path).text !== letter.text) {
    throw new Error('호출 중 HEAD·공통 지침·편지가 바뀌어 답신을 저장하지 않았습니다.');
  }
  const modelMatch = parsed.response_models.length ? parsed.response_models.every((model) => model === settings.model) : null;
  const audit = {
    target, requested_model: settings.model, requested_effort: settings.effort,
    response_models: parsed.response_models, response_model_source: parsed.response_model_source,
    model_match: modelMatch, response_effort: null, response_effort_source: 'not_exposed_by_cli',
    review_sha: reviewSha, head_before: head, head_after: headAfter, ...identity,
    worktree_dirty: dirty, instructions_file: 'AGENTS.md', instructions_sha256: policyHash,
    cli_version: version.stdout.trim(), started_at: new Date(started).toISOString(),
    elapsed_ms: Date.now() - started, usage: parsed.usage,
  };
  appendReply(path, target === 'codex' ? 'Codex' : 'Claude', parsed.reply, null, audit);
  console.log(`답변 추가: ${path} (${audit.elapsed_ms}ms, 요청 ${settings.model}/${settings.effort}, 응답 ${parsed.response_models.join(', ') || '미확인'})`);
  if (modelMatch === false) {
    console.error('요청 모델과 응답 모델이 다릅니다. 기록을 검토하세요.');
    process.exitCode = 1;
  }
}
