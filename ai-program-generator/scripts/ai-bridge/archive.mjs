// 결론 난 편지를 inbox/<to>/ → archive/<to>/ 로 옮기고, 저장소 안의 마크다운 링크를 새 경로로 고친다.
// 사용: node scripts/ai-bridge/archive.mjs docs/ai-bridge/inbox/claude/2026-11-19-foo.md [...더 많은 편지]
// 옮기기 전 조건: 답변이 1개 이상 있고, 남은 쟁점은 Issue로, 장기 결정은 docs/decisions/로 옮겨 둔 상태.
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative, dirname } from 'node:path';
import { ROOT, INBOX, readLetter } from './lib.mjs';

const ARCHIVE = join(ROOT, 'docs', 'ai-bridge', 'archive');
const files = process.argv.slice(2);
if (!files.length) throw new Error('옮길 편지 경로를 하나 이상 주세요.');

function* markdownFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* markdownFiles(p);
    else if (name.endsWith('.md')) yield p;
  }
}

for (const arg of files) {
  const from = resolve(arg);
  const rel = relative(INBOX, from).replaceAll('\\', '/');
  if (rel.startsWith('..') || !from.endsWith('.md')) throw new Error(`inbox 안의 편지만 보관할 수 있습니다: ${arg}`);
  const letter = readLetter(from);
  if (!letter.answered) throw new Error(`미답 질문이 남은 편지는 보관하지 않습니다: ${arg}`);
  const to = join(ARCHIVE, rel);
  if (existsSync(to)) throw new Error(`같은 이름의 보관 편지가 이미 있습니다: ${to}`);
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
  // 링크 갱신: "inbox/<to>/<file>" 조각을 "archive/<to>/<file>"로. 편지 파일명은 날짜가 붙어 유일하다.
  const oldFrag = `inbox/${rel}`, newFrag = `archive/${rel}`;
  let fixed = 0;
  for (const md of markdownFiles(join(ROOT, 'docs'))) {
    const text = readFileSync(md, 'utf8');
    if (!text.includes(oldFrag)) continue;
    writeFileSync(md, text.split(oldFrag).join(newFrag));
    fixed++;
  }
  console.log(`보관: ${rel} (링크 갱신 ${fixed}파일)`);
}
