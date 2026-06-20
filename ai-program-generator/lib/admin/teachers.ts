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

export interface Teacher {
  uid: string;
  email: string | null;
  name: string;
  totalQuota: number;
  disabled: boolean;
}

export function listTeachers(): Promise<{ teachers: Teacher[] }> {
  return authed('/api/admin/teachers');
}

export function createTeacher(body: {
  loginId: string;
  password: string;
  name: string;
  totalQuota: number;
}): Promise<{ uid: string; email: string; password: string }> {
  return authed('/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchTeacher(uid: string, body: { totalQuota?: number; disabled?: boolean }): Promise<{ ok: true }> {
  return authed(`/api/admin/teachers/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteTeacher(uid: string): Promise<{ ok: true }> {
  return authed(`/api/admin/teachers/${uid}`, { method: 'DELETE' });
}
