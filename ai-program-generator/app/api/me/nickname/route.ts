import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { hasProfanity, isReservedNickname } from '@/lib/moderation';
import { verifyActiveToken } from '@/lib/server/verifyActiveToken';

export const runtime = 'nodejs';

const COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  let uid: string;
  try {
    uid = (await verifyActiveToken(token)).uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '별명을 확인해 주세요.' }, { status: 400 });
  }
  const name = typeof (body as { nickname?: unknown } | null)?.nickname === 'string'
    ? ((body as { nickname: string }).nickname).trim()
    : '';
  if (!name || name.length > 20 || name.includes('/')) {
    return NextResponse.json({ error: '별명은 1~20자로 적어 주세요.' }, { status: 400 });
  }
  if (await hasProfanity(name)) return NextResponse.json({ reason: 'profanity' }, { status: 400 });
  if (isReservedNickname(name)) return NextResponse.json({ reason: 'reserved' }, { status: 400 });

  const profileRef = adminDb.doc(`users/${uid}`);
  const nickRef = adminDb.doc(`nicknames/${name.toLowerCase()}`);
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const profile = await tx.get(profileRef);
      const nick = await tx.get(nickRef);
      const current = profile.data();
      if (current?.nickname === name) return { ok: true };
      const last = current?.nicknameUpdatedAt;
      const elapsed = typeof last?.toMillis === 'function' ? Date.now() - last.toMillis() : COOLDOWN_MS;
      if (current?.nickname && elapsed < COOLDOWN_MS) {
        return { reason: 'cooldown', daysLeft: Math.ceil((COOLDOWN_MS - elapsed) / DAY_MS) };
      }
      if (nick.exists && nick.data()?.uid !== uid) return { reason: 'taken' };
      if (!nick.exists) tx.set(nickRef, { uid });
      tx.set(profileRef, { nickname: name, nicknameUpdatedAt: new Date() }, { merge: true });
      return { ok: true };
    });
    if ('reason' in result) return NextResponse.json(result, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('별명 설정 실패:', error);
    return NextResponse.json({ error: '별명을 정하지 못했어요.' }, { status: 500 });
  }
}
