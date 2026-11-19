import { readFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, INBOX, MAX_TURNS, readLetter, appendReply, appendFailure, buildPrompt, runCli, pickLetter } from './lib.mjs';
import { settingsFor, validateLetter, validateReviewContext, commandArgs, parseResponse, replyIdentity, requireSuccess } from './protocol.mjs';

export function runBridge(target) {
  const path = resolve(pickLetter(target, process.argv[2]));
  const inboxRelative = relative(join(INBOX, target), path);
  if (inboxRelative.startsWith('..') || isAbsolute(inboxRelative) || !path.endsWith('.md')) {
    throw new Error('대상 편지함 안의 Markdown 파일만 호출할 수 있습니다.');
  }
  const letter = readLetter(path);
  const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true }).trim();
  const started = Date.now();
  const audit = {
    target, status: 'failed', phase: 'preflight', requested_model: null, requested_effort: null,
    response_models: [], response_model_source: 'not_received', model_match: null,
    response_effort: null, response_effort_source: 'not_exposed_by_cli',
    requested_review_sha: letter.meta.sha ?? null, review_sha: null, head_before: null, head_after: null,
    reported_head: null, reported_review_sha: null, worktree_dirty: null,
    instructions_file: 'AGENTS.md', instructions_sha256: null,
    context_mode: target === 'claude' ? 'safe-mode-no-mcp' : 'ignore-user-config',
    cli_version: null, started_at: new Date(started).toISOString(), elapsed_ms: 0, usage: {},
  };
  try {
    validateLetter(letter, target);
    if (letter.turns >= MAX_TURNS * 2 - 1) throw new Error(`왕복 상한(${MAX_TURNS})에 도달: ${path}`);
    const settings = settingsFor(JSON.parse(readFileSync(join(ROOT, 'scripts/ai-bridge/config.json'), 'utf8')), target);
    audit.requested_model = settings.model;
    audit.requested_effort = settings.effort;
    audit.review_sha = git('rev-parse', '--verify', `${letter.meta.sha}^{commit}`);
    audit.head_before = git('rev-parse', 'HEAD');
    const repoRelative = relative(git('rev-parse', '--show-toplevel'), path).replaceAll('\\', '/');
    const dirty = () => Boolean(git('status', '--porcelain', '--untracked-files=all', '--', ':/', `:(top,exclude,literal)${repoRelative}`));
    audit.worktree_dirty = dirty();
    validateReviewContext(audit.review_sha, audit.head_before, audit.worktree_dirty);
    const policyPath = join(ROOT, 'AGENTS.md');
    const policy = readFileSync(policyPath, 'utf8');
    const hash = (text) => createHash('sha256').update(text).digest('hex');
    audit.instructions_sha256 = hash(policy);
    const bin = process.env[target === 'codex' ? 'CODEX_BIN' : 'CLAUDE_BIN'] || target;
    const version = runCli(bin, ['--version'], { timeoutMs: 15_000 });
    requireSuccess(version);
    audit.cli_version = version.stdout.trim();
    audit.phase = 'invoke';
    const cliStarted = Date.now();
    const result = runCli(bin, commandArgs(target, settings, ROOT), {
      input: buildPrompt(letter, target, policy), timeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 600_000),
    });
    audit.cli_elapsed_ms = Date.now() - cliStarted;
    audit.exit_code = result.status;
    audit.timed_out = result.timedOut;
    if (!result.stdout.trim()) requireSuccess(result);
    audit.phase = 'decode';
    const parsed = parseResponse(target, result.stdout);
    audit.response_models = parsed.response_models;
    audit.response_model_source = parsed.response_model_source;
    audit.usage = parsed.usage;
    requireSuccess(result);
    audit.phase = 'verify';
    Object.assign(audit, replyIdentity(parsed.reply, letter, audit.head_before));
    audit.head_after = git('rev-parse', 'HEAD');
    if (audit.head_after !== audit.head_before || dirty()
      || hash(readFileSync(policyPath, 'utf8')) !== audit.instructions_sha256 || readLetter(path).text !== letter.text) {
      throw new Error('호출 중 HEAD·작업 트리·공통 지침·편지가 바뀌어 정상 답신을 저장하지 않았습니다.');
    }
    audit.model_match = parsed.response_models.length ? parsed.response_models.every((model) => model === settings.model) : null;
    audit.status = audit.model_match === false ? 'model_mismatch' : 'success';
    audit.phase = 'complete';
    audit.elapsed_ms = Date.now() - started;
    appendReply(path, target === 'codex' ? 'Codex' : 'Claude', parsed.reply, null, audit);
    console.log(`답변 추가: ${path} (${audit.elapsed_ms}ms, 요청 ${settings.model}/${settings.effort}, 응답 ${parsed.response_models.join(', ') || '미확인'})`);
    if (audit.model_match === false) {
      console.error('요청 모델과 응답 모델이 다릅니다. 날짜 접미사 등도 자동으로 같다고 간주하지 않으니 기록을 검토하세요.');
      process.exitCode = 1;
    }
  } catch (error) {
    if (error.evidence) Object.assign(audit, error.evidence);
    audit.status = 'failed';
    audit.error_type = error.name;
    audit.elapsed_ms = Date.now() - started;
    appendFailure(path, audit);
    throw error;
  }
}
