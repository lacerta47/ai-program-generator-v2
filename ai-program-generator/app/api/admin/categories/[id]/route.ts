import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { deletePostSubcollections } from '@/lib/server/deletePost';
import { descendantIds } from '@/lib/board/categoryTree';
import type { Category } from '@/lib/firebase/types';

export const runtime = 'nodejs';

// 카테고리(서브트리) 삭제 — 서버 경유(Admin SDK). 각 하위 글을 /api/posts/[id] DELETE와 동일하게
// 서브컬렉션(likes·views) + reports까지 캐스케이드로 지운 뒤 글·카테고리 문서를 삭제한다.
// (클라 deleteCategoryTree는 글 문서만 지워 서브컬렉션·reports가 고아로 남고, reports는 규칙상
//  클라에서 삭제도 불가했다. #M5)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  try {
    // 전체 카테고리를 읽어 자기+후손 id를 계산(권위적).
    const catsSnap = await adminDb.collection('categories').get();
    const cats = catsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
    const ids = descendantIds(id, cats);

    // 각 카테고리의 글: 서브컬렉션 → (글 + reports) 캐스케이드.
    let deletedPosts = 0;
    for (const cid of ids) {
      const posts = await adminDb.collection('posts').where('categoryId', '==', cid).get();
      for (const p of posts.docs) {
        await deletePostSubcollections(p.ref); // likes·views 먼저 비움
        const reps = await adminDb.collection('reports').where('postId', '==', p.id).get();
        // 글+신고 배치 삭제(신고 ≤449면 글까지 한 배치, 초과분만 후속).
        for (let i = 0; i < Math.max(1, reps.docs.length); i += 449) {
          const batch = adminDb.batch();
          if (i === 0) batch.delete(p.ref);
          reps.docs.slice(i, i + 449).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        deletedPosts++;
      }
    }

    // 카테고리 문서들 삭제(450건 배치).
    for (let i = 0; i < ids.length; i += 450) {
      const batch = adminDb.batch();
      ids.slice(i, i + 450).forEach((cid) => batch.delete(adminDb.doc(`categories/${cid}`)));
      await batch.commit();
    }

    return NextResponse.json({ ok: true, categories: ids.length, posts: deletedPosts });
  } catch (e) {
    console.error('[/api/admin/categories/[id]] 삭제 실패:', e);
    return NextResponse.json({ error: '카테고리를 삭제하지 못했어요.' }, { status: 500 });
  }
}
