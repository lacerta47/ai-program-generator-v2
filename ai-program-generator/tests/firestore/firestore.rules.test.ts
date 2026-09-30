import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, describe, test } from 'vitest';

const PROJECT_ID = 'demo-lun-rules';
const NOW = Date.now();

const validCode = {
  html: '<main>안녕</main>',
  css: 'main { color: blue; }',
  javascript: 'console.log("hello");',
};

function post(overrides: Record<string, unknown> = {}) {
  return {
    title: '테스트 작품',
    categoryId: 'public',
    ownerUid: 'student-a',
    authorName: '학생A',
    code: validCode,
    prompt: '테스트 계획',
    createdAt: NOW,
    boardTeacherUid: null,
    ...overrides,
  };
}

describe('Firestore 권한 규칙', () => {
  let env: RulesTestEnvironment;

  const anonymous = () => env.unauthenticatedContext();
  const admin = () => env.authenticatedContext('admin', { admin: true, email_verified: true });
  const teacherA = () => env.authenticatedContext('teacher-a', { teacher: true });
  const teacherB = () => env.authenticatedContext('teacher-b', { teacher: true });
  const studentA = () => env.authenticatedContext('student-a', {
    student: true,
    classTeacherUid: 'teacher-a',
  });
  const studentB = () => env.authenticatedContext('student-b', {
    student: true,
    classTeacherUid: 'teacher-b',
  });
  const verifiedUser = () => env.authenticatedContext('verified-user', { email_verified: true });
  const unverifiedUser = () => env.authenticatedContext('unverified-user', { email_verified: false });

  async function seed() {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, 'categories/public'), {
          name: '공개 게시판',
          order: 0,
          createdAt: NOW,
        }),
        setDoc(doc(db, 'categories/class-a'), {
          name: 'A반 게시판',
          order: 1,
          createdAt: NOW,
          teacherUid: 'teacher-a',
        }),
        setDoc(doc(db, 'categories/class-b'), {
          name: 'B반 게시판',
          order: 2,
          createdAt: NOW,
          teacherUid: 'teacher-b',
        }),
        setDoc(doc(db, 'students/student-a'), {
          teacherUid: 'teacher-a',
          hakbun: '10501',
        }),
        setDoc(doc(db, 'students/student-b'), {
          teacherUid: 'teacher-b',
          hakbun: '20501',
        }),
        setDoc(doc(db, 'teachers/teacher-a'), { name: '선생님A' }),
        setDoc(doc(db, 'posts/public-post'), post()),
        setDoc(doc(db, 'posts/class-post'), post({
          categoryId: 'class-a',
          boardTeacherUid: 'teacher-a',
        })),
      ]);
    });
  }

  function db(context: RulesTestContext) {
    return context.firestore();
  }

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
  });

  afterEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  describe('게시판과 게시물 조회', () => {
    test('카테고리는 비로그인 사용자도 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(anonymous()), 'categories/public')));
    });

    test('일반 사용자는 카테고리를 만들 수 없다', async () => {
      await assertFails(setDoc(doc(db(verifiedUser()), 'categories/new'), {
        name: '새 게시판', order: 3, createdAt: NOW,
      }));
    });

    test('관리자는 유효한 카테고리를 만들 수 있다', async () => {
      await assertSucceeds(setDoc(doc(db(admin()), 'categories/new'), {
        name: '새 게시판', order: 3, createdAt: NOW,
      }));
    });

    test('공개 게시물은 비로그인 사용자도 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(anonymous()), 'posts/public-post')));
    });

    test('같은 반 학생과 담당 교사는 학급 게시물을 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(studentA()), 'posts/class-post')));
      await assertSucceeds(getDoc(doc(db(teacherA()), 'posts/class-post')));
    });

    test('관리자는 학급 게시물을 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(admin()), 'posts/class-post')));
    });

    test('비로그인 사용자와 다른 반 사용자는 학급 게시물을 읽을 수 없다', async () => {
      await seed();
      await assertFails(getDoc(doc(db(anonymous()), 'posts/class-post')));
      await assertFails(getDoc(doc(db(studentB()), 'posts/class-post')));
      await assertFails(getDoc(doc(db(teacherB()), 'posts/class-post')));
    });
  });

  describe('게시물 생성', () => {
    test('학생은 자기 소유 공개 게시물을 만들 수 있다', async () => {
      await seed();
      await assertSucceeds(setDoc(doc(db(studentA()), 'posts/new-public'), post()));
    });

    test('학생은 자기 반 게시물을 만들 수 있다', async () => {
      await seed();
      await assertSucceeds(setDoc(doc(db(studentA()), 'posts/new-class'), post({
        categoryId: 'class-a',
        boardTeacherUid: 'teacher-a',
      })));
    });

    test('인증된 일반 사용자는 공개 게시물을 만들 수 있다', async () => {
      await seed();
      await assertSucceeds(setDoc(doc(db(verifiedUser()), 'posts/new-verified'), post({
        ownerUid: 'verified-user',
      })));
    });

    test('인증되지 않은 일반 사용자는 게시물을 만들 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(unverifiedUser()), 'posts/new-unverified'), post({
        ownerUid: 'unverified-user',
      })));
    });

    test('다른 반 학생은 학급 게시물을 만들 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentB()), 'posts/wrong-class'), post({
        ownerUid: 'student-b',
        categoryId: 'class-a',
        boardTeacherUid: 'teacher-a',
      })));
    });

    test('작성자 UID를 다른 사용자로 위조할 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/forged-owner'), post({
        ownerUid: 'student-b',
      })));
    });

    test('학급 게시판 소유 교사를 위조할 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/forged-board'), post({
        categoryId: 'class-a',
        boardTeacherUid: 'teacher-b',
      })));
    });

    test('허용되지 않은 필드가 있는 게시물은 만들 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/extra-field'), post({
        adminApproved: true,
      })));
    });

    test('공개 게시물에는 사진을 넣을 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/public-photo'), post({
        photo: 'data:image/png;base64,AA==',
      })));
    });

    test('제목과 코드 크기 제한을 강제한다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/long-title'), post({
        title: '가'.repeat(101),
      })));
      await assertFails(setDoc(doc(db(studentA()), 'posts/large-code'), post({
        code: { ...validCode, html: 'a'.repeat(150001) },
      })));
    });
  });

  describe('게시물 수정과 삭제', () => {
    test('작성자는 허용된 콘텐츠 필드를 수정할 수 있다', async () => {
      await seed();
      await assertSucceeds(updateDoc(doc(db(studentA()), 'posts/public-post'), {
        title: '고친 제목',
        updatedAt: NOW,
      }));
    });

    test('다른 사용자는 게시물을 수정할 수 없다', async () => {
      await seed();
      await assertFails(updateDoc(doc(db(studentB()), 'posts/public-post'), {
        title: '가로챈 제목',
      }));
    });

    test('작성자도 소유자와 카운터를 변경할 수 없다', async () => {
      await seed();
      await assertFails(updateDoc(doc(db(studentA()), 'posts/public-post'), {
        ownerUid: 'student-b',
      }));
      await assertFails(updateDoc(doc(db(studentA()), 'posts/public-post'), {
        likeCount: 999,
      }));
    });

    test('관리자는 게시물을 수정하고 직접 삭제할 수 있다', async () => {
      await seed();
      await assertSucceeds(updateDoc(doc(db(admin()), 'posts/public-post'), {
        title: '관리자 수정',
      }));
      await assertSucceeds(deleteDoc(doc(db(admin()), 'posts/public-post')));
    });

    test('작성자는 클라이언트에서 게시물을 직접 삭제할 수 없다', async () => {
      await seed();
      await assertFails(deleteDoc(doc(db(studentA()), 'posts/public-post')));
    });
  });

  describe('프로필과 역할 문서', () => {
    test('사용자는 자기 프로필만 만들 수 있다', async () => {
      await assertSucceeds(setDoc(doc(db(studentA()), 'users/student-a'), {
        nickname: '새별명',
        nicknameUpdatedAt: serverTimestamp(),
      }));
      await assertFails(setDoc(doc(db(studentA()), 'users/student-b'), {
        nickname: '가짜별명',
        nicknameUpdatedAt: serverTimestamp(),
      }));
    });

    test('학생 문서는 본인과 관리자만 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(studentA()), 'students/student-a')));
      await assertSucceeds(getDoc(doc(db(admin()), 'students/student-a')));
      await assertFails(getDoc(doc(db(studentB()), 'students/student-a')));
      await assertFails(getDoc(doc(db(teacherA()), 'students/student-a')));
    });

    test('교사 문서는 본인과 관리자만 읽을 수 있다', async () => {
      await seed();
      await assertSucceeds(getDoc(doc(db(teacherA()), 'teachers/teacher-a')));
      await assertSucceeds(getDoc(doc(db(admin()), 'teachers/teacher-a')));
      await assertFails(getDoc(doc(db(studentA()), 'teachers/teacher-a')));
    });

    test('역할 문서는 관리자만 쓸 수 있다', async () => {
      await seed();
      await assertFails(updateDoc(doc(db(studentA()), 'students/student-a'), {
        limitValue: 999,
      }));
      await assertFails(updateDoc(doc(db(teacherA()), 'teachers/teacher-a'), {
        totalLimit: 999,
      }));
      await assertSucceeds(updateDoc(doc(db(admin()), 'students/student-a'), {
        limitValue: 20,
      }));
    });
  });

  describe('신고와 서버 전용 데이터', () => {
    test('로그인 사용자는 대상 소유자가 일치하는 신고를 만들 수 있다', async () => {
      await seed();
      await assertSucceeds(setDoc(doc(db(studentB()), 'reports/public-post_student-b'), {
        postId: 'public-post',
        postTitle: '테스트 작품',
        postAuthorName: '학생A',
        postOwnerUid: 'student-a',
        reporterUid: 'student-b',
        reason: '기타',
        memo: '확인이 필요해요.',
        createdAt: NOW,
      }));
    });

    test('신고자나 게시물 소유자를 위조할 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentB()), 'reports/public-post_student-b'), {
        postId: 'public-post',
        postTitle: '테스트 작품',
        postAuthorName: '학생A',
        postOwnerUid: 'student-b',
        reporterUid: 'student-b',
        reason: '기타',
        createdAt: NOW,
      }));
      await assertFails(setDoc(doc(db(studentB()), 'reports/public-post_student-a'), {
        postId: 'public-post',
        postTitle: '테스트 작품',
        postAuthorName: '학생A',
        postOwnerUid: 'student-a',
        reporterUid: 'student-a',
        reason: '기타',
        createdAt: NOW,
      }));
    });

    test('신고는 관리자만 읽고 삭제할 수 있다', async () => {
      await seed();
      await env.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'reports/report-1'), {
          postId: 'public-post',
          reporterUid: 'student-b',
        });
      });
      await assertFails(getDoc(doc(db(studentB()), 'reports/report-1')));
      await assertSucceeds(getDoc(doc(db(admin()), 'reports/report-1')));
      await assertFails(deleteDoc(doc(db(studentB()), 'reports/report-1')));
      await assertSucceeds(deleteDoc(doc(db(admin()), 'reports/report-1')));
    });

    test('usage와 exemplars는 관리자도 클라이언트에서 접근할 수 없다', async () => {
      await assertFails(getDoc(doc(db(admin()), 'usage/admin_2026-09-30')));
      await assertFails(setDoc(doc(db(admin()), 'usage/admin_2026-09-30'), { count: 1 }));
      await assertFails(getDoc(doc(db(admin()), 'exemplars/example-1')));
      await assertFails(setDoc(doc(db(admin()), 'exemplars/example-1'), { title: '예시' }));
    });

    test('좋아요와 조회수 서브문서는 클라이언트에서 쓸 수 없다', async () => {
      await seed();
      await assertFails(setDoc(doc(db(studentA()), 'posts/public-post/likes/student-a'), {
        createdAt: NOW,
      }));
      await assertFails(setDoc(doc(db(admin()), 'posts/public-post/views/admin'), {
        createdAt: NOW,
      }));
    });
  });
});
