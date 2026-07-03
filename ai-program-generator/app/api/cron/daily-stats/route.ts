import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';

// 일일 운영 통계 — CRON_SECRET 보호(cleanup cron과 동일 패턴). Claude 루틴이 매일 GET해서 리포트로 포맷.
// 반환은 집계 카운트뿐(개인정보 없음). Vercel이 서비스계정 키를 갖고 있어 여기서 Auth/Firestore 집계.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const todayKey = todayKeyKST(); // 'YYYY-MM-DD' (KST)
    const monthStartKey = todayKey.slice(0, 7) + '-01';
    const todayStartMs = Date.parse(`${todayKey}T00:00:00+09:00`);
    const monthStartMs = Date.parse(`${monthStartKey}T00:00:00+09:00`);

    // ① 가입자 — Auth listUsers 페이지네이션(소규모 가정). creationTime으로 오늘/이달 집계.
    let total = 0, signupToday = 0, signupMonth = 0;
    let pageToken: string | undefined;
    do {
      const page = await adminAuth.listUsers(1000, pageToken);
      for (const u of page.users) {
        total++;
        const c = Date.parse(u.metadata.creationTime);
        if (c >= todayStartMs) signupToday++;
        if (c >= monthStartMs) signupMonth++;
      }
      pageToken = page.pageToken;
    } while (pageToken);

    // ② 생성 호출 — usage/{uid}_{day}.count 합산(day 문자열 범위쿼리). (총형 학생은 usage 미기록이라 근사.)
    const sumUsage = async (fromKey: string, toKey: string) => {
      const snap = await adminDb.collection('usage').where('day', '>=', fromKey).where('day', '<=', toKey).get();
      return snap.docs.reduce((s, d) => s + ((d.data().count as number) || 0), 0);
    };
    const genToday = await sumUsage(todayKey, todayKey);
    const genMonth = await sumUsage(monthStartKey, todayKey);

    // ③ 방문자 — stats/{day}.visits(문서ID=날짜키 범위쿼리).
    const sumVisits = async (fromKey: string, toKey: string) => {
      const snap = await adminDb.collection('stats').orderBy(FieldPath.documentId()).startAt(fromKey).endAt(toKey).get();
      return snap.docs.reduce((s, d) => s + ((d.data().visits as number) || 0), 0);
    };
    const visitToday = ((await adminDb.doc(`stats/${todayKey}`).get()).data()?.visits as number) || 0;
    const visitMonth = await sumVisits(monthStartKey, todayKey);

    // ④ 신고 — 오늘 접수 + 전체 미처리(처리 시 삭제되므로 전체=대기). count() 집계(문서 read 없음).
    const reportsToday = (await adminDb.collection('reports').where('createdAt', '>=', todayStartMs).count().get()).data().count;
    const reportsPending = (await adminDb.collection('reports').count().get()).data().count;

    // ⑤ 게시 — 오늘 + 전체.
    const postsToday = (await adminDb.collection('posts').where('createdAt', '>=', todayStartMs).count().get()).data().count;
    const postsTotal = (await adminDb.collection('posts').count().get()).data().count;

    return NextResponse.json({
      date: todayKey,
      signups: { today: signupToday, month: signupMonth, total },
      generate: { today: genToday, month: genMonth },
      visitors: { today: visitToday, month: visitMonth },
      reports: { today: reportsToday, pending: reportsPending },
      posts: { today: postsToday, total: postsTotal },
    });
  } catch (e) {
    console.error('[/api/cron/daily-stats] 실패:', e);
    return NextResponse.json({ error: '통계를 집계하지 못했어요.' }, { status: 500 });
  }
}
