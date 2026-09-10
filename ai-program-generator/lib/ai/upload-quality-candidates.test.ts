import { it, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';

vi.mock('server-only', () => ({}));

it.skipIf(process.env.LUN_QUALITY_UPLOAD !== '1')('uploads passing quality candidates idempotently', async () => {
  const out = resolve(process.env.LUN_QUALITY_OUT!);
  const originalNodeEnv = process.env.NODE_ENV;
  Object.assign(process.env, { NODE_ENV: 'development' });
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} }, true);
  Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  const candidates = JSON.parse(readFileSync(resolve(out, 'upload-candidates.json'), 'utf8')) as Array<{
    resultId: string;
    resultFile: string;
    type: string;
    score: number;
    featureEvidenceRate: number;
    comparisonArm?: string;
    exemplarApplied?: boolean;
    exemplarSourcePostId?: string | null;
    featureChecks: unknown[];
    overcopy: unknown;
  }>;
  const manifest = JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8')) as { plans: Array<{ id: string; plan: unknown; prompt: string }> };
  const plans = new Map(manifest.plans.map((plan) => [plan.id, plan]));
  const { adminDb } = await import('../firebase/admin');
  const configuredCategoryId = process.env.EXAMPLE_CATEGORY_ID;
  const categoryId = configuredCategoryId || (await adminDb.collection('categories').where('name', '==', '교육테스트').limit(1).get()).docs[0]?.id;
  if (!categoryId) throw new Error("'교육테스트' 카테고리를 찾을 수 없습니다.");
  const runId = basename(out).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const uploadedPath = resolve(out, 'uploaded-posts.json');
  const uploaded = existsSync(uploadedPath)
    ? JSON.parse(readFileSync(uploadedPath, 'utf8')) as Array<{ resultId: string; postId: string; status: string }>
    : [];
  const done = new Set(uploaded.map((item) => item.resultId));
  for (const candidate of candidates) {
    if (done.has(candidate.resultId)) continue;
    const row = JSON.parse(readFileSync(resolve(out, candidate.resultFile), 'utf8')) as {
      id: string;
      title: string;
      prompt: string;
      code: unknown;
      meta?: { logicSummary?: string; conceptTags?: string[]; conceptNotes?: Record<string, string> };
    };
    const plan = plans.get(row.id);
    if (!row.code || !plan?.plan) throw new Error(`업로드 데이터 누락: ${candidate.resultId}`);
    const postId = `quality_${runId}_${candidate.resultId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 240);
    const ref = adminDb.collection('posts').doc(postId);
    if ((await ref.get()).exists) {
      uploaded.push({ resultId: candidate.resultId, postId, status: 'already-exists' });
    } else {
      const doc: Record<string, unknown> = {
        title: row.title,
        categoryId,
        ownerUid: 'quality-example-candidate',
        authorName: `예제 후보 · ${candidate.type} · ${candidate.score}점`,
        code: row.code,
        plan: plan.plan,
        prompt: plan.prompt,
        createdAt: Date.now(),
        boardTeacherUid: null,
        likeCount: 0,
        viewCount: 0,
        forkCount: 0,
        qualityCandidate: true,
        qualityRunId: runId,
        qualityResultId: candidate.resultId,
        qualityProgramType: candidate.type,
        qualityScore: candidate.score,
        qualityFeatureEvidenceRate: candidate.featureEvidenceRate,
        qualityComparisonArm: candidate.comparisonArm || null,
        qualityExemplarApplied: Boolean(candidate.exemplarApplied),
        qualityExemplarSourcePostId: candidate.exemplarSourcePostId || null,
        qualityFeatureChecks: candidate.featureChecks,
        qualityOvercopy: candidate.overcopy,
      };
      if (row.meta?.logicSummary) doc.logicSummary = row.meta.logicSummary;
      if (row.meta?.conceptTags?.length) doc.conceptTags = row.meta.conceptTags;
      if (row.meta?.conceptNotes && Object.keys(row.meta.conceptNotes).length) doc.conceptNotes = row.meta.conceptNotes;
      await ref.create(doc);
      uploaded.push({ resultId: candidate.resultId, postId, status: 'created' });
    }
    done.add(candidate.resultId);
    writeFileSync(uploadedPath, JSON.stringify(uploaded, null, 2));
  }
  const expectedPostIds = candidates.map((candidate) =>
    `quality_${runId}_${candidate.resultId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 240));
  const snapshots = await adminDb.getAll(...expectedPostIds.map((postId) => adminDb.collection('posts').doc(postId)));
  const persisted = snapshots.filter((snapshot) => snapshot.exists).length;
  if (persisted !== candidates.length) throw new Error(`업로드 검증 실패: ${persisted}/${candidates.length}`);
  console.log(JSON.stringify({ categoryId, requested: candidates.length, recorded: uploaded.length, persisted }));
}, 600_000);
