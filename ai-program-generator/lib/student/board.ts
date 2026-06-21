import { auth } from '@/lib/firebase/client';

export async function getMyBoard(): Promise<{ boardId: string; boardName: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/student/board', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  if (!data?.boardId) throw new Error('게시판을 찾지 못했어요.');
  return data as { boardId: string; boardName: string };
}
