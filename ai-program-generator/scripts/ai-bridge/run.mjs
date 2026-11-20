import { readFileSync, mkdirSync, copyFileSync, mkdtempSync, rmSync, realpathSync, lstatSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { ROOT, INBOX, MAX_TURNS, readLetter, appendReply, appendFailure, buildPrompt, runCli, pickLetter } from './lib.mjs';
import { settingsFor, validateLetter, validateReviewContext, planExecution, commandArgs, parseResponse, replyIdentity, requireSuccess } from './protocol.mjs';

const gitIn = (cwd) => (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();

/**
 * 검토 SHA의 임시 worktree를 만들고 편지만 같은 상대 경로로 복사한다.
 * 호출된 AI는 이 트리를 읽으므로 "검토 SHA = 실제로 읽은 코드"가 보장되고, 호출 측의 미커밋 파일은 보이지 않는다.
 */
function createReviewWorktree(topLevel, reviewSha, letterPath) {
  // 홈 아래에 만든다(기본 ~/.ai-bridge/). Codex는 Temp 아래 경로를 작업 폴더로 받지 않고 C:\로 떨어진다(2026-11-20 실측).
  const base = process.env.BRIDGE_WORKTREE_DIR || join(homedir(), '.ai-bridge');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, 'review-'));
  const remove = () => {
    try { gitIn(topLevel)('worktree', 'remove', '--force', dir); }
    catch { try { rmSync(dir, { recursive: true, force: true }); gitIn(topLevel)('worktree', 'prune'); } catch { console.error(`임시 worktree를 지우지 못했습니다. 직접 삭제하세요: ${dir}`); } }
  };
  try {
    gitIn(topLevel)('worktree', 'add', '--detach', '--quiet', dir, reviewSha);
    const rel = relative(topLevel, letterPath);
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    copyFileSync(letterPath, join(dir, rel));
    if (readFileSync(join(dir, rel), 'utf8') !== readFileSync(letterPath, 'utf8')) throw new Error('편지 복사본이 원본과 다릅니다.');
    return { topLevel: dir, root: join(dir, relative(topLevel, ROOT)), letterPath: join(dir, rel), remove };
  } catch (error) {
    remove(); // 생성 도중 실패해도 잔존물을 남기지 않는다(Codex 리뷰 2026-11-20).
    throw error;
  }
}

/** 편지 경로: 편지함 안의 실제 파일이어야 한다. 심볼릭 링크와 realpath가 편지함 밖인 경우는 거부(Codex 리뷰 2026-11-20). */
function resolveLetterPath(target, argPath) {
  const path = resolve(pickLetter(target, argPath));
  const inboxDir = realpathSync(join(INBOX, target));
  if (lstatSync(path).isSymbolicLink()) throw new Error('편지는 심볼릭 링크일 수 없습니다.');
  const real = realpathSync(path);
  const inboxRelative = relative(inboxDir, real);
  if (inboxRelative.startsWith('..') || isAbsolute(inboxRelative) || !real.endsWith('.md') || inboxRelative.includes('/') || inboxRelative.includes('\\')) {
    throw new Error('대상 편지함 바로 아래의 Markdown 파일만 호출할 수 있습니다.');
  }
  return real;
}

export function runBridge(target) {
  const path = resolveLetterPath(target, process.argv[2]);
  const letter = readLetter(path);
  if (letter.turns >= MAX_TURNS * 2 - 1) throw new Error(`왕복 상한(${MAX_TURNS})에 도달했습니다. 남은 쟁점은 Issue에 기록하세요: ${path}`);
  if (letter.answered) throw new Error(`이미 답한 편지입니다. 재질문을 추가하거나 보관하세요: ${path}`);
  // Codex는 Temp 아래 경로를 작업 폴더로 받지 않는다(C:\로 떨어짐). 호출 폴더가 Temp 아래면 깨끗해도 홈 아래 임시 worktree를 쓴다.
  const rootUnderTemp = realpathSync(ROOT).toLowerCase().startsWith(realpathSync(tmpdir()).toLowerCase());
  const started = Date.now();
  const audit = {
    target, status: 'failed', phase: 'preflight', tier: null, requested_model: null, requested_effort: null,
    response_models: [], response_model_source: 'not_received', model_match: null,
    response_effort: null, response_effort_source: 'not_exposed_by_cli',
    requested_review_sha: letter.meta.sha ?? null, review_sha: null, caller_head: null, head_before: null, head_after: null,
    reported_head: null, reported_review_sha: null, caller_dirty: null, execution: null,
    instructions_file: 'AGENTS.md', instructions_sha256: null,
    context_mode: target === 'claude' ? 'safe-mode-no-mcp' : 'read-only-ephemeral-user-config',
    cli_version: null, started_at: new Date(started).toISOString(), elapsed_ms: 0, usage: {},
  };
  let review = null;
  try {
    validateLetter(letter, target);
    const settings = settingsFor(JSON.parse(readFileSync(join(ROOT, 'scripts/ai-bridge/config.json'), 'utf8')), target, letter.meta.tier ?? 'normal');
    audit.tier = settings.tier;
    audit.requested_model = settings.model;
    audit.requested_effort = settings.effort;

    // 1) 호출 측 저장소 상태. 검토 SHA가 HEAD와 다르거나 편지 외 변경이 있으면 임시 worktree로 간다.
    const callerGit = gitIn(ROOT);
    const callerTop = callerGit('rev-parse', '--show-toplevel');
    audit.review_sha = callerGit('rev-parse', '--verify', `${letter.meta.sha}^{commit}`);
    audit.caller_head = callerGit('rev-parse', 'HEAD');
    const letterRel = relative(callerTop, path).replaceAll('\\', '/');
    audit.caller_dirty = Boolean(callerGit('status', '--porcelain', '--untracked-files=all', '--', ':/', `:(top,exclude,literal)${letterRel}`));
    audit.execution = rootUnderTemp ? 'temp_worktree' : planExecution(audit.review_sha, audit.caller_head, audit.caller_dirty);
    if (audit.execution === 'temp_worktree') review = createReviewWorktree(callerTop, audit.review_sha, path);

    // 2) 실제로 읽힐 트리(현재 또는 임시 worktree)에서 다시 확인한다. 여기서는 항상 HEAD==검토 SHA, 깨끗해야 한다.
    const workRoot = review ? review.root : ROOT;
    const workTop = review ? review.topLevel : callerTop;
    const workLetter = review ? review.letterPath : path;
    const git = gitIn(workTop);
    audit.head_before = git('rev-parse', 'HEAD');
    const workLetterRel = relative(workTop, workLetter).replaceAll('\\', '/');
    const dirty = () => Boolean(git('status', '--porcelain', '--untracked-files=all', '--', ':/', `:(top,exclude,literal)${workLetterRel}`));
    validateReviewContext(audit.review_sha, audit.head_before, dirty());

    const policyPath = join(workRoot, 'AGENTS.md');
    const policy = readFileSync(policyPath, 'utf8');
    const hash = (text) => createHash('sha256').update(text).digest('hex');
    audit.instructions_sha256 = hash(policy);
    const bin = process.env[target === 'codex' ? 'CODEX_BIN' : 'CLAUDE_BIN'] || target;
    const version = runCli(bin, ['--version'], { timeoutMs: 15_000 });
    requireSuccess(version);
    audit.cli_version = version.stdout.trim();
    audit.phase = 'invoke';
    const cliStarted = Date.now();
    const result = runCli(bin, commandArgs(target, settings, workRoot), {
      input: buildPrompt({ ...letter, path: workLetter }, target, policy), cwd: workRoot,
      timeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 600_000),
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
    console.log(`답변 추가: ${path} (${audit.elapsed_ms}ms, ${audit.execution}, 요청 ${settings.model}/${settings.effort}[${settings.tier}], 응답 ${parsed.response_models.join(', ') || '미확인'})`);
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
  } finally {
    review?.remove();
  }
}
