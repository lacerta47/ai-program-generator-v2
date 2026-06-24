import { authedJson } from '@/lib/client/authedFetch';

export async function getMyBoard(): Promise<{ boardId: string; boardName: string }> {
  const data = await authedJson<{ boardId: string; boardName: string }>('/api/student/board');
  if (!data?.boardId) throw new Error('게시판을 찾지 못했어요.');
  return data;
}
