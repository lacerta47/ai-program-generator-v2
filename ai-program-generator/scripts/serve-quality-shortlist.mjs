import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] || '.quality-eval-exemplar-200-20260910');
const analysis = JSON.parse(readFileSync(resolve(dir, 'candidate-analysis.json'), 'utf8'));
const uploaded = JSON.parse(readFileSync(resolve(dir, 'uploaded-posts.json'), 'utf8'));
const uploadByResult = new Map(uploaded.map((item) => [item.resultId, item.postId]));
const typeOrder = ['paint', 'game', 'quiz', 'card', 'maze', 'roulette', 'calc', 'fortune', 'sound', 'aquarium', 'dressup', 'clock'];
const typeLabels = {
  paint: '그림판', game: '게임', quiz: '퀴즈', card: '카드', maze: '미로', roulette: '룰렛',
  calc: '계산기', fortune: '운세·뽑기', sound: '소리놀이', aquarium: '수족관', dressup: '꾸미기', clock: '시계',
};
const shortlist = typeOrder.flatMap((type) => analysis.candidates
  .filter((candidate) => candidate.type === type && candidate.selectionPass)
  .sort((a, b) => b.score - a.score || a.resultId.localeCompare(b.resultId))
  .slice(0, 3)
  .map((candidate, index) => ({
    resultId: candidate.resultId,
    postId: uploadByResult.get(candidate.resultId),
    type,
    typeLabel: typeLabels[type] || type,
    rank: index + 1,
    title: candidate.title,
    score: candidate.score,
    featureEvidenceRate: candidate.featureEvidenceRate,
    comparisonArm: candidate.comparisonArm,
    featureReviewCount: candidate.featureChecks.filter((check) => check.status === 'needs-review').length,
    negativeConflictCount: candidate.negativeConflicts.length,
  })));
const byId = new Map(shortlist.map((candidate) => [candidate.resultId, candidate]));

const previewServer = createServer((request, response) => {
  const match = new URL(request.url || '/', 'http://127.0.0.1').pathname.match(/^\/preview\/([a-zA-Z0-9_-]+)$/);
  const candidate = match ? byId.get(match[1]) : null;
  if (!candidate) { response.writeHead(404).end('not found'); return; }
  const row = JSON.parse(readFileSync(resolve(dir, `${candidate.resultId}.json`), 'utf8'));
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy', "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:");
  response.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${row.code.css}</style></head><body>${row.code.html}<script>${row.code.javascript}</script></body></html>`);
});

await new Promise((ready) => previewServer.listen(0, '127.0.0.1', ready));
const previewPort = previewServer.address().port;
const galleryPath = resolve(dir, 'shortlist-gallery.html');
const galleryServer = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/api/candidates') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ previewOrigin: `http://127.0.0.1:${previewPort}`, candidates: shortlist }));
    return;
  }
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(readFileSync(galleryPath, 'utf8'));
});
await new Promise((ready) => galleryServer.listen(0, '127.0.0.1', ready));
const galleryPort = galleryServer.address().port;
console.log(JSON.stringify({ url: `http://127.0.0.1:${galleryPort}`, previewPort, candidates: shortlist.length, galleryPath }));

const close = () => { galleryServer.close(); previewServer.close(); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
