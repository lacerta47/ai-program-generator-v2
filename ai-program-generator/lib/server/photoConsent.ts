import 'server-only';
import { adminDb } from '@/lib/firebase/admin';

export const PHOTO_CONSENT_VERSION = '2026-10-28';

export async function hasPhotoConsent(uid: string): Promise<boolean> {
  const snap = await adminDb.doc(`photoConsents/${uid}`).get();
  return snap.data()?.policyVersion === PHOTO_CONSENT_VERSION && typeof snap.data()?.agreedAt === 'number';
}
