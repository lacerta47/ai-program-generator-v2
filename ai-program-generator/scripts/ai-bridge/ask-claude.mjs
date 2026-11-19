// Codex → Claude. 편지(docs/ai-bridge/inbox/claude/*.md)를 claude -p(비대화)에 넘기고 답을 편지에 덧붙인다.
// 사용: node scripts/ai-bridge/ask-claude.mjs [편지경로]
// 쓰기 금지는 프롬프트 규칙 + 허용 도구를 읽기 계열로 제한해 지킨다.
import { ROOT, MAX_TURNS, readLetter, appendReply, buildPrompt, runCli, pickLetter } from './lib.mjs';

const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const path = pickLetter('claude', process.argv[2]);
const letter = readLetter(path);
if (letter.turns >= MAX_TURNS * 2 - 1) throw new Error(`왕복 상한(${MAX_TURNS})에 도달 — 사용자 개입이 필요합니다: ${path}`);

const t0 = Date.now();
const r = runCli(CLAUDE, ['-p', '--output-format', 'text', '--add-dir', ROOT,
  '--allowedTools', 'Read', 'Glob', 'Grep', 'Bash(git log:*)', 'Bash(git diff:*)', 'Bash(git show:*)', 'Bash(git status:*)'],
  { input: buildPrompt(letter, 'claude'), timeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 600_000) });
const reply = r.stdout;
if (!reply.trim()) {
  console.error(r.stderr.slice(-2000));
  throw new Error(r.timedOut ? 'claude 시간 초과' : `claude가 답을 쓰지 않음 (exit ${r.status})`);
}
appendReply(path, 'Claude', reply, `claude -p read-only · ${Math.round((Date.now() - t0) / 1000)}s`);
console.log(`답변 추가: ${path} (${Math.round((Date.now() - t0) / 1000)}s)`);
