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

export interface TeacherReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  items: { reason: string; memo?: string; createdAt: number }[];
}

export function listTeacherReports(): Promise<{ reports: TeacherReportGroup[] }> {
  return authed('/api/teacher/reports');
}

export function dismissReportedPost(postId: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: false }),
  });
}

export function deleteReportedPost(postId: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: true }),
  });
}
