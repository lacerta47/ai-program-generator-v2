import { authedJson } from '@/lib/client/authedFetch';

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
  return authedJson('/api/teacher/students');
}

export function createStudents(body: {
  grade: number;
  classNo: number;
  count: number;
  password: string;
  limitType: 'daily' | 'total';
  limitValue: number;
}): Promise<{ created: { email: string; hakbun: string; password: string }[]; skipped: { hakbun: string; reason: string }[]; schoolCode: string }> {
  return authedJson('/api/teacher/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchStudent(
  uid: string,
  body: { name?: string; limitType?: 'daily' | 'total'; limitValue?: number; disabled?: boolean },
): Promise<{ ok: true }> {
  return authedJson(`/api/teacher/students/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteStudent(uid: string): Promise<{ ok: true }> {
  return authedJson(`/api/teacher/students/${uid}`, { method: 'DELETE' });
}
