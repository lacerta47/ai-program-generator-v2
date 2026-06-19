import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * uid의 모든 흔적을 삭제한다: Firestore(작품·닉네임·users·limits)를 먼저 지우고
 * (중간 실패 시 고아 닉네임 방지), Auth 계정을 마지막에 삭제.
 * usage 날짜문서·다른 글의 likes/views·본인이 낸 reports는 삭제하지 않는다(관리자 삭제와 동일, 무해·경미).
 */
export async function deleteAccountCascade(uid: string): Promise<void> {
  const refs: FirebaseFirestore.DocumentReference[] = [];
  const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
  posts.forEach((d) => refs.push(d.ref));
  const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
  nicks.forEach((d) => refs.push(d.ref));
  refs.push(adminDb.doc(`users/${uid}`));
  refs.push(adminDb.doc(`limits/${uid}`));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await adminAuth.deleteUser(uid);
}
