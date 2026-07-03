import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { allowFixedWindow } from '@/lib/server/rateLimit';
import { todayKeyKST } from '@/lib/usageDay';

export const runtime = 'nodejs';

// 방문 비콘 — 클라(VisitBeacon)가 하루 1회(localStorage dedup) 호출해 stats/{day}.visits를 원자 증가한다.
// 무인증(공개 집계 카운터만 건드림). IP별 하루 상한으로 인플레/스팸을 방어(클라 dedup은 우회 가능하므로).
// stats 컬렉션은 Admin SDK 전용(클라 규칙 없음 = 기본 거부).
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_IP = Number(process.env.BEACON_MAX_PER_IP) || 300; // 학교 NAT(한 IP 뒤 다수 학생) 고려해 넉넉히

export async function POST(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  const ip = (req.headers.get('x-real-ip') || (xff ? xff.split(',').pop() : '') || 'unknown').trim();
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  // 상한 초과면 조용히 무시(집계만 안 함 — 사용자 경험엔 영향 없음).
  if (await allowFixedWindow('beaconRate', ipHash, DAY_MS, MAX_PER_IP)) {
    const day = todayKeyKST();
    await adminDb.doc(`stats/${day}`).set({ visits: FieldValue.increment(1) }, { merge: true }).catch(() => {});
  }
  return new NextResponse(null, { status: 204 });
}
