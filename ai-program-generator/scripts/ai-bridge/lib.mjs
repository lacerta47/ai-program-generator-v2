// AI 브리지 공용: 편지함 파일 파싱·답변 덧붙이기·CLI 호출. ask-codex.mjs / ask-claude.mjs가 쓴다.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INBOX = join(ROOT, 'docs', 'ai-bridge', 'inbox');
export const MAX_TURNS = 3; // 왕복 1회 = 제안(또는 재질문) 1건 + 답신 1건. 3회를 넘기면 남은 쟁점은 Issue로 올리고 사용자 판단만 요청.

export function kst() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().replace('T', ' ').slice(0, 16) + ' KST';
}

/** 편지 파일(docs/ai-bridge/inbox/<to>/<id>.md). frontmatter + 본문 + 답변 절들. */
export function readLetter(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`frontmatter가 없습니다: ${path}`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const body = m[2];
  const turns = (body.match(/^## (답변|재질문)\b/gm) ?? []).length;
  return { path, meta, body, turns, text };
}

export function appendReply(path, who, reply, extra) {
  const block = `\n\n## 답변 (${who}, ${kst()})\n${extra ? `<!-- ${extra} -->\n` : ''}\n${reply.trim()}\n`;
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\s+$/, '') + block);
}

/** 상대 AI에게 넘길 전체 프롬프트. 규칙 + 편지 원문. 상대는 저장소를 읽을 수는 있지만 쓰지 못한다. */
export function buildPrompt(letter, me) {
  const other = me === 'codex' ? 'Claude' : 'Codex';
  return `당신은 이 저장소(ai-program-generator)에서 ${other} Code와 협업하는 ${me === 'codex' ? 'Codex' : 'Claude'}입니다.
아래는 ${other}가 docs/ai-bridge/ 편지함으로 보낸 편지입니다. 규칙:
- 이 호출은 읽기 전용입니다. 파일을 만들거나 고치거나 커밋하지 마세요. 필요하면 저장소를 읽고 명령을 실행해 확인은 해도 됩니다.
- 편지의 [요청] 항목에 번호별로 답하세요. 동의하지 않으면 이유와 대안을 함께 적으세요.
- 확인한 파일·커밋이 있으면 경로와 SHA를 적으세요. 추측과 확인 사실을 구분하세요.
- 답의 첫 줄은 "원문 id: <편지 id> · 확인 HEAD: <git rev-parse HEAD 결과 또는 '미확인'>" 로 시작하고, 끝에 '미확인 사항' 절을 둡니다.
- 답은 마크다운, 한국어, 간결하게. 답변 본문만 출력하고 인사말은 생략하세요.
- 사용자 승인이 필요한 일(유료 AI 호출, 운영 데이터 변경, 배포, 정책 변경)은 하지 말고 "승인 필요"라고 표시만 하세요.

=== 편지 (${basename(letter.path)}) ===
${letter.text}
=== 편지 끝 ===`;
}

export function runCli(cmd, args, { input, timeoutMs }) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', timedOut: r.error?.code === 'ETIMEDOUT' };
}

/** 인수로 파일 경로를 받거나, 없으면 <to> 편지함에서 답변이 없는 가장 오래된 편지. */
export function pickLetter(to, argPath) {
  if (argPath) return argPath;
  const dir = join(INBOX, to);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f))
    .filter((p) => { const l = readLetter(p); return !/^## 답변/m.test(l.body.split(/^## 재질문/m).pop()); })
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  if (!files.length) throw new Error(`${to} 편지함에 답할 편지가 없습니다.`);
  return files[0];
}
