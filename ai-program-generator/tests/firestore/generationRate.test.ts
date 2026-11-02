import { afterAll, afterEach, expect, test, vi } from 'vitest';
import { deleteApp, getApp } from 'firebase-admin/app';

vi.mock('@/lib/firebase/admin', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  return { adminDb: getFirestore(initializeApp({ projectId: 'demo-lun-rules' }, 'generation-rate-test')) };
});
import { adminDb } from '@/lib/firebase/admin';
import { allowGenerate, allowGenerateAdmission } from '@/lib/server/genRate';

const uid = 'generation-rate-fixture';
const admission = adminDb.doc(`genAdmission/${uid}`);
const starts = adminDb.doc(`genRate/${uid}`);
afterEach(async () => { await Promise.all([admission.delete(), starts.delete()]); });
afterAll(async () => { await adminDb.terminate(); await deleteApp(getApp('generation-rate-test')); });

test('대기 입장 카운터는 기존 생성 시작 한도를 소모하거나 충전하지 않는다', async () => {
  await starts.set({ windowStart: Date.now(), count: 30 });
  expect(await allowGenerateAdmission(uid)).toBe(true);
  expect((await admission.get()).data()?.count).toBe(1);
  expect((await starts.get()).data()?.count).toBe(30);
  expect(await allowGenerate(uid)).toBe(false);
}, 30_000);

test('병렬 입장 제한과 새 분으로 넘어간 후 복구를 실제 트랜잭션으로 검증한다', async () => {
  await admission.set({ windowStart: Date.now(), count: 29 });
  const allowed = await Promise.all(Array.from({ length: 4 }, () => allowGenerateAdmission(uid)));
  expect(allowed.filter(Boolean)).toHaveLength(1);
  expect((await admission.get()).data()?.count).toBe(30);
  expect((await starts.get()).exists).toBe(false);
  await admission.set({ windowStart: Date.now() - 60_001, count: 30 });
  expect(await allowGenerateAdmission(uid)).toBe(true);
  expect((await admission.get()).data()?.count).toBe(1);
}, 30_000);
