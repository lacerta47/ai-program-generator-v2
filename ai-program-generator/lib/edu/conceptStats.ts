// 개념 수집 도감(교육 Phase 2, #2B) — 내 작품들을 훑어 각 개념을 몇 개 작품에서 썼는지 집계.
// 표시 소스는 detectConcepts(코드 정적 분석, 배지와 동일) — conceptTags 없는 구버전 글도 소급 집계.
// 새 컬렉션·쓰기·규칙 없음. fetchMyPosts(인덱스 있음)를 최대 몇 페이지만 훑어 읽기 비용을 통제.
// 집계와 함께 '어떤 작품에서 썼는지'(works)도 모은다 — 이미 훑는 글이라 추가 읽기 0.

import { fetchMyPosts, type PostCursor } from '@/lib/firebase/posts';
import { detectConcepts } from '@/lib/edu/detectConcepts';
import { CONCEPT_ORDER } from '@/lib/edu/concepts';

/** 도감에서 개념을 눌렀을 때 보여줄 내 작품 한 건. */
export interface ConceptWork {
  id: string;
  title: string;
  categoryId: string;
  /** 그 개념을 이 작품에서 어떻게 썼는지(생성 시 저장된 60자 이하 설명) — 구버전 글엔 없음. */
  note?: string;
}

export interface ConceptStats {
  /** 훑은 작품 수 */
  totalWorks: number;
  /** 더 있는데 상한에서 끊겼는지(그럼 '최근 N개 기준') */
  capped: boolean;
  /** 개념 → 그 개념을 쓴 작품 수 */
  counts: Record<string, number>;
  /** 개념 → 그 개념을 쓴 내 작품 목록(최신순) */
  works: Record<string, ConceptWork[]>;
}

const MAX_PAGES = 3; // 20/페이지 × 3 = 최대 ~60건 훑음(저학년은 사실상 전부 커버)

export async function fetchMyConceptStats(uid: string): Promise<ConceptStats> {
  const works: Record<string, ConceptWork[]> = Object.fromEntries(
    CONCEPT_ORDER.map((c) => [c, [] as ConceptWork[]]),
  );
  let cursor: PostCursor | undefined;
  let total = 0;
  let capped = false;

  for (let p = 0; p < MAX_PAGES; p++) {
    const page = await fetchMyPosts(uid, cursor);
    for (const post of page.posts) {
      total++;
      if (!post.code) continue; // 코드 없는 구버전/손상 글은 건너뜀(insights 라우트와 동일 방어)
      for (const c of detectConcepts(post.code)) {
        if (!(c in works)) continue;
        works[c].push({
          id: post.id,
          title: post.title,
          categoryId: post.categoryId,
          note: post.conceptNotes?.[c],
        });
      }
    }
    if (!page.hasMore) break;
    cursor = page.cursor ?? undefined;
    if (p === MAX_PAGES - 1) capped = true; // 마지막 허용 페이지인데 더 남음
  }

  const counts = Object.fromEntries(CONCEPT_ORDER.map((c) => [c, works[c].length]));
  return { totalWorks: total, capped, counts, works };
}
