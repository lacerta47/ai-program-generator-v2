import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { deleteApp, getApp } from 'firebase-admin/app';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator required; live database forbidden');
  const { initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  return { adminDb: getFirestore(initializeApp({ projectId: 'demo-lun-rules' }, 'generation-flow-test')) };
});
vi.mock('@/lib/server/verifyActiveToken', () => ({ verifyActiveToken: async (uid: string) => ({ uid, student: true }) }));
vi.mock('@/lib/admin/exemplars', () => ({ getExemplar: async () => null, isProgramTypeId: () => false }));

import { adminDb } from '@/lib/firebase/admin';
import { POST } from '@/app/api/generate/route';
import { BizRouterProvider } from '@/lib/ai/bizrouter';
import { GeminiProvider } from '@/lib/ai/gemini';
import type { GenerationChunk, GenerateInput } from '@/lib/ai/types';
import { todayKeyKST } from '@/lib/usageDay';

let releaseModel!: () => void;
let modelGate: Promise<void>;
let failModel = false;
let seq = 0;
let teacher: string;
let students: string[];
let teachers: string[];
const calls = { bizrouter: 0, gemini: 0 };
const code = { html: '<main>fixture</main>', css: '', javascript: '' };
const slots = () => ['bizrouter', 'gemini'].flatMap(route => Array.from({ length: 16 }, (_, i) => adminDb.doc(`generationSlots/${route}-${i}`)));

function model(route: keyof typeof calls) {
  return async function* (_input: GenerateInput, signal?: AbortSignal): AsyncGenerator<GenerationChunk> {
    calls[route]++;
    signal?.throwIfAborted();
    yield { type: 'delta', partial: { html: '<main>' } };
    let onAbort!: () => void;
    try {
      await Promise.race([modelGate, new Promise<never>((_, reject) => {
        onAbort = () => reject(signal?.reason);
        signal?.addEventListener('abort', onAbort, { once: true });
        if (signal?.aborted) onAbort();
      })]);
      signal?.throwIfAborted();
      if (failModel) throw new Error('fixture upstream failure');
      yield { type: 'done', code };
    } finally { signal?.removeEventListener('abort', onAbort); }
  };
}

beforeEach(async () => {
  vi.stubEnv('AI_PROVIDER', 'bizrouter-first');
  vi.stubEnv('GEN_BIZROUTER_CONCURRENCY', '10');
  vi.stubEnv('GEN_GEMINI_CONCURRENCY', '4');
  vi.stubEnv('BIZROUTER_API_KEY', 'fixture-primary');
  vi.stubEnv('BIZROUTER_API_KEY_2', 'fixture-secondary');
  vi.stubEnv('GEMINI_API_KEY', 'fixture-direct');
  vi.stubEnv('BIZROUTER_MODEL', 'google/gemini-3.8-flash');
  vi.stubEnv('BIZROUTER_HIGH_MODEL', 'google/gemini-4-argon');
  // Any accidental real provider HTTP request fails instead of charging a live key.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Real model HTTP forbidden')));
  vi.spyOn(BizRouterProvider.prototype, 'generateStream').mockImplementation(model('bizrouter'));
  vi.spyOn(GeminiProvider.prototype, 'generateStream').mockImplementation(model('gemini'));
  modelGate = new Promise(resolve => { releaseModel = resolve; });
  failModel = false;
  calls.bizrouter = 0; calls.gemini = 0;
  teacher = `retry-flow-teacher-${++seq}`;
  teachers = [teacher];
  students = [];
  await Promise.all(slots().map(ref => ref.delete()));
  await adminDb.doc(`teachers/${teacher}`).set({ usedTotal: 0, totalQuota: 100 });
});

afterEach(async () => {
  releaseModel();
  await vi.waitFor(async () => {
    const remaining = await Promise.all(slots().map(ref => ref.get()));
    expect(remaining.filter(s => s.exists)).toHaveLength(0);
  }, { timeout: 15_000 });
  await Promise.all([
    ...teachers.map(uid => adminDb.doc(`teachers/${uid}`).delete()),
    ...students.flatMap(uid => ['students/' + uid, 'usage/' + uid + '_' + todayKeyKST(), 'genRate/' + uid, 'genAdmission/' + uid, 'photoConsents/' + uid].map(path => adminDb.doc(path).delete())),
  ]);
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
afterAll(async () => { await adminDb.terminate(); await deleteApp(getApp('generation-flow-test')); });

async function seed(count: number, separateTeachers = false) {
  students = Array.from({ length: count }, (_, i) => `${teacher}-student-${i}`);
  if (separateTeachers) {
    teachers.push(...students.map(uid => `${uid}-teacher`));
    await Promise.all(teachers.slice(1).map(uid => adminDb.doc(`teachers/${uid}`).set({ usedTotal: 0, totalQuota: 100 })));
  }
  await Promise.all(students.map((uid, i) => adminDb.doc(`students/${uid}`).set({ teacherUid: separateTeachers ? teachers[i + 1] : teacher, usedTotal: 0, limitType: i % 2 ? 'daily' : 'total', limitValue: 5 })));
}
function request(uid: string, signal?: AbortSignal) {
  return new NextRequest('http://localhost/api/generate', { method: 'POST', headers: { authorization: `Bearer ${uid}` }, body: JSON.stringify({ prompt: 'fixture', mode: 'generate' }), signal });
}
async function used(uid: string, index: number) {
  return index % 2 ? ((await adminDb.doc(`usage/${uid}_${todayKeyKST()}`).get()).data()?.count ?? 0)
    : ((await adminDb.doc(`students/${uid}`).get()).data()?.usedTotal ?? 0);
}

test.each([false, true])('학생 30명 동시 입장(교사 분리=%s): 실행 상한·미차감 대기·총 30회 생성', async (separateTeachers) => {
  await seed(30, separateTeachers);
  const responses = await Promise.all(students.map(uid => POST(request(uid))));
  try {
    const admitted = responses.filter(r => r.status === 200).length;
    expect(admitted).toBeGreaterThan(0);
    expect(admitted).toBeLessThanOrEqual(14);
    expect(responses.filter(r => r.status === 503)).toHaveLength(30 - admitted);
    expect(calls.bizrouter).toBeLessThanOrEqual(10);
    expect(calls.gemini).toBeLessThanOrEqual(4);
    expect(calls.bizrouter + calls.gemini).toBe(admitted);
    if (separateTeachers) {
      expect(admitted).toBe(14);
      expect(calls).toEqual({ bizrouter: 10, gemini: 4 });
    }
    const pools = await Promise.all(teachers.map(uid => adminDb.doc(`teachers/${uid}`).get()));
    expect(pools.reduce((sum, snap) => sum + (snap.data()?.usedTotal ?? 0), 0)).toBe(admitted);
    for (let i = 0; i < students.length; i++) {
      expect(await used(students[i], i)).toBe(responses[i].status === 200 ? 1 : 0);
      expect((await adminDb.doc(`genRate/${students[i]}`).get()).data()?.count ?? 0).toBe(responses[i].status === 200 ? 1 : 0);
    }
  } finally { releaseModel(); }
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].status === 200) expect(await responses[i].text()).toContain('"type":"done"');
    else {
      expect(await responses[i].json()).toMatchObject({ code: 'generation_busy', retryable: true });
      const retry = await POST(request(students[i]));
      expect(retry.status).toBe(200);
      expect(await retry.text()).toContain('"type":"done"');
    }
  }
  expect(calls.bizrouter + calls.gemini).toBe(30);
  const pools = await Promise.all(teachers.map(uid => adminDb.doc(`teachers/${uid}`).get()));
  expect(pools.reduce((sum, snap) => sum + (snap.data()?.usedTotal ?? 0), 0)).toBe(30);
  for (let i = 0; i < students.length; i++) {
    expect(await used(students[i], i)).toBe(1);
    expect((await adminDb.doc(`genRate/${students[i]}`).get()).data()?.count).toBe(1);
  }
}, 120_000);

test('교사 공유 한도 3회에 학생 8명이 동시에 요청해도 3회만 생성·차감한다', async () => {
  await seed(8);
  await adminDb.doc(`teachers/${teacher}`).update({ totalQuota: 3 });
  const responses = await Promise.all(students.map(uid => POST(request(uid))));
  releaseModel();
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].status === 503) {
      await responses[i].text();
      responses[i] = await POST(request(students[i]));
    }
  }
  expect(responses.filter(r => r.status === 200)).toHaveLength(3);
  expect(responses.filter(r => r.status === 429)).toHaveLength(5);
  await Promise.all(responses.map(r => r.text()));
  expect(calls.bizrouter + calls.gemini).toBe(3);
  expect((await adminDb.doc(`teachers/${teacher}`).get()).data()?.usedTotal).toBe(3);
}, 60_000);

test('공급사 실패는 학급·학생 한도를 환불하며 시작 횟수는 보존한다', async () => {
  await seed(2);
  failModel = true;
  const responses = await Promise.all(students.map(uid => POST(request(uid))));
  releaseModel();
  for (const r of responses) expect(await r.text()).toContain('"type":"error"');
  expect((await adminDb.doc(`teachers/${teacher}`).get()).data()?.usedTotal).toBe(0);
  for (let i = 0; i < students.length; i++) {
    expect(await used(students[i], i)).toBe(0);
    expect((await adminDb.doc(`genRate/${students[i]}`).get()).data()?.count).toBe(1);
  }
}, 30_000);

test('학생이 부분 출력 중 취소하면 정확히 환불하고 슬롯을 반환한다', async () => {
  await seed(1);
  const controller = new AbortController();
  const response = await POST(request(students[0], controller.signal));
  const reader = response.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('"type":"delta"');
  controller.abort();
  await reader.cancel();
  await vi.waitFor(async () => expect((await adminDb.doc(`teachers/${teacher}`).get()).data()?.usedTotal).toBe(0));
  expect(await used(students[0], 0)).toBe(0);
  expect((await adminDb.doc(`genRate/${students[0]}`).get()).data()?.count).toBe(1);
  expect(calls.bizrouter + calls.gemini).toBe(1);
}, 30_000);

test('같은 학생이 동시에 5번 요청해도 남은 총 한도 1회를 초과하지 않는다', async () => {
  await seed(1);
  await adminDb.doc(`students/${students[0]}`).update({ limitValue: 1 });
  const responses = await Promise.all(Array.from({ length: 5 }, () => POST(request(students[0]))));
  releaseModel();
  for (let i = 0; i < responses.length; i++) {
    if (responses[i].status === 503) {
      await responses[i].text();
      responses[i] = await POST(request(students[0]));
    }
  }
  expect(responses.filter(r => r.status === 200)).toHaveLength(1);
  expect(responses.filter(r => r.status === 429)).toHaveLength(4);
  await Promise.all(responses.map(r => r.text()));
  expect(await used(students[0], 0)).toBe(1);
  expect((await adminDb.doc(`teachers/${teacher}`).get()).data()?.usedTotal).toBe(1);
  expect((await adminDb.doc(`genRate/${students[0]}`).get()).data()?.count).toBe(1);
  expect(calls.bizrouter + calls.gemini).toBe(1);
}, 60_000);
