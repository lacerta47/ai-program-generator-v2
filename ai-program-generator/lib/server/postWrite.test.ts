import type { DecodedIdToken } from 'firebase-admin/auth';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const docs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    doc: (path: string) => ({ get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }) }),
  },
}));

import { PostWriteError, prepareNewPost, preparePostEdit } from './postWrite';
import { ProfanityError } from '@/lib/moderation';

const student = { uid: 'student-a', student: true } as unknown as DecodedIdToken;
const other = { uid: 'student-b', student: true } as unknown as DecodedIdToken;

const valid = () => ({
  title: '나의 게임', categoryId: 'class-a', boardTeacherUid: 'teacher-a',
  ownerUid: 'student-a', authorName: '코딩왕',
  code: { html: '<main>안녕</main>', css: '', javascript: '' },
  plan: { name: '나의 게임', look: '', usage: '', how: '', etc: '' },
  prompt: '즐거운 게임', createdAt: Date.now() + 1_000_000,
});

describe('서버 게시물 쓰기 검증', () => {
  beforeEach(() => {
    docs.clear();
    docs.set('categories/class-a', { teacherUid: 'teacher-a' });
    docs.set('students/student-a', { teacherUid: 'teacher-a' });
    docs.set('users/student-a', { nickname: '코딩왕' });
  });

  test('학급 소속·별명을 확인하고 작성 시각은 서버에서 정한다', async () => {
    const input = valid();
    const result = await prepareNewPost(input, student);
    expect(result.ownerUid).toBe('student-a');
    expect(result.boardTeacherUid).toBe('teacher-a');
    expect(result.createdAt).toBeLessThan(input.createdAt);
  });

  test('다른 사람의 UID·학급·별명 위조를 거부한다', async () => {
    await expect(prepareNewPost({ ...valid(), ownerUid: 'student-b' }, student)).rejects.toBeInstanceOf(PostWriteError);
    await expect(prepareNewPost({ ...valid(), authorName: '다른별명' }, student)).rejects.toBeInstanceOf(PostWriteError);
    await expect(prepareNewPost({ ...valid(), ownerUid: 'student-b' }, other)).rejects.toBeInstanceOf(PostWriteError);
  });

  test('직접 API 호출의 비속어와 임의 필드를 거부한다', async () => {
    await expect(prepareNewPost({ ...valid(), title: '병신 게임' }, student)).rejects.toBeInstanceOf(ProfanityError);
    await expect(prepareNewPost({ ...valid(), code: { ...valid().code, html: '<main>병신</main>' } }, student))
      .rejects.toBeInstanceOf(ProfanityError);
    await expect(prepareNewPost({ ...valid(), code: { ...valid().code, javascript: "const label = '병신';" } }, student))
      .rejects.toBeInstanceOf(ProfanityError);
    await expect(prepareNewPost({ ...valid(), adminApproved: true }, student)).rejects.toBeInstanceOf(PostWriteError);
  });

  test('HTML 문법 토큰을 합친 비속어 오탐은 저장을 막지 않는다', async () => {
    await expect(prepareNewPost({ ...valid(), code: { ...valid().code, html: '<div class="hole">게임</div>' } }, student))
      .resolves.toHaveProperty('title', '나의 게임');
    await expect(prepareNewPost({ ...valid(), code: { ...valid().code, javascript: "const screen = `<div class='hole'>게임</div>`;" } }, student))
      .resolves.toHaveProperty('title', '나의 게임');
  });

  test('수정은 작성자만 가능하고 제목도 검열한다', async () => {
    const existing = { ownerUid: 'student-a', authorName: '옛별명' };
    await expect(preparePostEdit({ title: '새 제목' }, other, existing)).rejects.toBeInstanceOf(PostWriteError);
    await expect(preparePostEdit({ title: '병신 게임' }, student, existing)).rejects.toBeInstanceOf(ProfanityError);
    await expect(preparePostEdit({ title: '새 제목' }, student, existing)).resolves.toEqual({ title: '새 제목' });
    const original = valid();
    await expect(preparePostEdit({ title: original.title, authorName: '옛별명', plan: original.plan, code: original.code, prompt: original.prompt }, student, existing))
      .resolves.toHaveProperty('authorName', '옛별명');
  });
});
