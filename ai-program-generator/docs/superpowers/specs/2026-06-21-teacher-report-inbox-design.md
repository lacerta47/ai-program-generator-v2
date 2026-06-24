# 교사 신고 인박스 설계

작성일: 2026-06-21 · 상태: 승인 대기

## 목표
신고된 콘텐츠를 **우리 반 교사가 직접 처리**할 수 있게 한다. 현재 신고는 전역 관리자(`/admin/reports`)에게만 가는데, 교실의 모더레이터는 담당 교사다. 교사가 `/teacher`에서 자기 반 학생의 신고된 작품을 보고 삭제하거나 신고를 무시할 수 있게 한다. (1차 검열은 제목·닉네임 클라 필터로 충분, 그 이상은 신고로 대처 — 이번이 그 신고 경로.)

## 결정 사항 (브레인스토밍 확정)
- **범위**: 교사의 신고 = `reports` 중 `postOwnerUid`가 **내 산하 학생**(students where teacherUid==me)인 것. 누가 신고했든 무관 — 내 학생 작품이면 표시.
- 관리자는 기존대로 **전체 신고**(`/admin/reports`) — 변경 없음. 교사는 부분집합.
- 교사 권한: 신고 무시 + **작품 삭제**까지 허용(반의 모더레이터).
- UI: `/teacher` 콘솔에 "신고" 섹션(별도 페이지 안 만듦).
- firestore.rules 변경 없음(전부 서버 Admin SDK 경유, reports 읽기/삭제는 이미 admin-only지만 서버는 우회).

## 아키텍처

### 1) 서버 API (`requireTeacher`, 본인 학생 소유 검증)
- **`GET /api/teacher/reports`**:
  1. requireTeacher → uid.
  2. `students` where `teacherUid == uid` → `studentUids` 집합.
  3. `reports` 전체 조회 후 `postOwnerUid ∈ studentUids`만 필터(교실 규모=신고 소수라 OK; 대규모 최적화는 후속). 같은 `postId`끼리 묶음.
  4. 반환 `{ reports: [{ postId, postTitle, postAuthorName, postOwnerUid, items: [{ reason, memo?, createdAt }] }] }`(글별 그룹, 신고 많은 순).
- **`DELETE /api/teacher/reports/[postId]`** (무시 + 선택적 글삭제): 본문 `{ deletePost?: boolean }`.
  1. requireTeacher → uid. `studentUids` 구함.
  2. 해당 `postId`의 reports 조회(`where postId == postId`). **그 중 하나라도 `postOwnerUid ∈ studentUids`가 아니면 403**(내 반 신고 아님). (글이 이미 삭제됐어도 report의 postOwnerUid로 권한 판정 — report가 인박스 범위의 source of truth.)
  3. `deletePost === true`면 `posts/{postId}` 삭제.
  4. 그 `postId`의 reports를 배치 삭제(무시).
  5. `{ ok: true }`.
- 클라 헬퍼 `lib/teacher/reports.ts`: `listTeacherReports()`, `dismissReportedPost(postId)`(deletePost=false), `deleteReportedPost(postId)`(deletePost=true).

### 2) UI — `/teacher` 콘솔 "신고" 섹션
- `Console`에 신고 상태 추가: `reload()`에서 `listTeacherReports()`도 호출.
- 렌더: 신고가 있을 때만 **콘솔 상단**(풀 사용량 아래, 학생 발급 폼 위)에 "신고 N건" 섹션. 글별 카드:
  - 제목 · 작성자명 · 신고 N건.
  - 사유 목록(reason + memo + 날짜).
  - 버튼: **[작품 보기]**(`/board?post=<id>` 새 탭) · **[작품 삭제]**(ConfirmDialog → `deleteReportedPost`) · **[신고 무시]**(`dismissReportedPost`).
  - 처리 후 `reload()`.
- 신고 0건이면 섹션 자체를 렌더 안 함(평소엔 안 보이게).
- 기존 `components/ui` 프리미티브·`useConfirm`·`useToast` 사용.

## 데이터 흐름
교사 `/teacher` 진입 → `GET /api/teacher/reports`(내 학생 신고) → 카드. [삭제]/[무시] → `DELETE /api/teacher/reports/[postId]`(소유 검증) → 글/신고 정리 → reload. 관리자 `/admin/reports`는 전체를 계속 봄(이중 안전망).

## 에러 처리 / 엣지
- 타 교사 학생의 postId로 DELETE 시도 → 403(report.postOwnerUid ∈ 내 학생 아님).
- 이미 삭제된 글의 신고 무시 → 글 삭제는 건너뛰고 reports만 정리(정상).
- 신고된 글이 내 학생 것이지만 내 게시판이 아닌 경우(categoryId 위조 등)에도 **소유(postOwnerUid) 기준**이라 인박스에 잡히고 처리 가능(게시판-기준이 아닌 이유).
- reports 전체 읽고 필터 → 신고 컬렉션은 작아 무해. 대규모 시 `postOwnerUid in` 청크 쿼리로 후속 최적화(관리자 신고와 동일 한계).

## 검증
- `tsc --noEmit` + 프로덕션 빌드.
- **self-test** `scripts/selftest-teacher-reports.mjs`(미커밋):
  1. 선생님2 + 각자 학생1 시드, 학생 글 + 그 글 신고 시드.
  2. 교사1 `GET /api/teacher/reports` → 자기 학생 신고만 보임(교사2 학생 신고 안 보임).
  3. 교사2가 교사1 학생 글 `DELETE` 시도 → 403.
  4. 교사1 `DELETE`(deletePost=false) → 신고만 삭제, 글 유지.
  5. 교사1 `DELETE`(deletePost=true) → 글 + 신고 삭제 확인.
- 브라우저(Chrome 연결 시): 교사 콘솔에 신고 카드·삭제·무시.

## 영향 파일
- 신규: `app/api/teacher/reports/route.ts`(GET), `app/api/teacher/reports/[postId]/route.ts`(DELETE), `lib/teacher/reports.ts`, `scripts/selftest-teacher-reports.mjs`(미커밋).
- 수정: `app/teacher/page.tsx`(신고 섹션 + reload).

## 범위 밖
신고 알림(푸시/메일), 학생별 신고 통계, 신고 사유 커스터마이즈, reports 페이지네이션(관리자 포함 후속).
