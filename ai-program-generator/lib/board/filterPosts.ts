// 게시판 검색·개념 필터 — 전부 클라이언트에서 처리한다.
// - 제목/작성자 검색: Firestore는 부분일치를 못 하므로(접두어만 가능) 클라 필터가 유일한 현실적 방법.
// - 개념 필터: 성능이 아니라 '정합성' 때문에 클라여야 한다. 화면의 개념 배지는 detectConcepts(코드 정적 분석)
//   기준인데, 서버의 conceptTags 필드(Gemini 자기보고, 구버전 글엔 없음)로 거르면 보이는 배지와 필터 결과가
//   어긋난다. 표시와 필터가 같은 근거를 쓰도록 여기서도 detectConcepts를 쓴다.
// 훑는 범위는 호출부(BoardView)가 페이지 로드로 제한한다 — 여기선 주어진 배열만 판단한다.

import type { Post } from '@/lib/firebase/types';
import { detectConcepts } from '@/lib/edu/detectConcepts';

export interface BoardFilter {
  /** 제목·작성자 검색어(공백만이면 미적용) */
  query: string;
  /** 선택한 개념 하나(없으면 미적용) */
  concept: string | null;
}

export const EMPTY_FILTER: BoardFilter = { query: '', concept: null };

export function isFilterActive(f: BoardFilter): boolean {
  return f.query.trim().length > 0 || f.concept !== null;
}

/**
 * 검색어 정규화 — 대소문자 무시 + 공백 제거.
 * 공백을 지우는 이유: 저학년이 '두더지 잡기'를 '두더지잡기'로 치는 일이 흔해 띄어쓰기로 못 찾으면 안 된다.
 */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/** detectConcepts는 코드 전체를 훑으므로 글당 1회만 계산해 재사용(입력 중 매 키마다 재스캔 방지). */
const conceptCache = new Map<string, string[]>();

export function postConcepts(post: Post): string[] {
  const hit = conceptCache.get(post.id);
  if (hit) return hit;
  const tags = post.code ? detectConcepts(post.code) : [];
  conceptCache.set(post.id, tags);
  return tags;
}

export function filterPosts(posts: Post[], f: BoardFilter): Post[] {
  const q = norm(f.query);
  return posts.filter((p) => {
    if (q && !norm(`${p.title} ${p.authorName ?? ''}`).includes(q)) return false;
    if (f.concept && !postConcepts(p).includes(f.concept)) return false;
    return true;
  });
}
