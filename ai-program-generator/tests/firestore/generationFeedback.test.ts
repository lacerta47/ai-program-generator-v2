import { NextRequest } from 'next/server';
import { deleteApp, getApp } from 'firebase-admin/app';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { adminDb } from '@/lib/firebase/admin';
import { POST } from '@/app/api/me/generation-feedback/route';

const UID = 'feedback-transaction-test';

vi.mock('@/lib/server/verifyActiveToken', () => ({
  verifyActiveToken: async () => ({ uid: 'feedback-transaction-test' }),
}));
vi.mock('@/lib/firebase/admin', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: 'demo-lun-rules' }, 'feedback-transactions');
  return { adminDb: getFirestore(app) };
});

beforeAll(async () => {
  await adminDb.doc(`generationFeedback/${UID}`).delete();
});

afterAll(async () => {
  await adminDb.doc(`generationFeedback/${UID}`).delete();
  await adminDb.terminate();
  await deleteApp(getApp('feedback-transactions'));
});

describe('generation feedback transactions', () => {
  it('offers each mode once across concurrent requests and retains both records', async () => {
    const modes = ['create', 'easy', 'create', 'easy', 'create', 'easy'];
    const responses = await Promise.all(modes.map((mode) => POST(new NextRequest(
      'https://example.test/api/me/generation-feedback',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer emulator-test' },
        body: JSON.stringify({ mode }),
      },
    ))));
    const results = await Promise.all(responses.map((response) => response.json()));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    for (const mode of ['create', 'easy']) {
      expect(results.filter((result, index) => modes[index] === mode && result.offer)).toHaveLength(1);
    }
    expect((await adminDb.doc(`generationFeedback/${UID}`).get()).data()).toEqual({
      create: { offeredAt: expect.any(Number) },
      easy: { offeredAt: expect.any(Number) },
    });
  }, 30000);
});
