// Claude → Codex. 편지(docs/ai-bridge/inbox/codex/*.md)를 codex exec(읽기 전용·세션 비저장)에 넘기고 답을 편지에 덧붙인다.
// 사용: node scripts/ai-bridge/ask-codex.mjs [편지경로]   (경로 생략 시 미답 편지 중 가장 오래된 것)
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ROOT, MAX_TURNS, readLetter, appendReply, buildPrompt, runCli, pickLetter } from './lib.mjs';

const CODEX = process.env.CODEX_BIN
  || 'C:/Users/amh47/AppData/Local/OpenAI/Codex/bin/9e1da79431da526b/codex.exe';
if (!existsSync(CODEX)) throw new Error(`codex 실행 파일 없음: ${CODEX} (CODEX_BIN 으로 지정)`);

const path = pickLetter('codex', process.argv[2]);
const letter = readLetter(path);
if (letter.turns >= MAX_TURNS * 2 - 1) throw new Error(`왕복 상한(${MAX_TURNS})에 도달 — 사용자 개입이 필요합니다: ${path}`);

const outFile = join(tmpdir(), `codex-reply-${Date.now()}.md`);
const t0 = Date.now();
const r = runCli(CODEX, ['exec', '-s', 'read-only', '--ephemeral', '-C', ROOT, '-o', outFile, '-'],
  { input: buildPrompt(letter, 'codex'), timeoutMs: Number(process.env.BRIDGE_TIMEOUT_MS ?? 600_000) });
const reply = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
if (existsSync(outFile)) unlinkSync(outFile);
if (!reply.trim()) {
  console.error(r.stderr.slice(-2000));
  throw new Error(r.timedOut ? 'codex 시간 초과' : `codex가 답을 쓰지 않음 (exit ${r.status})`);
}
const tokens = r.stderr.match(/tokens used\s*\n?\s*([\d,]+)/)?.[1] ?? r.stdout.match(/tokens used\s*\n?\s*([\d,]+)/)?.[1] ?? '?';
appendReply(path, 'Codex', reply, `codex exec read-only · ${Math.round((Date.now() - t0) / 1000)}s · tokens ${tokens}`);
console.log(`답변 추가: ${path} (${Math.round((Date.now() - t0) / 1000)}s, tokens ${tokens})`);
