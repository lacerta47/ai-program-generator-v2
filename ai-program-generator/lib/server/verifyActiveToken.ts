import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/** Auth 폐기 검사와 Firestore의 즉시 차단 표식을 모두 확인한다. */
export async function verifyActiveToken(token: string) {
  const decoded = await adminAuth.verifyIdToken(token, true);
  const status = await adminDb.doc(`accountStatus/${decoded.uid}`).get();
  if (status.data()?.blocked === true) throw new Error('ACCOUNT_BLOCKED');
  return decoded;
}
