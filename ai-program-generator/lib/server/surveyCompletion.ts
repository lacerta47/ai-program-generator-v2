import 'server-only';
import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import {
  GENERATION_FEEDBACK_CODE_FIELDS, GENERATION_FEEDBACK_LINKS,
  type GenerationFeedbackMode, type GenerationFeedbackStatuses,
} from '@/lib/feedback/generation';

type Entry = { code?: string; codeCreatedAt?: number; completedAt?: number; offeredAt?: number };

function syncConfig() {
  const url = process.env.GOOGLE_SURVEY_SYNC_URL;
  const secret = process.env.GOOGLE_SURVEY_SYNC_SECRET;
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) || !secret || secret.length < 32) {
    throw new Error('설문 연결을 준비하고 있어요. 잠시 후 다시 눌러 주세요.');
  }
  return { url, secret };
}

async function completed(uid: string, mode: GenerationFeedbackMode, entry: Entry): Promise<boolean> {
  if (entry.completedAt) return true;
  if (!entry.code || !entry.codeCreatedAt) return false;
  const { url, secret } = syncConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, mode, code: entry.code, since: entry.codeCreatedAt }),
    signal: AbortSignal.timeout(12000),
    cache: 'no-store',
  });
  const result: unknown = await response.json();
  if (!response.ok || !result || typeof result !== 'object' || !('ok' in result) || result.ok !== true ||
      !('completed' in result) || typeof result.completed !== 'boolean') {
    throw new Error('설문 제출 여부를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.');
  }
  if (!result.completed) return false;
  if (!('submittedAt' in result) || typeof result.submittedAt !== 'number' || !Number.isSafeInteger(result.submittedAt) ||
      result.submittedAt < entry.codeCreatedAt - 60000 || result.submittedAt > Date.now() + 60000) {
    throw new Error('설문 제출 여부를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.');
  }
  const submittedAt = result.submittedAt;
  const ref = adminDb.doc(`generationFeedback/${uid}`);
  await adminDb.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).get(mode) as Entry | undefined;
    if (!current || current.code !== entry.code) throw new Error('설문 참여 정보를 다시 확인해 주세요.');
    if (!current.completedAt) {
      tx.set(ref, { [mode]: { ...current, completedAt: submittedAt } }, { merge: true });
    }
  });
  return true;
}

export async function getSurveyStatuses(uid: string): Promise<GenerationFeedbackStatuses> {
  syncConfig();
  const data = await adminDb.doc(`generationFeedback/${uid}`).get();
  const modes = ['create', 'easy'] as const;
  const results = await Promise.all(modes.map(async (mode) => completed(uid, mode, data.get(mode) ?? {})));
  return { create: results[0] ? 'completed' : 'available', easy: results[1] ? 'completed' : 'available' };
}

export async function openSurvey(uid: string, mode: GenerationFeedbackMode): Promise<string | null> {
  syncConfig();
  const ref = adminDb.doc(`generationFeedback/${uid}`);
  const entry = await adminDb.runTransaction(async (tx) => {
    const current = ((await tx.get(ref)).get(mode) ?? {}) as Entry;
    if (current.code || current.completedAt) return current;
    const next = { ...current, code: randomBytes(32).toString('hex'), codeCreatedAt: Date.now() };
    tx.set(ref, { [mode]: next }, { merge: true });
    return next;
  });
  if (await completed(uid, mode, entry)) return null;
  const url = new URL(GENERATION_FEEDBACK_LINKS[mode]);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(GENERATION_FEEDBACK_CODE_FIELDS[mode], entry.code!);
  return url.href;
}
