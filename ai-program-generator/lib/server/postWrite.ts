import 'server-only';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/admin';
import { assertClean, isReservedNickname } from '@/lib/moderation';
import type { NewPost, PostEdit } from '@/lib/firebase/types';
import { hasPhotoConsent } from '@/lib/server/photoConsent';

export class PostWriteError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PostWriteError('작품 정보가 올바르지 않아요.');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new PostWriteError(`${label}을(를) 확인해 주세요.`);
  }
  return value;
}

export function documentId(value: unknown, label: string): string {
  const id = text(value, label, 128);
  if (id.includes('/') || id === '.' || id === '..') throw new PostWriteError(`${label}을(를) 확인해 주세요.`);
  return id;
}

function onlyKeys(data: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(data).some((key) => !keys.includes(key))) throw new PostWriteError('허용되지 않은 작품 정보가 있어요.');
}

function readCode(value: unknown): NewPost['code'] {
  const code = record(value);
  onlyKeys(code, ['html', 'css', 'javascript']);
  return {
    html: text(code.html, 'HTML', 150000, false),
    css: text(code.css, 'CSS', 150000, false),
    javascript: text(code.javascript, 'JavaScript', 150000, false),
  };
}

function readPlan(value: unknown): NonNullable<NewPost['plan']> {
  const plan = record(value);
  onlyKeys(plan, ['name', 'look', 'usage', 'how', 'etc']);
  return {
    name: text(plan.name, '계획서', 2000, false),
    look: text(plan.look, '계획서', 5000, false),
    usage: text(plan.usage, '계획서', 5000, false),
    how: text(plan.how, '계획서', 5000, false),
    etc: text(plan.etc, '계획서', 5000, false),
  };
}

function visibleMarkup(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?(?:<\/(?:script|style)>|$)/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

/** 코드 문법을 일반 문장처럼 이어 검사하면 정상 코드가 오탐되고 저장이 느려진다. */
async function cleanVisibleCode(code: NewPost['code']): Promise<void> {
  await assertClean(visibleMarkup(code.html), '화면 문구');

  // JS/CSS가 화면에 표시하는 문구만 별도로 검사한다. 문법 토큰을 합쳐 만든 오탐을 피한다.
  const literals = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g;
  for (const source of [code.javascript, code.css]) {
    for (const match of source.matchAll(literals)) {
      const value = match[0].slice(1, -1);
      if (value && !value.startsWith('data:')) await assertClean(visibleMarkup(value), '화면 문구');
    }
  }
}

async function cleanHumanText(data: {
  title: string;
  authorName: string;
  plan?: NewPost['plan'];
  logicLine?: string;
  logicSummary?: string;
  forkedFromAuthor?: string;
  prompt?: string;
  conceptNotes?: Record<string, string>;
  code?: NewPost['code'];
}): Promise<void> {
  await assertClean(data.title, '제목');
  await assertClean(data.authorName, '이름');
  if (isReservedNickname(data.authorName)) throw new PostWriteError('그 이름은 쓸 수 없어요. 다른 이름으로 해주세요.');
  if (data.logicLine) await assertClean(data.logicLine, '핵심 한 줄');
  if (data.logicSummary) await assertClean(data.logicSummary, '로직 설명');
  if (data.forkedFromAuthor) await assertClean(data.forkedFromAuthor, '원본 작성자');
  if (data.prompt) await assertClean(data.prompt, '계획서');
  if (data.plan) {
    for (const [label, value] of Object.entries(data.plan)) await assertClean(value, label);
  }
  if (data.conceptNotes) {
    for (const [label, value] of Object.entries(data.conceptNotes)) await assertClean(value, label);
  }
  if (data.code) await cleanVisibleCode(data.code);
}

async function checkAuthor(uid: string, authorName: string): Promise<void> {
  const profile = await adminDb.doc(`users/${uid}`).get();
  if (profile.data()?.nickname !== authorName) throw new PostWriteError('별명을 다시 확인해 주세요.', 403);
}

export async function prepareNewPost(input: unknown, user: DecodedIdToken): Promise<NewPost> {
  const data = record(input);
  onlyKeys(data, [
    'title', 'categoryId', 'ownerUid', 'authorName', 'code', 'plan', 'prompt', 'createdAt',
    'forkedFrom', 'forkedFromAuthor', 'boardTeacherUid', 'photo', 'logicSummary',
    'conceptTags', 'logicLine', 'conceptNotes',
  ]);
  if (user.admin !== true && user.teacher !== true && user.student !== true && user.email_verified !== true) {
    throw new PostWriteError('이메일 인증 후 올릴 수 있어요.', 403);
  }
  if (data.ownerUid !== user.uid) throw new PostWriteError('내 작품만 올릴 수 있어요.', 403);
  const categoryId = documentId(data.categoryId, '게시판');
  const category = await adminDb.doc(`categories/${categoryId}`).get();
  if (!category.exists) throw new PostWriteError('게시판을 찾을 수 없어요.', 404);
  const boardTeacherUid = (category.data()?.teacherUid as string | null | undefined) ?? null;
  if (data.boardTeacherUid !== boardTeacherUid) throw new PostWriteError('게시판 정보가 달라요.', 403);
  if (boardTeacherUid && user.admin !== true && boardTeacherUid !== user.uid) {
    const student = await adminDb.doc(`students/${user.uid}`).get();
    if (user.student !== true || student.data()?.teacherUid !== boardTeacherUid) {
      throw new PostWriteError('이 반 게시판에는 올릴 수 없어요.', 403);
    }
  }

  const title = text(data.title, '제목', 100);
  const authorName = text(data.authorName, '별명', 20);
  await checkAuthor(user.uid, authorName);
  const post: NewPost = {
    title, authorName, categoryId, boardTeacherUid, ownerUid: user.uid,
    code: readCode(data.code), prompt: text(data.prompt, '계획서', 50000, false), createdAt: Date.now(),
  };
  if (data.plan !== undefined) post.plan = readPlan(data.plan);
  if (data.forkedFrom !== undefined) {
    const sourceId = documentId(data.forkedFrom, '원본');
    const source = await adminDb.doc(`posts/${sourceId}`).get();
    if (!source.exists) throw new PostWriteError('원본 작품을 찾을 수 없어요.', 404);
    const sourceBoard = source.data()?.boardTeacherUid as string | null | undefined;
    if (sourceBoard && user.admin !== true && sourceBoard !== user.uid) {
      const student = await adminDb.doc(`students/${user.uid}`).get();
      if (user.student !== true || student.data()?.teacherUid !== sourceBoard) {
        throw new PostWriteError('원본 작품을 볼 수 없어요.', 403);
      }
    }
    post.forkedFrom = sourceId;
    post.forkedFromAuthor = text(source.data()?.authorName, '원본 작성자', 20);
  }
  if (data.photo !== undefined) {
    const photo = text(data.photo, '사진', 350000);
    if (!boardTeacherUid || !/^data:image\/[a-zA-Z+.-]+;base64,/.test(photo)) throw new PostWriteError('사진 형식이나 게시판을 확인해 주세요.');
    if (!(await hasPhotoConsent(user.uid))) throw new PostWriteError('사진 전송 동의를 먼저 확인해 주세요.', 403);
    post.photo = photo;
  }
  if (data.logicSummary !== undefined) post.logicSummary = text(data.logicSummary, '로직 설명', 2000, false);
  if (data.logicLine !== undefined) post.logicLine = text(data.logicLine, '핵심 한 줄', 200, false);
  if (data.conceptTags !== undefined) {
    if (!Array.isArray(data.conceptTags) || data.conceptTags.length > 5 || data.conceptTags.some((tag) => typeof tag !== 'string' || tag.length > 20)) {
      throw new PostWriteError('개념 태그를 확인해 주세요.');
    }
    post.conceptTags = data.conceptTags;
  }
  if (data.conceptNotes !== undefined) {
    const notes = record(data.conceptNotes);
    onlyKeys(notes, ['순서', '조건', '반복', '입력', '출력']);
    post.conceptNotes = Object.fromEntries(Object.entries(notes).map(([key, value]) => [key, text(value, '개념 설명', 60, false)]));
  }
  await cleanHumanText(post);
  if (Buffer.byteLength(JSON.stringify(post), 'utf8') > 900000) {
    throw new PostWriteError('작품이 너무 커요. 사진이나 코드를 줄여 주세요.', 413);
  }
  return post;
}

export async function preparePostEdit(
  input: unknown,
  user: DecodedIdToken,
  existing: { ownerUid: string; authorName: string },
): Promise<Partial<PostEdit>> {
  if (user.uid !== existing.ownerUid && user.admin !== true) throw new PostWriteError('내 작품만 고칠 수 있어요.', 403);
  const data = record(input);
  onlyKeys(data, ['title', 'authorName', 'plan', 'code', 'prompt', 'updatedAt']);
  if (Object.keys(data).length === 1 && 'title' in data) {
    const title = text(data.title, '제목', 100).trim();
    await assertClean(title, '제목');
    return { title };
  }
  const edit: Partial<PostEdit> = {
    title: text(data.title, '제목', 100),
    authorName: text(data.authorName, '별명', 20),
    plan: readPlan(data.plan),
    code: readCode(data.code),
    prompt: text(data.prompt, '계획서', 50000, false),
    updatedAt: Date.now(),
  };
  if (user.admin !== true && edit.authorName !== existing.authorName) await checkAuthor(existing.ownerUid, edit.authorName!);
  await cleanHumanText(edit as { title: string; authorName: string; plan: NewPost['plan']; code: NewPost['code']; prompt: string });
  return edit;
}
