import { auth } from '@/lib/firebase/client';

// 카운터(좋아요·조회·포크)는 서버 API로만 갱신한다(클라 직접 쓰기는 규칙으로 차단됨).
type Action = 'like' | 'view' | 'fork';

async function call<T>(postId: string, action: Action): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/posts/${postId}/count`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as T;
}

export const likePost = (postId: string) => call<{ liked: boolean; likeCount: number }>(postId, 'like');
export const viewPost = (postId: string) => call<{ counted: boolean; viewCount: number }>(postId, 'view');
export const forkPost = (postId: string) => call<{ ok: true }>(postId, 'fork');
