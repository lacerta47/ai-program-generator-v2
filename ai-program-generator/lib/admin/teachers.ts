import { authedJson } from '@/lib/client/authedFetch';

export interface Teacher {
  uid: string;
  email: string | null;
  name: string;
  schoolCode?: string;
  totalQuota: number;
  usedTotal: number;
  disabled: boolean;
}

export function listTeachers(): Promise<{ teachers: Teacher[] }> {
  return authedJson('/api/admin/teachers');
}

export function createTeacher(body: {
  loginId: string;
  password: string;
  name: string;
  totalQuota: number;
}): Promise<{ uid: string; email: string; password: string }> {
  return authedJson('/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchTeacher(uid: string, body: { totalQuota?: number; disabled?: boolean }): Promise<{ ok: true }> {
  return authedJson(`/api/admin/teachers/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteTeacher(uid: string): Promise<{ ok: true }> {
  return authedJson(`/api/admin/teachers/${uid}`, { method: 'DELETE' });
}
