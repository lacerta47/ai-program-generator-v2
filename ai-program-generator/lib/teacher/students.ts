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

export interface Student {
  uid: string;
  email: string | null;
  name: string;
  limitType: 'daily' | 'total';
  limitValue: number;
  usedTotal: number;
  disabled: boolean;
}

export function listStudents(): Promise<{ students: Student[] }> {
  return authed('/api/teacher/students');
}

export function createStudents(body: {
  prefix: string;
  count: number;
  password: string;
  limitType: 'daily' | 'total';
  limitValue: number;
}): Promise<{ created: { email: string; password: string }[]; skipped: { email: string; reason: string }[] }> {
  return authed('/api/teacher/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchStudent(
  uid: string,
  body: { name?: string; limitType?: 'daily' | 'total'; limitValue?: number; disabled?: boolean },
): Promise<{ ok: true }> {
  return authed(`/api/teacher/students/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteStudent(uid: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/students/${uid}`, { method: 'DELETE' });
}
