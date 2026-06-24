import { authedJson } from '@/lib/client/authedFetch';

export interface TeacherReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  items: { reason: string; memo?: string; createdAt: number }[];
}

export function listTeacherReports(): Promise<{ reports: TeacherReportGroup[] }> {
  return authedJson('/api/teacher/reports');
}

export function dismissReportedPost(postId: string): Promise<{ ok: true }> {
  return authedJson(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: false }),
  });
}

export function deleteReportedPost(postId: string): Promise<{ ok: true }> {
  return authedJson(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: true }),
  });
}
