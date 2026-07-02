import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { deletePostSubcollections } from './deletePost';

/**
 * uid의 모든 흔적을 삭제한다: Firestore(작품·닉네임·본인 글 신고·users·limits·teachers·students,
 * 선생님이면 schools/{schoolCode})를 먼저 지우고(중간 실패 시 고아 닉네임 방지), Auth 계정을 마지막에 삭제.
 * - 본인 글에 대한 신고(postOwnerUid==uid)는 글과 함께 삭제.
 * - 본인이 '낸' 신고(reporterUid==uid)는 남긴다(대상 글은 그대로라 유효).
 * - 본인 글의 likes/views 서브컬렉션은 함께 삭제(고아 방지, #3). 본인이 '남의 글'에 남긴 likes/views는
 *   남긴다(무해·경미). usage 날짜문서도 남긴다.
 * - [의도 — L9] 학생 삭제 시 교사 공유풀(teachers.usedTotal)은 되돌리지 않는다. 풀은 '누적 예산'
 *   설계(CLAUDE.md)이고, 1일형 학생은 개인 소비량(student.usedTotal)을 추적하지 않아 부분환급이
 *   비대칭 footgun이 된다. 학년 순환 등으로 풀이 잠식되면 admin이 teachers.totalQuota를 보충한다.
 */
export async function deleteAccountCascade(uid: string): Promise<void> {
  const refs: FirebaseFirestore.DocumentReference[] = [];
  const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
  for (const d of posts.docs) {
    await deletePostSubcollections(d.ref); // 글 삭제 전에 서브컬렉션(likes·views)부터 비움
    refs.push(d.ref);
  }
  const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
  nicks.forEach((d) => refs.push(d.ref));
  // 본인 글에 대한 신고는 글과 함께 삭제(내가 낸 신고 reporterUid는 남김).
  const reportsAgainst = await adminDb.collection('reports').where('postOwnerUid', '==', uid).get();
  reportsAgainst.forEach((d) => refs.push(d.ref));
  refs.push(adminDb.doc(`users/${uid}`));
  refs.push(adminDb.doc(`limits/${uid}`));
  refs.push(adminDb.doc(`teachers/${uid}`));
  refs.push(adminDb.doc(`students/${uid}`));
  // 선생님 계정이면 그 학교(schools/{schoolCode}) 문서도 정리 — 삭제된 교사가 학생 로그인 드롭다운에 남지 않게.
  const teacherDoc = await adminDb.doc(`teachers/${uid}`).get();
  const schoolCode = teacherDoc.data()?.schoolCode as string | undefined;
  if (schoolCode) refs.push(adminDb.doc(`schools/${schoolCode}`));
  // [의도 — L10] 학급보드 categories/{boardId}는 삭제하지 않는다 — 비활성 학생의 보존된 작품이 그
  //   카테고리 아래 남아야 하므로(보드를 지우면 작품도 orphan). admin이 원하면 M5(/api/admin/categories/[id])로 정리.
  // 선생님 삭제 시 산하 학생은 작품·문서·보드를 보존하되 Auth만 비활성(로그인 차단) — 계정·작품은 지우지 않음.
  if (teacherDoc.exists) {
    const students = await adminDb.collection('students').where('teacherUid', '==', uid).get();
    await Promise.all(students.docs.map((d) => adminAuth.updateUser(d.id, { disabled: true }).catch(() => {})));
  }
  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await adminAuth.deleteUser(uid);
}
