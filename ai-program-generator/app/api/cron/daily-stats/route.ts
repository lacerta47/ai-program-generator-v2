import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST, lastDayKeysKST } from '@/lib/usageDay';

// 운영 통계 — CRON_SECRET 보호(cleanup cron과 동일 패턴). Claude 루틴이 GET해서 리포트로 포맷.
// 기본(일일): ?period 없음 → 오늘/이달/누적. 주간: ?period=week → 최근 7일 vs 그 전 7일(W-o-W).
// 반환은 집계 카운트뿐(개인정보 없음). Vercel이 서비스계정 키 보유 → 여기서 Auth/Firestore 집계.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 모든 Auth 사용자의 creationTime(ms) 배열 — 소규모 가정(페이지네이션). */
async function allUserCreationMs(): Promise<number[]> {
  const out: number[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const u of page.users) out.push(Date.parse(u.metadata.creationTime));
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

/** usage/{uid}_{day}.count 합산(day 문자열 범위). 총형 학생은 usage 미기록이라 근사. */
async function sumUsage(fromKey: string, toKey: string): Promise<number> {
  const snap = await adminDb.collection('usage').where('day', '>=', fromKey).where('day', '<=', toKey).get();
  return snap.docs.reduce((s, d) => s + ((d.data().count as number) || 0), 0);
}

/** stats/{day}.visits 합산(문서ID=날짜키 범위). */
async function sumVisits(fromKey: string, toKey: string): Promise<number> {
  const snap = await adminDb.collection('stats').orderBy(FieldPath.documentId()).startAt(fromKey).endAt(toKey).get();
  return snap.docs.reduce((s, d) => s + ((d.data().visits as number) || 0), 0);
}

/** createdAt(ms) 범위 count(). toMs 생략 시 fromMs 이상 전체. */
async function countByCreatedAt(col: string, fromMs: number, toMs?: number): Promise<number> {
  let q = adminDb.collection(col).where('createdAt', '>=', fromMs);
  if (toMs !== undefined) q = q.where('createdAt', '<', toMs);
  return (await q.count().get()).data().count;
}

async function dailyStats() {
  const todayKey = todayKeyKST(); // 'YYYY-MM-DD' (KST)
  const monthStartKey = todayKey.slice(0, 7) + '-01';
  const todayStartMs = Date.parse(`${todayKey}T00:00:00+09:00`);
  const monthStartMs = Date.parse(`${monthStartKey}T00:00:00+09:00`);

  const creations = await allUserCreationMs();
  const total = creations.length;
  const signupToday = creations.filter((c) => c >= todayStartMs).length;
  const signupMonth = creations.filter((c) => c >= monthStartMs).length;

  return {
    date: todayKey,
    signups: { today: signupToday, month: signupMonth, total },
    generate: { today: await sumUsage(todayKey, todayKey), month: await sumUsage(monthStartKey, todayKey) },
    visitors: {
      today: ((await adminDb.doc(`stats/${todayKey}`).get()).data()?.visits as number) || 0,
      month: await sumVisits(monthStartKey, todayKey),
    },
    reports: {
      today: await countByCreatedAt('reports', todayStartMs),
      pending: (await adminDb.collection('reports').count().get()).data().count,
    },
    posts: {
      today: await countByCreatedAt('posts', todayStartMs),
      total: (await adminDb.collection('posts').count().get()).data().count,
    },
  };
}

async function weeklyStats() {
  const keys14 = lastDayKeysKST(14); // 오름차순, 가장 오래된 → 오늘
  const prev7 = keys14.slice(0, 7);
  const last7 = keys14.slice(7);
  const todayKey = last7[6];
  const todayStartMs = Date.parse(`${todayKey}T00:00:00+09:00`);
  const now = Date.now();
  const last7StartMs = todayStartMs - 6 * DAY_MS;
  const prev7StartMs = todayStartMs - 13 * DAY_MS;
  const prev7EndMs = last7StartMs;

  const creations = await allUserCreationMs();
  const inRange = (from: number, to: number) => creations.filter((c) => c >= from && c < to).length;

  const build = async (kFrom: string, kTo: string, mFrom: number, mTo: number) => ({
    signups: inRange(mFrom, mTo),
    generate: await sumUsage(kFrom, kTo),
    visitors: await sumVisits(kFrom, kTo),
    posts: await countByCreatedAt('posts', mFrom, mTo),
    reports: await countByCreatedAt('reports', mFrom, mTo),
  });

  return {
    period: 'week',
    range: { thisWeek: [last7[0], last7[6]], lastWeek: [prev7[0], prev7[6]] },
    thisWeek: await build(last7[0], last7[6], last7StartMs, now),
    lastWeek: await build(prev7[0], prev7[6], prev7StartMs, prev7EndMs),
    reportsPending: (await adminDb.collection('reports').count().get()).data().count,
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const period = req.nextUrl.searchParams.get('period');
    return NextResponse.json(period === 'week' ? await weeklyStats() : await dailyStats());
  } catch (e) {
    console.error('[/api/cron/daily-stats] 실패:', e);
    return NextResponse.json({ error: '통계를 집계하지 못했어요.' }, { status: 500 });
  }
}
