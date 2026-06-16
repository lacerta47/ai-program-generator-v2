import { NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { todayKeyKST, lastDayKeysKST } from '@/lib/usageDay';
import { readDailyLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

const toMs = (s?: string): number | null => (s ? new Date(s).getTime() : null);

export async function GET(req: NextRequest) {
  // 1) admin 게이트 (공용 헬퍼)
  const gate = await requireAdmin(req);
  if (gate) return gate;

  // 2) 핵심: 가입자 명단 (실패 시 500 — 명단 없으면 표 자체가 불가)
  let users: UserRecord[];
  try {
    users = (await adminAuth.listUsers(1000)).users;
  } catch (e) {
    console.error('listUsers 실패:', e);
    return NextResponse.json({ error: '가입자 목록을 불러오지 못했어요.' }, { status: 500 });
  }

  // 3) 부가: 닉네임·사용량·작품 수 (병렬 + 개별 폴백)
  const days = lastDayKeysKST(7);
  const today = todayKeyKST();
  const [nickRes, usageRes, postRes, limitRes] = await Promise.allSettled([
    adminDb.collection('users').get(),
    adminDb.collection('usage').where('day', 'in', days).get(),
    adminDb.collection('posts').select('ownerUid').get(),
    adminDb.collection('limits').get(),
  ]);

  const nickById = new Map<string, string>();
  if (nickRes.status === 'fulfilled') {
    nickRes.value.forEach((d) => {
      const n = (d.data() as { nickname?: string }).nickname;
      if (n) nickById.set(d.id, n);
    });
  } else {
    console.error('users(nickname) 조회 실패:', nickRes.reason);
  }

  const usageByUid = new Map<string, Map<string, number>>();
  if (usageRes.status === 'fulfilled') {
    usageRes.value.forEach((d) => {
      const v = d.data() as { uid?: string; day?: string; count?: number };
      if (!v.uid || !v.day) return;
      if (!usageByUid.has(v.uid)) usageByUid.set(v.uid, new Map());
      usageByUid.get(v.uid)!.set(v.day, v.count ?? 0);
    });
  } else {
    console.error('usage 조회 실패:', usageRes.reason);
  }

  const postCountByUid = new Map<string, number>();
  if (postRes.status === 'fulfilled') {
    postRes.value.forEach((d) => {
      const owner = (d.data() as { ownerUid?: string }).ownerUid;
      if (owner) postCountByUid.set(owner, (postCountByUid.get(owner) ?? 0) + 1);
    });
  } else {
    console.error('posts 조회 실패:', postRes.reason);
  }

  const overrideByUid = new Map<string, number>();
  if (limitRes.status === 'fulfilled') {
    limitRes.value.forEach((d) => {
      const v = (d.data() as { dailyLimit?: number }).dailyLimit;
      if (typeof v === 'number' && v >= 0) overrideByUid.set(d.id, v);
    });
  } else {
    console.error('limits 조회 실패:', limitRes.reason);
  }

  // 4) 조립
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
      limitOverride: overrideByUid.get(u.uid) ?? null,
    };
  });

  const usageLimit = await readDailyLimit();
  return NextResponse.json({ members, usageLimit, days });
}
