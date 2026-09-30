import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireTeacher: vi.fn(),
  readDailyLimit: vi.fn(),
  writeDailyLimit: vi.fn(),
  verifyIdToken: vi.fn(),
  dbCollection: vi.fn(),
  dbDoc: vi.fn(),
  ensureTeacherBoard: vi.fn(),
}));

vi.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/admin/requireTeacher', () => ({ requireTeacher: mocks.requireTeacher }));
vi.mock('@/lib/admin/usageConfig', () => ({
  readDailyLimit: mocks.readDailyLimit,
  writeDailyLimit: mocks.writeDailyLimit,
}));
vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken },
  adminDb: { collection: mocks.dbCollection, doc: mocks.dbDoc },
}));
vi.mock('@/lib/server/teacherBoard', () => ({ ensureTeacherBoard: mocks.ensureTeacherBoard }));

import { GET as getAdminConfig, PATCH as patchAdminConfig } from '@/app/api/admin/config/route';
import { GET as getStudentBoard } from '@/app/api/student/board/route';
import { GET as getTeacherStudents } from '@/app/api/teacher/students/route';

function request(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

function denied(status: 401 | 403) {
  return NextResponse.json({ error: '차단' }, { status });
}

describe('대표 API 권한 게이트', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  describe('관리자 설정 API', () => {
    test('관리자 게이트가 거부한 요청은 데이터 조회 없이 그대로 차단한다', async () => {
      mocks.requireAdmin.mockResolvedValue(denied(403));

      const response = await getAdminConfig(request('/api/admin/config'));

      expect(response.status).toBe(403);
      expect(mocks.readDailyLimit).not.toHaveBeenCalled();
    });

    test('관리자는 설정을 조회할 수 있다', async () => {
      mocks.requireAdmin.mockResolvedValue({ uid: 'admin-a' });
      mocks.readDailyLimit.mockResolvedValue(15);

      const response = await getAdminConfig(request('/api/admin/config'));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ dailyLimit: 15 });
    });

    test('관리자만 유효한 설정값을 저장할 수 있다', async () => {
      mocks.requireAdmin.mockResolvedValue({ uid: 'admin-a' });

      const response = await patchAdminConfig(request('/api/admin/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dailyLimit: 20 }),
      }));

      expect(response.status).toBe(200);
      expect(mocks.writeDailyLimit).toHaveBeenCalledWith(20);
    });

    test('잘못된 설정값은 저장하지 않는다', async () => {
      mocks.requireAdmin.mockResolvedValue({ uid: 'admin-a' });

      const response = await patchAdminConfig(request('/api/admin/config', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dailyLimit: -1 }),
      }));

      expect(response.status).toBe(400);
      expect(mocks.writeDailyLimit).not.toHaveBeenCalled();
    });
  });

  test('학생 관리 API는 교사 게이트가 거부하면 DB를 조회하지 않는다', async () => {
    mocks.requireTeacher.mockResolvedValue(denied(403));

    const response = await getTeacherStudents(request('/api/teacher/students'));

    expect(response.status).toBe(403);
    expect(mocks.dbCollection).not.toHaveBeenCalled();
  });

  describe('학생 게시판 API', () => {
    test('토큰이 없으면 401을 반환한다', async () => {
      const response = await getStudentBoard(request('/api/student/board'));

      expect(response.status).toBe(401);
      expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    });

    test('학생 역할이 아니면 403을 반환한다', async () => {
      mocks.verifyIdToken.mockResolvedValue({ uid: 'teacher-a', teacher: true });

      const response = await getStudentBoard(request('/api/student/board', {
        headers: { authorization: 'Bearer teacher-token' },
      }));

      expect(response.status).toBe(403);
      expect(mocks.dbDoc).not.toHaveBeenCalled();
    });

    test('학생은 자기 소속 교사의 게시판만 조회한다', async () => {
      mocks.verifyIdToken.mockResolvedValue({ uid: 'student-a', student: true });
      mocks.dbDoc.mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: () => ({ teacherUid: 'teacher-a' }) }),
      });
      mocks.ensureTeacherBoard.mockResolvedValue({ id: 'class-a', teacherUid: 'teacher-a' });

      const response = await getStudentBoard(request('/api/student/board', {
        headers: { authorization: 'Bearer student-token' },
      }));

      expect(response.status).toBe(200);
      expect(mocks.dbDoc).toHaveBeenCalledWith('students/student-a');
      expect(mocks.ensureTeacherBoard).toHaveBeenCalledWith('teacher-a');
      expect(await response.json()).toEqual({ id: 'class-a', teacherUid: 'teacher-a' });
    });
  });
});
