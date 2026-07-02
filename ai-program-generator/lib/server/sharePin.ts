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
  const allowed = await adminDb.runTransaction(async (tx) => {
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
  // 기회적 청소: 만료된 카운터 몇 개 정리(putPreview와 동일 패턴, 비용 미미).
  // shareAttempts는 TTL이 없어 postId/ip를 돌려가며 시도하면 정크 문서가 무한 누적되므로 상시 청소한다. (B3)
  adminDb
    .collection('shareAttempts')
    .where('windowStart', '<', Date.now() - WINDOW_MS)
    .limit(20)
    .get()
    .then((snap) => Promise.all(snap.docs.map((doc) => doc.ref.delete())))
    .catch(() => {});
  return allowed;
}

/**
 * 만료된 shareAttempts(윈도가 지난 카운터)를 일괄 삭제(스케줄 cron용). 한 번에 최대 maxDocs건.
 * 윈도가 끝나면 다음 시도가 어차피 카운터를 리셋하므로 만료분 삭제는 안전(레이트리밋에 무영향).
 * windowStart 단일필드 범위쿼리라 자동 인덱스 사용(복합 인덱스 불필요).
 */
export async function deleteExpiredShareAttempts(maxDocs = 5000): Promise<number> {
  const cutoff = Date.now() - WINDOW_MS;
  let deleted = 0;
  while (deleted < maxDocs) {
    const snap = await adminDb
      .collection('shareAttempts')
      .where('windowStart', '<', cutoff)
      .limit(450)
      .get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 450) break; // 마지막 배치
  }
  return deleted;
}
