import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/** Firestore 규칙도 즉시 볼 수 있도록 Auth보다 먼저 차단 상태를 기록한다. */
export async function setAccountDisabled(uid: string, disabled: boolean): Promise<void> {
  const ref = adminDb.doc(`accountStatus/${uid}`);
  if (disabled) {
    await ref.set({ blocked: true, blockedAt: Date.now() }, { merge: true });
    await adminAuth.updateUser(uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(uid);
  } else {
    await adminAuth.updateUser(uid, { disabled: false });
    const student = adminDb.doc(`students/${uid}`);
    if ((await student.get()).exists) await student.update({ disabledAt: FieldValue.delete() });
    await ref.set({ blocked: false }, { merge: true });
  }
}

/** 삭제 중 실패해도 기존 토큰의 Firestore 접근을 막는 표식을 남긴다. */
export async function blockAccountForDeletion(uid: string): Promise<void> {
  await adminDb.doc(`accountStatus/${uid}`).set({ blocked: true, blockedAt: Date.now() }, { merge: true });
  try {
    await adminAuth.updateUser(uid, { disabled: true });
    await adminAuth.revokeRefreshTokens(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
}
