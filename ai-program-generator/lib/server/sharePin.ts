import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';

const PIN_RE = /^[0-9]{4,8}$/; // 4~8자리 숫자

export function isValidPinFormat(pin: string): boolean {
  return PIN_RE.test(pin);
}

/** 'saltHex:hashHex' 직렬화. 저엔트로피 PIN이라 실질 방어는 레이트리밋(다음 태스크). */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** postId+ip 별 슬라이딩 카운터. 한도 초과면 false(차단). Admin SDK 전용(shareAttempts는 클라 규칙 없음=기본 거부). */
export async function allowShareAttempt(postId: string, ip: string): Promise<boolean> {
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  const ref = adminDb.doc(`shareAttempts/${postId}_${ipHash}`);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.data();
    if (!d || now - (d.windowStart as number) > WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if ((d.count as number) >= MAX_ATTEMPTS) return false;
    tx.update(ref, { count: (d.count as number) + 1 });
    return true;
  });
}
