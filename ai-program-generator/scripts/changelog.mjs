// docs/CHANGELOG.md 생성 — 머지된 PR을 gh CLI로 가져와 머지 날짜(KST) 순으로 정리한다.
// 사용: npm run changelog  (gh 로그인 필요, 저장소는 git remote 기준)
// 월별 "주요 흐름" 문구는 아래 FLOW에 손으로 적는다(없는 달은 빈칸).
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FLOW = {
  '2026-06': '재구축 초안 → 감사·보안 보강 → 역할 체계(교사·학생) → 배포 준비',
  '2026-07': '교육 기능(로직 카드·개념 배지·도감) → 코드 게이트 → 법적 문서 → 자동예시',
  '2026-08': '브랜드·SEO·공유 QR·학생 관리·운영 안정화',
  '2026-09': '법률 피드백 반영 → 게시판 개선 → 테스트 도입 → 품질 점검·게이트 확장 → 유형별 예시·제작 규칙',
};

const CATEGORY = { feat: '기능', fix: '수정', docs: '문서', chore: '운영', test: '테스트', refactor: '구조', perf: '성능', ci: 'CI', draft: '초안', security: '보안', privacy: '법률' };

const raw = execSync('gh pr list --state merged --limit 1000 --json number,title,mergedAt,body', { encoding: 'utf8' });
const prs = JSON.parse(raw).sort((a, b) => a.number - b.number);

const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const category = (t) => CATEGORY[t.match(/^(\w+)(\(|:)/)?.[1] ?? ''] ?? '기타';
/** 본문 → 한 줄 요약: 앞 3줄을 ' · '로 잇고 첫 문장까지, 최대 150자. */
function summary(body) {
  const lines = (body ?? '')
    .split('\n')
    .map((l) => l.replace(/^##\s*요약\s*$/, '').replace(/^-\s*/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l && !l.startsWith('🤖'))
    .slice(0, 3);
  let s = lines.join(' · ').replace(/\s+/g, ' ');
  const cut = s.indexOf('. ');
  if (cut > 40 && cut < 160) s = s.slice(0, cut + 1);
  return s.length > 150 ? s.slice(0, 147) + '…' : s;
}

const byMonth = {};
for (const p of prs) {
  const d = kst(p.mergedAt);
  ((byMonth[d.slice(0, 7)] ??= {})[d] ??= []).push(p);
}
const months = Object.keys(byMonth).sort();

let md = `# LUN 변경 이력 (PR 기준)\n\n> 저장소 머지된 PR ${prs.length}건을 머지 날짜(KST) 순으로 정리. \`npm run changelog\`로 생성(마지막 생성 ${kst(new Date().toISOString())}).\n\n`;
md += '## 요약\n\n| 월 | PR 수 | 주요 흐름 |\n|---|---|---|\n';
for (const m of months) md += `| ${m} | ${Object.values(byMonth[m]).flat().length} | ${FLOW[m] ?? ''} |\n`;
md += '\n';
for (const m of months) {
  md += `## ${m}\n\n`;
  for (const d of Object.keys(byMonth[m]).sort()) {
    md += `### ${d}\n`;
    for (const p of byMonth[m][d]) {
      const s = summary(p.body);
      md += `- **#${p.number}** [${category(p.title)}] ${p.title}${s ? `  \n  ${s}` : ''}\n`;
    }
    md += '\n';
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'CHANGELOG.md');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md);
console.log(`docs/CHANGELOG.md 갱신 — PR ${prs.length}건, ${months.map((m) => `${m}:${Object.values(byMonth[m]).flat().length}`).join(' ')}`);
