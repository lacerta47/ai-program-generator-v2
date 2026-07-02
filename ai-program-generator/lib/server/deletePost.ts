import { adminDb } from '@/lib/firebase/admin';

/**
 * 글의 카운터 서브컬렉션(likes·views)을 일괄 삭제한다.
 * Firestore는 부모 문서(post)를 지워도 서브컬렉션을 자동 삭제하지 않아, 글을 지우면
 * posts/{id}/likes/{uid}·views/{uid} 문서가 고아로 남아 스토리지를 영구 점유한다.
 * 인기글은 수천 건일 수 있어 450건 배치로 반복 삭제한다. (외부 코드점검 #3)
 */
export async function deletePostSubcollections(postRef: FirebaseFirestore.DocumentReference): Promise<void> {
  for (const sub of ['likes', 'views']) {
    for (;;) {
      const snap = await postRef.collection(sub).limit(450).get();
      if (snap.empty) break;
      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      if (snap.size < 450) break; // 마지막 배치
    }
  }
}
