import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const dir = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(resolve(dir, 'manifest.json'), 'utf8'));
const exemplars = existsSync(resolve(dir, 'exemplars.json'))
  ? JSON.parse(readFileSync(resolve(dir, 'exemplars.json'), 'utf8'))
  : {};
const plans = new Map(manifest.plans.map((plan) => [plan.id, plan]));
const resultFiles = readdirSync(dir).filter((file) => /-(before|after)\.json$/.test(file));

const STOP_WORDS = new Set([
  '만들어', '넣어', '보여줘', '하게', '있게', '화면', '버튼', '기능', '효과', '프로그램',
  '사용', '추가', '정해줘', '그대로', '여러', '같은', '따로', '아니', '괜찮아', '없어도',
]);
const normalized = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ');
function terms(requirement) {
  return [...new Set((requirement.label + ' ' + requirement.promptFragment)
    .match(/[가-힣a-zA-Z0-9]{2,}/g)?.map((word) => word.toLowerCase())
    .filter((word) => !STOP_WORDS.has(word) && !/^(?:으로|에서|마다|처럼|하고|해요|해줘|한다)$/.test(word)) || [])]
    .slice(0, 12);
}
function shingles(value, size = 64) {
  const compact = String(value || '').toLowerCase().replace(/[^가-힣a-z0-9]/g, '');
  const out = new Set();
  for (let i = 0; i + size <= compact.length; i += 16) out.add(compact.slice(i, i + size));
  return out;
}
function containment(output, reference) {
  const a = shingles(output), b = shingles(reference);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const value of b) if (a.has(value)) common++;
  return common / b.size;
}

const candidates = [];
for (const file of resultFiles) {
  const row = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
  const plan = plans.get(row.id);
  const extendedPath = resolve(dir, `${row.id}-${row.version}.actions.json`);
  const extended = existsSync(extendedPath) ? JSON.parse(readFileSync(extendedPath, 'utf8')) : null;
  const gateReason = row.gates?.[row.version] || null;
  const technicalPass = Boolean(row.code && row.runtime && extended)
    && !row.generationError && !gateReason
    && !row.runtime.errors?.length && !row.runtime.timeout
    && !extended.errors?.length && !extended.incomplete;
  const searchable = normalized([
    row.code?.html, row.code?.css, row.code?.javascript, row.runtime?.text,
  ].filter(Boolean).join('\n'));
  const featureChecks = (plan?.requirements || []).map((requirement) => {
    const signals = terms(requirement);
    const hits = signals.filter((term) => searchable.includes(term));
    return {
      stepId: requirement.stepId,
      optionId: requirement.optionId,
      label: requirement.label,
      negative: requirement.negative,
      signals,
      hits,
      status: requirement.negative
        ? (hits.length ? 'possible-conflict' : 'no-conflict-observed')
        : (hits.length ? 'evidence-observed' : 'needs-review'),
    };
  });
  const positive = featureChecks.filter((check) => !check.negative);
  const featureEvidenceRate = positive.length
    ? positive.filter((check) => check.hits.length).length / positive.length
    : 1;
  const negativeConflicts = featureChecks.filter((check) => check.status === 'possible-conflict');
  const exemplar = exemplars[row.type];
  const outputCode = row.code ? `${row.code.html}\n${row.code.css}\n${row.code.javascript}` : '';
  const exemplarCode = exemplar?.codeReference === 'full'
    ? `${exemplar.code.html}\n${exemplar.code.css}\n${exemplar.code.javascript}`
    : '';
  const codeContainment = exemplarCode ? containment(outputCode, exemplarCode) : null;
  const copiedCodeRisk = codeContainment !== null && codeContainment >= 0.35;
  const sourceTitle = exemplar?.sourceTitle || '';
  const sourceTitleLeak = sourceTitle.length >= 5 && sourceTitle !== row.title && searchable.includes(sourceTitle.toLowerCase());
  const overcopy = {
    applicable: Boolean(exemplar),
    codeReference: exemplar?.codeReference || null,
    codeContainment,
    sourceTitleLeak,
    risk: copiedCodeRisk || sourceTitleLeak ? 'high' : 'clear',
  };
  const selectionPass = technicalPass && overcopy.risk !== 'high';
  const score = Math.round((technicalPass ? 70 : 0) + featureEvidenceRate * 20 + (overcopy.risk === 'clear' ? 10 : 0));
  candidates.push({
    resultId: `${row.id}-${row.version}`,
    id: row.id,
    version: row.version,
    comparisonArm: row.comparisonArm,
    type: row.type,
    title: row.title,
    exemplarApplied: row.exemplarApplied,
    exemplarSourcePostId: row.exemplarSourcePostId,
    generationError: row.generationError,
    gateReason,
    technicalPass,
    selectionPass,
    score,
    featureEvidenceRate,
    featureChecks,
    negativeConflicts,
    overcopy,
    resultFile: file,
  });
}

candidates.sort((a, b) => Number(b.selectionPass) - Number(a.selectionPass) || b.score - a.score || a.resultId.localeCompare(b.resultId));
const summary = {
  runId: basename(dir),
  total: candidates.length,
  technicalPassed: candidates.filter((candidate) => candidate.technicalPass).length,
  selectionPassed: candidates.filter((candidate) => candidate.selectionPass).length,
  needsFeatureReview: candidates.filter((candidate) => candidate.featureChecks.some((check) => check.status === 'needs-review')).length,
  negativeConflictFlags: candidates.filter((candidate) => candidate.negativeConflicts.length).length,
  overcopyHighRisk: candidates.filter((candidate) => candidate.overcopy.risk === 'high').length,
};
writeFileSync(resolve(dir, 'candidate-analysis.json'), JSON.stringify({ summary, candidates }, null, 2));
writeFileSync(resolve(dir, 'upload-candidates.json'), JSON.stringify(candidates.filter((candidate) => candidate.selectionPass), null, 2));
console.log(JSON.stringify(summary, null, 2));
