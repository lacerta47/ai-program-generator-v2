import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { verifyIdToken } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifyIdToken },
}));

import { requireAdmin } from './requireAdmin';
import { requireTeacher } from './requireTeacher';

function request(token?: string) {
  return new NextRequest('http://localhost/api/test', {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

async function responseError(result: NextResponse | { uid: string }) {
  expect(result).toBeInstanceOf(NextResponse);
  return (result as NextResponse).json() as Promise<{ error: string }>;
}

describe('requireAdmin', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  test('토큰이 없으면 401을 반환한다', async () => {
    const result = await requireAdmin(request());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(await responseError(result)).toEqual({ error: '로그인이 필요해요.' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('잘못됐거나 폐기된 토큰은 401을 반환한다', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const result = await requireAdmin(request('expired'));

    expect((result as NextResponse).status).toBe(401);
    expect(await responseError(result)).toEqual({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' });
    expect(verifyIdToken).toHaveBeenCalledWith('expired', true);
  });

  test('관리자가 아닌 사용자는 403을 반환한다', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'teacher-a', teacher: true });

    const result = await requireAdmin(request('teacher-token'));

    expect((result as NextResponse).status).toBe(403);
    expect(await responseError(result)).toEqual({ error: '관리자만 할 수 있어요.' });
  });

  test('관리자 토큰은 UID를 반환하고 폐기 여부까지 검사한다', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'admin-a', admin: true });

    const result = await requireAdmin(request('admin-token'));

    expect(result).toEqual({ uid: 'admin-a' });
    expect(verifyIdToken).toHaveBeenCalledWith('admin-token', true);
  });
});

describe('requireTeacher', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
  });

  test('토큰이 없으면 401을 반환한다', async () => {
    const result = await requireTeacher(request());

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
    expect(await responseError(result)).toEqual({ error: '로그인이 필요해요.' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('잘못됐거나 폐기된 토큰은 401을 반환한다', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    const result = await requireTeacher(request('expired'));

    expect((result as NextResponse).status).toBe(401);
    expect(await responseError(result)).toEqual({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' });
    expect(verifyIdToken).toHaveBeenCalledWith('expired', true);
  });

  test('선생님이 아닌 사용자는 403을 반환한다', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'student-a', student: true });

    const result = await requireTeacher(request('student-token'));

    expect((result as NextResponse).status).toBe(403);
    expect(await responseError(result)).toEqual({ error: '선생님만 할 수 있어요.' });
  });

  test('선생님 토큰은 UID를 반환하고 폐기 여부까지 검사한다', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'teacher-a', teacher: true });

    const result = await requireTeacher(request('teacher-token'));

    expect(result).toEqual({ uid: 'teacher-a' });
    expect(verifyIdToken).toHaveBeenCalledWith('teacher-token', true);
  });
});
