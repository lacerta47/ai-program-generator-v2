import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deleteApp, getApp } from 'firebase-admin/app';

// 실제 트랜잭션 경합은 emulator에서만 검증. 운영 자격증명 로더는 import하지 않는다.
vi.mock('@/lib/firebase/admin', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: 'demo-lun-rules' }, 'member-quota-test');
  return { adminDb: getFirestore(app) };
});

import { adminDb } from '@/lib/firebase/admin';
import { reserveMemberQuota, refundMemberQuota } from '@/lib/server/memberQuota';

const DAY = '2026-10-30';
const NEXT_DAY = '2026-10-31';
let sequence = 0;
let uid: string;
const total = () => adminDb.doc(`memberUsage/${uid}`);
const daily = (day = DAY) => adminDb.doc(`usage/${uid}_${day}`);
const count = async (ref: FirebaseFirestore.DocumentReference) => (await ref.get()).data()?.count;

beforeEach(() => { uid = `quota-test-${++sequence}`; });
afterEach(async () => { await Promise.all([total().delete(), daily().delete(), daily(NEXT_DAY).delete()]); });
afterAll(async () => { await adminDb.terminate(); await deleteApp(getApp('member-quota-test')); });

test('기존 회원의 과거 일일 사용량은 소급 차감하지 않는다', async () => {
  await daily().set({ uid, day: DAY, count: 100 });
  expect(await reserveMemberQuota(uid, 5, 1, DAY)).toBe(true);
  expect(await count(total())).toBe(1);
  expect(await count(daily())).toBe(101);
});

test('날짜가 바뀌어도 총 한도는 다시 충전되지 않는다', async () => {
  expect(await reserveMemberQuota(uid, 2, 1, DAY)).toBe(true);
  expect(await reserveMemberQuota(uid, 2, 1, NEXT_DAY)).toBe(true);
  expect(await reserveMemberQuota(uid, 2, 1, NEXT_DAY)).toBe(false);
  expect(await count(total())).toBe(2);
  expect(await count(daily(NEXT_DAY))).toBe(1);
});

test('동시 8개 요청도 총 3회 한도를 넘지 않는다', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, () => reserveMemberQuota(uid, 3, 1, DAY)));
  expect(results.filter(Boolean)).toHaveLength(3);
  expect(await count(total())).toBe(3);
  expect(await count(daily())).toBe(3);
}, 30000);

test('실패·취소 환불은 총량과 예약일 통계만 복구한다', async () => {
  await reserveMemberQuota(uid, 10, 2, DAY);
  await reserveMemberQuota(uid, 10, 1, NEXT_DAY);
  await refundMemberQuota(uid, 2, DAY);
  expect(await count(total())).toBe(1);
  expect(await count(daily())).toBe(0);
  expect(await count(daily(NEXT_DAY))).toBe(1);
});

test('한도 0은 첫 생성도 차단하고 카운터를 만들지 않는다', async () => {
  expect(await reserveMemberQuota(uid, 0, 1, DAY)).toBe(false);
  expect((await total().get()).exists).toBe(false);
  expect((await daily().get()).exists).toBe(false);
});

test('총 한도를 올려도 기존 사용량은 유지된다', async () => {
  await reserveMemberQuota(uid, 2, 2, DAY);
  expect(await reserveMemberQuota(uid, 2, 1, DAY)).toBe(false);
  expect(await reserveMemberQuota(uid, 3, 1, DAY)).toBe(true);
  expect(await count(total())).toBe(3);
});

test('삭제된 계정의 늦은 환불로 문서를 다시 만들지 않는다', async () => {
  await refundMemberQuota(uid, 1, DAY);
  expect((await total().get()).exists).toBe(false);
  expect((await daily().get()).exists).toBe(false);
});
