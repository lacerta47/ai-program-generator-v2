import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

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
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
