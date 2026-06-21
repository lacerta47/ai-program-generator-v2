import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * uid의 모든 흔적을 삭제한다: Firestore(작품·닉네임·본인 글 신고·users·limits·teachers·students)를
 * 먼저 지우고(중간 실패 시 고아 닉네임 방지), Auth 계정을 마지막에 삭제.
 * - 본인 글에 대한 신고(postOwnerUid==uid)는 글과 함께 삭제.
 * - 본인이 '낸' 신고(reporterUid==uid)는 남긴다(대상 글은 그대로라 유효).
 * usage 날짜문서·다른 글의 likes/views는 삭제하지 않는다(무해·경미).
 */
export async function deleteAccountCascade(uid: string): Promise<void> {
  const refs: FirebaseFirestore.DocumentReference[] = [];
  const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
  posts.forEach((d) => refs.push(d.ref));
  const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
  nicks.forEach((d) => refs.push(d.ref));
  // 본인 글에 대한 신고는 글과 함께 삭제(내가 낸 신고 reporterUid는 남김).
  const reportsAgainst = await adminDb.collection('reports').where('postOwnerUid', '==', uid).get();
  reportsAgainst.forEach((d) => refs.push(d.ref));
  refs.push(adminDb.doc(`users/${uid}`));
  refs.push(adminDb.doc(`limits/${uid}`));
  refs.push(adminDb.doc(`teachers/${uid}`));
  refs.push(adminDb.doc(`students/${uid}`));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await adminAuth.deleteUser(uid);
}
