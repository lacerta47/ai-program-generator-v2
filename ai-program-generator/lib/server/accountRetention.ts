import 'server-only';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

const PURGE_AFTER_MS = 330 * 24 * 60 * 60 * 1000; // 일일 배치 처리 여유를 둬 1년 이내 파기
const TOMBSTONE_MS = 24 * 60 * 60 * 1000;

/** 교사 삭제로 정지된 학생을 보존 기한이 지난 뒤 소량씩 파기한다. */
export async function deleteExpiredStudentAccounts(now = Date.now()): Promise<number> {
  const expired = await adminDb.collection('students')
    .where('disabledAt', '<=', now - PURGE_AFTER_MS)
    .limit(20)
    .get();
  let deleted = 0;
  for (const student of expired.docs) {
    const status = await adminDb.doc(`accountStatus/${student.id}`).get();
    if (status.data()?.blocked !== true) {
      await student.ref.update({ disabledAt: FieldValue.delete() });
      continue;
    }
    try {
      const user = await adminAuth.getUser(student.id);
      if (!user.disabled) {
        await student.ref.update({ disabledAt: FieldValue.delete() });
        continue;
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }
    await deleteAccountCascade(student.id);
    deleted++;
  }
  return deleted;
}

/** 삭제된 Auth 계정의 오래된 차단 표식만 제거한다. */
export async function deleteExpiredAccountTombstones(now = Date.now()): Promise<number> {
  const expired = await adminDb.collection('accountStatus')
    .where('deletedAt', '<=', now - TOMBSTONE_MS)
    .limit(100)
    .get();
  if (expired.empty) return 0;
  const batch = adminDb.batch();
  expired.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return expired.size;
}
