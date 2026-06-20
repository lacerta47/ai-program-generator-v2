import { auth } from '@/lib/firebase/client';

async function authed(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export interface BoardPost {
  id: string;
  title: string;
  authorName: string;
  createdAt: number;
}

export function listBoardPosts(): Promise<{ board: { id: string; name: string }; posts: BoardPost[] }> {
  return authed('/api/teacher/posts');
}

export function deleteBoardPost(id: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/posts/${id}`, { method: 'DELETE' });
}
