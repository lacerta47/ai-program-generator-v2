import { authedJson } from '@/lib/client/authedFetch';

export interface BoardPost {
  id: string;
  title: string;
  authorName: string;
  createdAt: number;
}

export function listBoardPosts(): Promise<{ board: { id: string; name: string }; posts: BoardPost[]; limited: boolean }> {
  return authedJson('/api/teacher/posts');
}

export function deleteBoardPost(id: string): Promise<{ ok: true }> {
  return authedJson(`/api/teacher/posts/${id}`, { method: 'DELETE' });
}
