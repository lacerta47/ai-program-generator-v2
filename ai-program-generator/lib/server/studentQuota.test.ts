import { describe, it, expect, beforeEach, vi } from 'vitest';

// 인메모리 Firestore 흉내 — reserve/refund가 쓰는 API(doc/collection.doc/runTransaction/tx.get/set/update)만 구현.
// 트랜잭션 의미(동시성)는 검증하지 않고, 읽기→검사→쓰기 산술과 대칭성만 본다.
const store = new Map<string, Record<string, unknown>>();

function ref(path: string) {
  return { path };
}
const fakeDb = {
  doc: (path: string) => ref(path),
  collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
  runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
    const tx = {
      get: async (r: { path: string }) => {
        const data = store.get(r.path);
        return { exists: !!data, data: () => data };
      },
      set: (r: { path: string }, v: Record<string, unknown>, opt?: { merge?: boolean }) => {
        store.set(r.path, opt?.merge ? { ...(store.get(r.path) ?? {}), ...v } : { ...v });
      },
      update: (r: { path: string }, v: Record<string, unknown>) => {
        if (!store.has(r.path)) throw new Error('update on missing doc');
        store.set(r.path, { ...store.get(r.path)!, ...v });
      },
    };
    return fn(tx);
  },
};

vi.mock('@/lib/firebase/admin', () => ({ adminDb: fakeDb }));

const { reserveStudentQuota, refundStudentQuota } = await import('./studentQuota');

const DAY = '2026-09-03';
const usageKey = `usage/s1_${DAY}`;

function seed(opts: {
  totalQuota?: number;
  usedTotal?: number;
  limitType?: 'daily' | 'total';
  limitValue?: number;
  studentUsed?: number;
  dayCount?: number;
}) {
  store.clear();
  store.set('teachers/t1', { totalQuota: opts.totalQuota ?? 10, usedTotal: opts.usedTotal ?? 0 });
  store.set('students/s1', {
    teacherUid: 't1',
    limitType: opts.limitType ?? 'daily',
    limitValue: opts.limitValue ?? 3,
    usedTotal: opts.studentUsed ?? 0,
  });
  if (opts.dayCount !== undefined) store.set(usageKey, { count: opts.dayCount });
}

describe('reserveStudentQuota — 공유 풀 + 학생 캡', () => {
  beforeEach(() => store.clear());

  it('학생 문서가 없으면 misconfig', async () => {
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: false, reason: 'misconfig' });
  });

  it('1일형: 풀·일일 카운터를 함께 차감하고 student.usedTotal은 건드리지 않는다', async () => {
    seed({ limitType: 'daily', limitValue: 3 });
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: true });
    expect(store.get('teachers/t1')!.usedTotal).toBe(1);
    expect(store.get(usageKey)!.count).toBe(1);
    expect(store.get('students/s1')!.usedTotal).toBe(0);
  });

  it('1일형 캡 초과는 cap-daily, 풀은 차감되지 않는다', async () => {
    seed({ limitType: 'daily', limitValue: 3, dayCount: 3 });
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: false, reason: 'cap-daily' });
    expect(store.get('teachers/t1')!.usedTotal).toBe(0);
  });

  it('총형: 풀·student.usedTotal을 차감하고 usage는 만들지 않는다', async () => {
    seed({ limitType: 'total', limitValue: 5, studentUsed: 4 });
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: true });
    expect(store.get('students/s1')!.usedTotal).toBe(5);
    expect(store.has(usageKey)).toBe(false);
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: false, reason: 'cap-total' });
  });

  it('교사 풀 소진은 학생 캡보다 먼저 검사한다', async () => {
    seed({ totalQuota: 10, usedTotal: 10, limitType: 'daily', limitValue: 3 });
    expect(await reserveStudentQuota('s1', 1, DAY)).toEqual({ ok: false, reason: 'pool' });
  });
});

describe('refundStudentQuota — 예약과 대칭, 0 미만 방지', () => {
  it('1일형 환불은 풀·일일 카운터만 되돌린다', async () => {
    seed({ limitType: 'daily', limitValue: 3 });
    await reserveStudentQuota('s1', 1, DAY);
    await refundStudentQuota('s1', 1, DAY);
    expect(store.get('teachers/t1')!.usedTotal).toBe(0);
    expect(store.get(usageKey)!.count).toBe(0);
  });

  it('총형 환불은 student.usedTotal도 되돌린다', async () => {
    seed({ limitType: 'total', limitValue: 5, studentUsed: 2 });
    await reserveStudentQuota('s1', 1, DAY);
    await refundStudentQuota('s1', 1, DAY);
    expect(store.get('students/s1')!.usedTotal).toBe(2);
    expect(store.get('teachers/t1')!.usedTotal).toBe(0);
  });

  it('예약 없이 환불해도 0 아래로 내려가지 않는다', async () => {
    seed({ limitType: 'daily', limitValue: 3, dayCount: 0 });
    await refundStudentQuota('s1', 1, DAY);
    expect(store.get('teachers/t1')!.usedTotal).toBe(0);
    expect(store.get(usageKey)!.count).toBe(0);
  });

  it('호출부가 넘긴 day의 usage 문서만 건드린다(자정 경계 보호)', async () => {
    seed({ limitType: 'daily', limitValue: 3 });
    await reserveStudentQuota('s1', 1, DAY);
    await refundStudentQuota('s1', 1, '2026-09-04');
    expect(store.get(usageKey)!.count).toBe(1); // 다른 날짜로 환불 → 원래 날은 그대로
    expect(store.get('teachers/t1')!.usedTotal).toBe(0); // 풀은 day 무관
  });
});
