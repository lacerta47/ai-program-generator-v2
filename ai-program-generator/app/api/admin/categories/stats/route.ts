import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';

/**
 * 게시판 관리 화면용 부가 정보 — 게시판별 '주인'과 '작품 수'.
 *
 * 서버 경유인 이유: ①교사 이름·loginId는 `teachers/{uid}`와 Auth에 있어 클라가 모으려면 여러 컬렉션을
 * 훑어야 하고, ②작품 수는 count 집계 쿼리라 posts 읽기 규칙(문서별 boardTeacherUid 평가)과 얽힌다.
 * Admin SDK로 한 번에 처리하면 둘 다 사라진다. 관리자 전용 화면이라 호출 빈도도 낮다.
 *
 * 작품 수는 문서를 읽지 않는 count() 집계다(1000건당 1 read 과금) — 큰 보드에서도 저렴하다.
 * 카테고리 '자기 자신'의 글 수만 센다. 폴더 합계는 트리를 아는 클라이언트가 후손을 더해 만든다.
 */
export interface CategoryStat {
  /** 이 카테고리에 직접 속한 작품 수 */
  postCount: number;
  /** 교실 보드면 그 교사 uid, 관리자가 만든 공개 보드면 null */
  ownerUid: string | null;
  /** 교사 이름(발급 시 입력값). 교사 문서가 사라졌으면 빈 문자열 */
  ownerName: string;
  /** 교사 로그인 아이디(= schoolCode, 학생 로그인의 학교 코드) */
  ownerLoginId: string;
  /** 교사 계정이 정지됐는지 — 정지된 교사의 보드가 남아 있을 수 있다 */
  ownerDisabled: boolean;
  /** 교사 uid는 있는데 계정·문서를 못 찾음(삭제된 교사의 잔여 보드) */
  ownerMissing: boolean;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const catsSnap = await adminDb.collection('categories').get();
    const cats = catsSnap.docs.map((d) => ({
      id: d.id,
      teacherUid: (d.data().teacherUid as string | undefined) ?? null,
    }));

    // 교사 정보는 uid별로 한 번씩만 조회(같은 교사가 여러 보드를 가질 수 있음).
    const uids = [...new Set(cats.map((c) => c.teacherUid).filter((u): u is string => !!u))];
    const owners = new Map<string, { name: string; loginId: string; disabled: boolean; missing: boolean }>();
    if (uids.length > 0) {
      const docs = await adminDb.getAll(...uids.map((u) => adminDb.doc(`teachers/${u}`)));
      // Auth 조회 실패는 치명적이지 않다 — disabled만 모르는 채로 계속한다.
      const users = await adminAuth
        .getUsers(uids.map((uid) => ({ uid })))
        .catch(() => ({ users: [] as { uid: string; disabled: boolean }[] }));
      const byUid = new Map(users.users.map((u) => [u.uid, u]));
      uids.forEach((uid, i) => {
        const d = docs[i].data();
        const u = byUid.get(uid);
        owners.set(uid, {
          name: (d?.name as string) ?? '',
          loginId: (d?.schoolCode as string) ?? '',
          disabled: u?.disabled ?? false,
          missing: !docs[i].exists && !u,
        });
      });
    }

    const counts = await Promise.all(
      cats.map((c) =>
        adminDb
          .collection('posts')
          .where('categoryId', '==', c.id)
          .count()
          .get()
          .then((s) => s.data().count)
          .catch(() => -1), // 개별 실패는 화면에서 '—'로 표시(전체를 500으로 만들지 않음)
      ),
    );

    const stats: Record<string, CategoryStat> = {};
    cats.forEach((c, i) => {
      const o = c.teacherUid ? owners.get(c.teacherUid) : undefined;
      stats[c.id] = {
        postCount: counts[i],
        ownerUid: c.teacherUid,
        ownerName: o?.name ?? '',
        ownerLoginId: o?.loginId ?? '',
        ownerDisabled: o?.disabled ?? false,
        ownerMissing: o?.missing ?? false,
      };
    });

    return NextResponse.json({ stats });
  } catch (e) {
    console.error('게시판 통계 조회 실패:', e);
    return NextResponse.json({ error: '게시판 정보를 불러오지 못했어요.' }, { status: 500 });
  }
}
