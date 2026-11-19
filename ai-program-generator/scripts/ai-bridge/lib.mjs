// AI 브리지 공용: 편지함 파일 파싱·답변 덧붙이기·CLI 호출. ask-codex.mjs / ask-claude.mjs가 쓴다.
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
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
  const turns = (body.match(/^## (?:답변|재질문)(?=\s|$)/gm) ?? []).length;
  return { path, meta, body, turns, text };
}

export function appendReply(path, who, reply, extra, audit) {
  const record = audit ? `\n### 호출 기록\n\n\`\`\`json\n${JSON.stringify(audit, null, 2)}\n\`\`\`\n` : '';
  const block = `\n\n## 답변 (${who}, ${kst()})\n${extra ? `<!-- ${extra} -->\n` : ''}\n${reply.trim()}\n${record}`;
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\s+$/, '') + block);
}

export function appendFailure(path, audit) {
  appendFileSync(path, `\n\n## 호출 실패 (${kst()})\n\n\`\`\`json\n${JSON.stringify(audit, null, 2)}\n\`\`\`\n`);
}

/** 상대 AI에게 넘길 전체 프롬프트. 규칙 + 편지 원문. 상대는 저장소를 읽을 수는 있지만 쓰지 못한다. */
export function buildPrompt(letter, me, policy) {
  const other = me === 'codex' ? 'Claude' : 'Codex';
  return `당신은 이 저장소(ai-program-generator)에서 ${other} Code와 협업하는 ${me === 'codex' ? 'Codex' : 'Claude'}입니다.
아래는 ${other}가 docs/ai-bridge/ 편지함으로 보낸 편지입니다. 규칙:
- 이 호출은 읽기 전용입니다. 파일을 만들거나 고치거나 커밋하지 마세요. 허용된 읽기 도구로 저장소를 확인하세요. Claude 호출에는 셸 도구가 없으므로 HEAD를 독립 확인할 수 없으면 미확인으로 적으세요. 호출 측이 Git으로 확인한 HEAD와 검토 SHA를 별도 기록합니다.
- 편지의 [요청] 항목에 번호별로 답하세요. 동의하지 않으면 이유와 대안을 함께 적으세요.
- 확인한 파일·커밋이 있으면 경로와 SHA를 적으세요. 추측과 확인 사실을 구분하세요.
- 답의 첫 줄은 정확히 "원문 id: ${letter.meta.id} · 확인 HEAD: <직접 확인한 전체 SHA 또는 미확인> · 검토 SHA: ${letter.meta.sha}" 로 쓰고, 끝에 '미확인 사항' 절을 둡니다. 현재 프로토콜은 호출 HEAD와 검토 기준 SHA가 같을 때만 시작하지만, 두 근거는 구분해 기록하세요.
- 모델 이름이나 추론 수준을 자기보고로 확정하지 마세요. 호출 측이 CLI의 응답 메타데이터를 별도로 기록합니다.
- 답은 마크다운, 한국어, 간결하게. 답변 본문만 출력하고 인사말은 생략하세요.
- 사용자 승인이 필요한 일(제품 유료 AI 생성 호출, 운영 데이터 변경, 배포, 정책 변경)은 하지 말고 "승인 필요"라고 표시만 하세요. 이번 읽기 전용 협업 검토 호출 자체는 사용자가 승인했습니다.

=== 양쪽에 동일하게 전달하는 공통 지침 (AGENTS.md) ===
${policy ?? '저장소의 AGENTS.md를 먼저 읽으세요.'}
=== 공통 지침 끝 ===

=== 편지 (${basename(letter.path)}) ===
${letter.text}
=== 편지 끝 ===`;
}

export function runCli(cmd, args, { input, timeoutMs }) {
  const r = spawnSync(cmd, args, { input, cwd: ROOT, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
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
