import { viewPost } from '@/lib/client/postCount';

/**
 * 조회 기록 — 서버 API가 1인1회 dedup + viewCount를 권위적으로 처리.
 * 새로 카운트됐으면 true. (uid 인자는 호출부 호환 위해 유지; 서버가 토큰으로 판단)
 */
export async function recordView(postId: string): Promise<boolean> {
  const { counted } = await viewPost(postId);
  return counted;
}
