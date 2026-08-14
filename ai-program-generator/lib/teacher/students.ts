import { authedJson } from '@/lib/client/authedFetch';

export interface Student {
  uid: string;
  email: string | null;
  hakbun: string;
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
  startNo: number;
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

/** 여러 학생의 한도를 한 번에 조절(limitType·limitValue 중 최소 하나). */
export function bulkPatchStudents(
  uids: string[],
  body: { limitType?: 'daily' | 'total'; limitValue?: number },
): Promise<{ updated: string[]; failed: string[] }> {
  return authedJson('/api/teacher/students/bulk', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uids, ...body }),
  });
}

/** 여러 학생을 한 번에 삭제(각자 캐스케이드). */
export function bulkDeleteStudents(uids: string[]): Promise<{ deleted: string[]; failed: string[] }> {
  return authedJson('/api/teacher/students/bulk', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uids }),
  });
}
