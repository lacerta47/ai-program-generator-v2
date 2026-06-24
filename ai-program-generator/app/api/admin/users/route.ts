import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { todayKeyKST, lastDayKeysKST } from '@/lib/usageDay';
import { readDailyLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

const toMs = (s?: string): number | null => (s ? new Date(s).getTime() : null);

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  const PAGE = 50;
  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined;
  let page;
  try {
    page = await adminAuth.listUsers(PAGE, pageToken);
  } catch (e) {
    console.error('listUsers 실패:', e);
    return NextResponse.json({ error: '가입자 목록을 불러오지 못했어요.' }, { status: 500 });
  }
  const users = page.users;
  const uids = users.map((u) => u.uid);
  const days = lastDayKeysKST(7);
  const today = todayKeyKST();

  // 페이지 uid에 한정한 조인(전체 컬렉션 스캔 제거)
  const userDocs = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.doc(`users/${u}`))) : [];
  const limitDocs = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.doc(`limits/${u}`))) : [];
  const usageRefs = uids.flatMap((u) => days.map((d) => adminDb.doc(`usage/${u}_${d}`)));
  const usageDocs = usageRefs.length ? await adminDb.getAll(...usageRefs) : [];
  const postCounts = await Promise.all(
    uids.map(async (u) => {
      try {
        const c = await adminDb.collection('posts').where('ownerUid', '==', u).count().get();
        return c.data().count;
      } catch {
        return 0;
      }
    }),
  );

  const nickById = new Map<string, string>();
  userDocs.forEach((d) => {
    const n = (d.data() as { nickname?: string } | undefined)?.nickname;
    if (n) nickById.set(d.id, n);
  });
  const overrideById = new Map<string, number>();
  limitDocs.forEach((d) => {
    const v = (d.data() as { dailyLimit?: number } | undefined)?.dailyLimit;
    if (typeof v === 'number' && v >= 0) overrideById.set(d.id, v);
  });
  const usageByUid = new Map<string, Map<string, number>>();
  usageDocs.forEach((snap, i) => {
    const uid = uids[Math.floor(i / days.length)];
    const day = days[i % days.length];
    const count = snap.exists ? ((snap.data() as { count?: number }).count ?? 0) : 0;
    if (!usageByUid.has(uid)) usageByUid.set(uid, new Map());
    usageByUid.get(uid)!.set(day, count);
  });
  const postCountByUid = new Map<string, number>();
  uids.forEach((u, i) => postCountByUid.set(u, postCounts[i]));

  const members = users.map((u) => {
    const perDay = usageByUid.get(u.uid);
    return {
      uid: u.uid,
      email: u.email ?? null,
      nickname: nickById.get(u.uid) ?? null,
      createdAt: toMs(u.metadata.creationTime) ?? 0,
      lastSignInAt: toMs(u.metadata.lastSignInTime),
      isAdmin: u.customClaims?.admin === true,
      disabled: u.disabled === true,
      postCount: postCountByUid.get(u.uid) ?? 0,
      usageToday: perDay?.get(today) ?? 0,
      usage7d: days.map((d) => perDay?.get(d) ?? 0),
      limitOverride: overrideById.get(u.uid) ?? null,
    };
  });

  const usageLimit = await readDailyLimit();
  return NextResponse.json({ members, usageLimit, days, nextPageToken: page.pageToken ?? null });
}
