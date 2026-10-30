import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(), listUsers: vi.fn(), getUser: vi.fn(), getAll: vi.fn(),
  doc: vi.fn(), collection: vi.fn(), readTotalLimit: vi.fn(),
  setUserLimit: vi.fn(), clearUserLimit: vi.fn(), setAccountDisabled: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin/requireAdmin', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { listUsers: mocks.listUsers, getUser: mocks.getUser },
  adminDb: { doc: mocks.doc, collection: mocks.collection, getAll: mocks.getAll },
}));
vi.mock('@/lib/admin/usageConfig', async (importOriginal) => ({
  ...await importOriginal<typeof import('./usageConfig')>(),
  readTotalLimit: mocks.readTotalLimit, setUserLimit: mocks.setUserLimit, clearUserLimit: mocks.clearUserLimit,
}));
vi.mock('@/lib/server/accountStatus', () => ({ setAccountDisabled: mocks.setAccountDisabled }));
vi.mock('@/lib/server/deleteAccount', () => ({ deleteAccountCascade: vi.fn() }));

import { GET } from '@/app/api/admin/users/route';
import { PATCH } from '@/app/api/admin/users/[uid]/route';
import type { MembersResponse } from './members';
import { todayKeyKST } from '@/lib/usageDay';

describe('관리자 학생 한도 표시와 일반 계정 한도 변경 분리', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireAdmin.mockResolvedValue({ uid: 'admin' });
    mocks.readTotalLimit.mockResolvedValue(20);
  });

  test('실제 학생 일일/총 한도·소진량을 읽고 일반 한도와 섞지 않는다', async () => {
    mocks.listUsers.mockResolvedValue({ users: ['daily', 'total', 'missing', 'regular'].map((uid) => ({
      uid, metadata: {}, customClaims: uid === 'regular' ? {} : { student: true },
    })), pageToken: 'next-page' });
    const docs: Record<string, unknown> = {
      'students/daily': { limitType: 'daily', limitValue: 5, usedTotal: 99 },
      'students/total': { limitType: 'total', limitValue: 10, usedTotal: 4 },
      'limits/daily': { dailyLimit: 30 },
      'limits/regular': { dailyLimit: 7 },
      'memberUsage/regular': { count: 3 },
      [`usage/daily_${todayKeyKST()}`]: { count: 2 },
      [`usage/total_${todayKeyKST()}`]: { count: 1 },
    };
    mocks.doc.mockImplementation((path) => path);
    mocks.getAll.mockImplementation(async (...paths: string[]) => paths.reverse().map((path) => ({
      id: path.split('/').at(-1), exists: path in docs, data: () => docs[path],
    })));
    mocks.collection.mockReturnValue({ where: () => ({ count: () => ({
      get: async () => ({ data: () => ({ count: 0 }) }),
    }) }) });
    const response = await GET(new NextRequest('http://localhost/api/admin/users?pageToken=cursor'));
    const data: MembersResponse = await response.json();
    expect(response.status).toBe(200);
    expect(mocks.listUsers).toHaveBeenCalledWith(50, 'cursor');
    expect(data.nextPageToken).toBe('next-page');
    expect(data.members[0].studentQuota).toEqual({ limitType: 'daily', limitValue: 5, used: 2 });
    expect(data.members[1].studentQuota).toEqual({ limitType: 'total', limitValue: 10, used: 4 });
    expect(data.members[2]).toMatchObject({ isStudent: true, studentQuota: null });
    expect(data.members[3]).toMatchObject({ isStudent: false, studentQuota: null, limitOverride: 7, totalUsed: 3 });
    expect(mocks.doc).not.toHaveBeenCalledWith('students/regular');
  });

  test('권한 거부 시 학생 문서도 조회하지 않는다', async () => {
    mocks.requireAdmin.mockResolvedValue(NextResponse.json({ error: '차단' }, { status: 403 }));
    expect((await GET(new NextRequest('http://localhost/api/admin/users'))).status).toBe(403);
    expect(mocks.listUsers).not.toHaveBeenCalled();
    expect(mocks.getAll).not.toHaveBeenCalled();
  });

  test.each([0, 10, null])('학생에게 일반 총 한도 %s 저장/초기화를 시도하면 변경 없이 거부', async (totalLimit) => {
    mocks.getUser.mockResolvedValue({ customClaims: { student: true } });
    const response = await PATCH(new NextRequest('http://localhost/api/admin/users/student', {
      method: 'PATCH', body: JSON.stringify({ totalLimit, disabled: true }),
    }), { params: Promise.resolve({ uid: 'student' }) });
    expect(response.status).toBe(400);
    expect(mocks.setUserLimit).not.toHaveBeenCalled();
    expect(mocks.clearUserLimit).not.toHaveBeenCalled();
    expect(mocks.setAccountDisabled).not.toHaveBeenCalled();
  });

  test('일반 계정의 맞춤 한도 변경은 유지한다', async () => {
    mocks.getUser.mockResolvedValue({ customClaims: {} });
    const response = await PATCH(new NextRequest('http://localhost/api/admin/users/regular', {
      method: 'PATCH', body: JSON.stringify({ totalLimit: 7 }),
    }), { params: Promise.resolve({ uid: 'regular' }) });
    expect(response.status).toBe(200);
    expect(mocks.setUserLimit).toHaveBeenCalledWith('regular', 7);
  });

  test('이전 화면의 일일 한도 요청을 성공으로 오인시키지 않는다', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/users/regular', {
      method: 'PATCH', body: JSON.stringify({ dailyLimit: 7 }),
    }), { params: Promise.resolve({ uid: 'regular' }) });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain('새로고침');
    expect(mocks.setUserLimit).not.toHaveBeenCalled();
  });

  test.each([null, [], 1, 'invalid'])('객체가 아닌 설정 본문 %j는 변경 없이 거부', async (body) => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/users/regular', {
      method: 'PATCH', body: JSON.stringify(body),
    }), { params: Promise.resolve({ uid: 'regular' }) });
    expect(response.status).toBe(400);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.setAccountDisabled).not.toHaveBeenCalled();
  });

  test('잘못된 한도와 정지를 함께 보내도 계정을 먼저 정지하지 않는다', async () => {
    const response = await PATCH(new NextRequest('http://localhost/api/admin/users/regular', {
      method: 'PATCH', body: JSON.stringify({ totalLimit: -1, disabled: true }),
    }), { params: Promise.resolve({ uid: 'regular' }) });
    expect(response.status).toBe(400);
    expect(mocks.setAccountDisabled).not.toHaveBeenCalled();
    expect(mocks.setUserLimit).not.toHaveBeenCalled();
  });

  test.each(['teacher', 'admin'])('%s에게 일반 회원 총 한도를 저장하지 않는다', async (role) => {
    mocks.getUser.mockResolvedValue({ customClaims: { [role]: true } });
    const response = await PATCH(new NextRequest(`http://localhost/api/admin/users/${role}`, {
      method: 'PATCH', body: JSON.stringify({ totalLimit: 7 }),
    }), { params: Promise.resolve({ uid: role }) });
    expect(response.status).toBe(400);
    expect(mocks.setUserLimit).not.toHaveBeenCalled();
  });
});
