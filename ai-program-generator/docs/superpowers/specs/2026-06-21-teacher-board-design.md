# 선생님 게시판 (C2) 설계

작성일: 2026-06-21 · 상태: 승인 대기 · 분해: A·B·C1 완료 → **C2(선생님 게시판, 마지막)**

## 목표
각 선생님에게 자기 이름의 게시판(카테고리)을 주고, 학생이 작품을 올리면 **자동으로 자기 선생님 게시판**에 들어가며, 선생님이 그 게시판의 글을 보고 **부적절한 글을 삭제(모더레이션)**할 수 있게 한다. 이로써 역할 체계(A→B→C) 완성.

## 결정 사항 (브레인스토밍 확정)
- **학생 글 귀속 = 자기 선생님 게시판으로 자동**(학생은 카테고리 선택 없음).
- **선생님 삭제 = 계정만**(게시판·학생·작품은 남김; 고아 데이터는 관리자 수동 정리). C2에 추가 캐스케이드 없음.
- 선생님 게시판은 **공개 카테고리**(누구나 /board에서 봄). 선생님이 모더레이션.
- 이름 변경은 범위 밖(YAGNI) — 게시판 이름 = `teachers/{uid}.name` 고정.

## 데이터 모델
- **`categories/{id}`에 옵셔널 `teacherUid` 추가**(소유 선생님 표시). `Category` 타입에 `teacherUid?: string`.
- **`teachers/{uid}.boardId`** — 그 선생님의 게시판 카테고리 id 캐시(ensureTeacherBoard가 채움).
- posts는 기존대로 `categoryId`로 소속(스키마 불변).

## 아키텍처

### 1) 게시판 보장 헬퍼 — `lib/server/teacherBoard.ts`
```
ensureTeacherBoard(teacherUid): Promise<{ boardId, boardName }>
```
- `teachers/{teacherUid}` 읽기. `boardId`가 있고 그 카테고리 문서가 실재하면 그대로 반환.
- 없으면 `categories`에 생성: `{ name: teacher.name(없으면 '우리 반'), order: Date.now(), createdAt: Date.now(), teacherUid }`(root 카테고리, parentId 생략) → 새 id를 `teachers/{teacherUid}.boardId`에 merge 저장 → 반환.
- **멱등**: 기존 선생님도 처음 호출 시 자동 생성(소급 마이그레이션 불필요). 서버 Admin SDK라 규칙 우회.

### 2) 학생 업로드 자동 라우팅
- **`GET /api/student/board`**(student 토큰 검증; admin/teacher 아님): `students/{uid}.teacherUid` → `ensureTeacherBoard` → `{ boardId, boardName }`. student claim 없으면 403.
  - 클라 헬퍼 `lib/student/board.ts` `getMyBoard()`.
- **`components/board/UploadDialog.tsx`**: `useAuth().isStudent`이면
  - 열릴 때 `getMyBoard()` 호출 → `categoryId`를 boardId로 고정.
  - **카테고리 선택 UI를 숨기고** "우리 반 게시판(<boardName>)에 올라가요" 안내로 대체.
  - 제출 검증의 "게시판을 골라 주세요"는 학생일 땐 boardId 확보 실패 시 에러로.
  - 비학생은 기존 흐름 100% 유지.

### 3) 선생님 모더레이션
- **`GET /api/teacher/posts`**(requireTeacher): `ensureTeacherBoard` → 본인 boardId의 posts 조회(`where categoryId == boardId`, createdAt desc) → `{ board: {id,name}, posts: [{id,title,authorName,createdAt}] }`.
- **`DELETE /api/teacher/posts/[id]`**(requireTeacher): 대상 post 읽어 `post.categoryId === 본인 boardId`가 아니면 403, 맞으면 `posts/{id}` 삭제(Admin SDK). likes/views 서브문서 잔여는 기존 삭제와 동일(무해).
  - 클라 헬퍼 `lib/teacher/posts.ts` `listBoardPosts()`, `deleteBoardPost(id)`.
- **`/teacher` 콘솔에 "우리 반 게시판" 섹션**: 글 목록(제목·작성자·날짜) + 각 글 삭제 버튼(ConfirmDialog). 비어 있으면 "아직 올라온 작품이 없어요."

### 4) 타입/규칙
- `Category`에 `teacherUid?: string` 추가. 어드민 카테고리 화면은 이 필드를 무시(읽기만).
- **firestore.rules 변경 없음**: 게시판 생성·글 삭제는 전부 서버 Admin SDK(규칙 우회). categories는 여전히 클라 admin-only write(선생님 게시판도 서버가 만듦). posts 삭제 규칙(본인/admin)은 그대로 — 선생님 모더레이션은 서버 API 경유라 규칙과 무관.

## 데이터 흐름
- 학생 업로드: UploadDialog(학생) → `GET /api/student/board`(ensure) → categoryId 고정 → 기존 createPost(클라, isRoleAccount 규칙 통과). 
- 모더레이션: 선생님 `/teacher` → `GET /api/teacher/posts` → 삭제 버튼 → `DELETE /api/teacher/posts/[id]`(소유 검증) → 목록 새로고침.

## 에러 처리 / 엣지
- 학생인데 teacherUid/teacher 문서 비정상 → ensure 실패 → /api/student/board 500, UploadDialog는 "지금은 올릴 수 없어요" 안내(업로드 막음).
- 동시 ensure 경합(두 호출이 동시에 board 생성) → 드물게 카테고리 2개 생성 가능. 완화: ensure는 먼저 `teachers/{uid}.boardId` 확인 후 생성하고, 생성 직후 boardId 저장 — 교실 사용 빈도상 실질 무해(중복 시 관리자 수동 정리). 강한 원자성은 과설계(YAGNI).
- 선생님이 타 게시판 글 삭제 시도 → 403(categoryId 불일치).
- 선생님 삭제 후 남은 게시판: teacherUid가 가리키는 선생님이 없어도 게시판·글은 공개 유지(관리자 정리). 무해.

## 검증
- `tsc` + 프로덕션 빌드.
- **self-test** `scripts/selftest-teacher-board.mjs`(미커밋):
  1. 선생님 시드(claim+teachers doc). `GET /api/teacher/posts`(requireTeacher) → 200, board 생성됨(`teachers/{uid}.boardId` + categories 문서 존재) 확인.
  2. 학생 시드(그 선생님 산하). `GET /api/student/board` → 200, boardId가 선생님 board와 일치.
  3. 학생 board에 post 시드(Admin SDK) → `GET /api/teacher/posts` 목록에 포함.
  4. 타 선생님 토큰 → `DELETE /api/teacher/posts/{id}` → 403(소유 아님).
  5. 소유 선생님 → `DELETE /api/teacher/posts/{id}` → 200 + posts 문서 삭제 확인.
  6. 비학생(일반) 토큰 → `GET /api/student/board` → 403.
- 브라우저(Chrome 연결 시): 학생 업로드 시 카테고리 선택 숨김 + "우리 반 게시판" 안내, /teacher "우리 반 게시판"에서 삭제.

## 영향 파일
- 신규: `lib/server/teacherBoard.ts`(ensureTeacherBoard), `app/api/student/board/route.ts`, `app/api/teacher/posts/route.ts`(GET), `app/api/teacher/posts/[id]/route.ts`(DELETE), `lib/student/board.ts`, `lib/teacher/posts.ts`, `scripts/selftest-teacher-board.mjs`(미커밋).
- 수정: `lib/firebase/types.ts`(`Category.teacherUid?`), `components/board/UploadDialog.tsx`(학생 라우팅), `app/teacher/page.tsx`("우리 반 게시판" 섹션).

## 범위 밖
게시판 이름 변경 UI, 선생님 삭제 시 캐스케이드(계정만 삭제로 확정), 학생 글의 다중 게시판 선택.
