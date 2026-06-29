import { authedJson } from '@/lib/client/authedFetch';

// 카운터(좋아요·조회·포크)는 서버 API로만 갱신한다(클라 직접 쓰기는 규칙으로 차단됨).
type Action = 'like' | 'view' | 'fork';

function call<T>(postId: string, action: Action): Promise<T> {
  return authedJson<T>(`/api/posts/${postId}/count`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

export const likePost = (postId: string) => call<{ liked: boolean; likeCount: number }>(postId, 'like');
export const viewPost = (postId: string) => call<{ counted: boolean }>(postId, 'view');
export const forkPost = (postId: string) => call<{ ok: true }>(postId, 'fork');
