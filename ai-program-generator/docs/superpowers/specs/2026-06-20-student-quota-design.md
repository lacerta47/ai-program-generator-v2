# 학생 계정 + 한도 + 공유 풀 차감 (C1) 설계

작성일: 2026-06-20 · 상태: 승인 대기 · 분해: A·B 완료 → **C1(학생/한도/풀)** → C2(선생님 게시판)

## 목표
선생님이 **학생 계정을 반 단위 배치로 발급**하고 학생별 한도(1일/총)를 설정하면, 학생이 일반 앱(만들기·게시판)을 그대로 쓰되 **자기 한도 + 선생님 공유 풀**에 제약된다. 생성 시 선생님 풀과 학생 카운터를 트랜잭션으로 차감하고, 풀/캡 소진 시 정지. 선생님 게시판은 **C2**(범위 밖).

## 결정 사항 (브레인스토밍 확정)
- **학생 발급 = 반 단위 배치**(선생님이 반이름·인원·공용비번·기본한도로 일괄 생성). `prefix-01@class.kr … -NN`.
- **학생 경험 = 일반 앱 그대로**(전용 콘솔 없음). `isStudent`는 이메일 면제 + 카운팅 + 남은 한도 표시에만 영향.
- **한도 = 공유 풀**(B 확정): 학생의 모든 생성이 선생님 `totalQuota` 풀에서 차감(1일형·총형 무관). 풀 0이면 반 전체 정지. 학생 개별 한도(1일 X/일 또는 총 Y)는 그 위의 per-학생 상한.
- 선생님 본인·admin은 풀 무관(면제, B와 동일).

## 데이터 모델
- **claim** `{ student: true }`. 세부(소속·한도)는 문서에 둠(즉시 반영, claim 갱신 불필요).
- **`students/{uid}`**: `{ teacherUid: string, name: string, limitType: 'daily'|'total', limitValue: number, usedTotal: number, createdAt: number }`.
  - `usedTotal` = 누적 소진(총형 캡 판정 + 기록용. 1일형 학생도 증가시켜 누적 추적).
- **카운터**:
  - 1일형 캡 = 기존 `usage/{uid}_{day}.count`(KST 자정 리셋) 재사용.
  - 총형 캡 = `students/{uid}.usedTotal`.
  - 선생님 풀 소진 = `teachers/{uid}.usedTotal`(B엔 `totalQuota` cap만 있었음; 여기서 소진량 필드 추가).
- **`firestore.rules`** `students/{uid}`: 읽기 = 본인 `isOwner(uid)` 또는 `isAdmin()`(소속 선생님 읽기는 서버 API 경유라 클라 규칙 불필요), 쓰기 = `isAdmin()`(서버 Admin SDK 전용). categories/posts 등 기존 규칙 불변. 배포 필요.

## 아키텍처

### 1) 역할 노출 + UI 면제 (학생)
- **`AuthProvider`**: `isStudent`(claims.student) 추가 노출(기존 isAdmin·isTeacher 옆).
- **UI 면제 3곳에 `!isStudent` 추가**(B에서 `!isTeacher` 넣은 자리): `AuthButton` '인증 필요' 칩, `mypage` 인증 배너, `UploadDialog` 업로드 전 차단. → 발급 학생 계정(@class.kr 미인증)도 통과.

### 2) 선생님 — 학생 발급/관리 API (`requireTeacher`, 본인 산하만)
- **`POST /api/teacher/students`**: `{ prefix, count, password, limitType, limitValue }`.
  - 검증: `prefix` `^[a-z0-9-]+$`, `count` 1~50 정수, `password`≥6, `limitType ∈ {daily,total}`, `limitValue` 1 이상 정수.
  - `i=1..count`: `email=${prefix}-${pad2(i)}@class.kr` → `createUser` → `setCustomUserClaims{student:true}` → `students/{uid}` set `{ teacherUid: caller.uid, name: '${prefix}-${pad2(i)}', limitType, limitValue, usedTotal: 0, createdAt }`. 중복 이메일은 skip.
  - 반환 `{ created: [{email,password}], skipped: [{email,reason}] }`.
- **`GET /api/teacher/students`**: 본인 산하 학생 목록(`students` where teacherUid==caller.uid) — `{ uid, email, name, limitType, limitValue, usedTotal, disabled }[]`. (email/disabled는 `adminAuth.getUser`로 병합 — 학생 수 소규모, 병렬 읽기.)
- **`PATCH /api/teacher/students/[uid]`**: `{ name?, limitType?, limitValue?, disabled? }`. **소유권 검증**: `students/{uid}.teacherUid == caller.uid` 아니면 403. limit 필드는 `students/{uid}` 갱신, disabled는 `updateUser`.
- **`DELETE /api/teacher/students/[uid]`**: 소유권 검증 후 `deleteAccountCascade(uid)`(이미 students/{uid} 삭제 포함).
- 클라 헬퍼 `lib/teacher/students.ts`(authed fetch; B의 `lib/admin/teachers.ts` 패턴).

### 3) 생성 + 풀 차감 (`/api/generate` 트랜잭션 확장 — 핵심)
토큰 디코드에 이미 `isStudent` 있음. 한도 선점부(현재 `if (!isAdmin && !isTeacher) { 일일 트랜잭션 }`)를 **분기**:
- **학생(`isStudent`)**: `students/{uid}` + `teachers/{teacherUid}`를 한 트랜잭션에서 읽고(모든 read를 write보다 먼저):
  1. **풀 체크**: `(teacher.usedTotal ?? 0) >= teacher.totalQuota` → `{ok:false, reason:'pool'}`.
  2. **학생 캡 체크**: `total`형 `(student.usedTotal ?? 0) >= limitValue`; `daily`형은 `usage/{uid}_{day}.count >= limitValue`(usageRef도 트랜잭션 read).
     초과면 `{ok:false, reason:'cap'}`.
  3. 통과 시 **증가**: `teacher.usedTotal += 1`, `student.usedTotal += 1`(항상), `daily`형이면 `usage` count += 1.
  - 실패 응답: `pool` → 429 "선생님이 정한 우리 반 한도를 다 썼어요.", `cap`(daily) → 429 "오늘 만들 수 있는 횟수를 다 썼어요. 내일 다시 해요!", `cap`(total) → 429 "만들 수 있는 횟수를 다 썼어요."
  - `students/{uid}`/`teachers/{teacherUid}` 문서가 없으면(비정상) 500 처리.
- **일반 회원**: 기존 일일 트랜잭션 그대로(`!isAdmin && !isTeacher && !isStudent`).
- **환불**(생성 실패·취소): 학생이면 `teacher.usedTotal -= 1`, `student.usedTotal -= 1`, daily형이면 usage count -= 1(모두 `Math.max(0, …)`); 일반 회원은 기존 `refundQuota(usageRef)`. admin/teacher는 환불 없음(차감도 없음).
- 트랜잭션·환불 로직은 `lib/server/studentQuota.ts`로 분리(생성 라우트가 비대해지지 않게): `reserveStudentQuota(uid)` / `refundStudentQuota(uid)` 익스포트.

### 4) 학생 남은 한도 표시 (`/api/me/usage` 확장)
- 학생이면 `students/{uid}` 읽어: `daily` → `{ used: 오늘 count, limit: limitValue, unlimited:false, kind:'daily' }`; `total` → `{ used: usedTotal, limit: limitValue, unlimited:false, kind:'total' }`.
- 일반/관리자는 기존 응답(관리자 unlimited, 일반 daily). `kind`는 옵셔널(클라 라벨용).
- **마이페이지**: "오늘 사용 X/Y"를 `kind`에 맞게 — `total`이면 "사용 used/cap"로 라벨. (작은 변경.)

### 5) 선생님 콘솔 (`/teacher` 확장)
B의 셸을 실제 콘솔로:
- **풀 사용량**: `사용 {teacher.usedTotal}/{totalQuota}` 표시(`/api/teacher/me`에 usedTotal 추가).
- **학생 발급 폼**: 반이름(prefix)·인원수·공용비번·한도종류(1일/총 select)·한도값 → 생성 결과(아이디 목록·공용비번 배포 안내).
- **학생 명단**: 이름·이메일·한도(종류+값)·사용량. per-학생: 한도 수정(prompt 또는 간단 폼)·삭제. 정지(disabled) 토글은 선택.
- 기존 `components/ui` 프리미티브만.

## 데이터 흐름
발급: 선생님 `/teacher` → `POST /api/teacher/students`(배치) → createUser+claim+students doc → 아이디/비번 배포. 사용: 학생 로그인 → 일반 앱에서 생성 → `/api/generate`가 풀+학생캡 트랜잭션 차감 → 소진 시 429. 표시: 마이페이지·/teacher에서 남은 한도/풀.

## 에러 처리 / 엣지
- 소유권: 선생님은 본인 산하 학생만 PATCH/DELETE(teacherUid 검증). 타 선생님 학생 → 403.
- 풀 음수 방지: 환불 `Math.max(0, x-1)`.
- 한도 즉시 반영: 한도는 `students` 문서에서 매 생성 읽음 → 선생님이 바꾸면 바로 적용(claim 갱신 불필요).
- 선생님 삭제 시 산하 학생: 본 spec은 학생 개별 삭제만. 선생님 삭제 시 학생 일괄 처리 정책은 별도(현재 `deleteAccountCascade`는 해당 선생님 문서만 지움 — 산하 학생은 남음). C2/후속에서 다룸(여기선 명시만).
- `teachers/{uid}.usedTotal` 단일문서 카운터 = 교실 규모 OK, 대규모 시 재검토(count-hotspot).

## 검증
- `tsc` + 프로덕션 빌드 + 규칙 배포.
- **self-test** `scripts/selftest-student.mjs`(미커밋):
  1. 선생님 토큰 → `POST /api/teacher/students`(count=2, daily, limitValue 작게) 200, students 2개 생성·claim·teacherUid 확인.
  2. 타 선생님 토큰 → 그 학생 PATCH → 403(소유권).
  3. 학생 토큰 → `/api/generate` `{}` → 400(게이트 면제 통과, 입력검증서 멈춤). 미인증 일반 → 403(대조).
  4. 한도 트랜잭션: `reserveStudentQuota` 단위로 — 학생 daily limit=1 설정 후 풀/캡 차감·정지를 Admin SDK로 직접 호출 검증(생성 본물 호출은 Gemini 비용이라 트랜잭션 함수 단위로). 또는 teacher.totalQuota=1로 두고 풀 소진 → 다음 reserve가 pool 거부 확인.
  5. 학생 → `DELETE /api/me` 403. (발급 계정은 본인 탈퇴 불가로 통일 — `/api/me`의 admin·teacher 차단에 `|| decoded.student === true` 추가. 메시지 "이 계정은 탈퇴할 수 없어요.")
  6. 선생님 → 학생 삭제 200 + students 문서·Auth 삭제 확인.

## 영향 파일
- 신규: `app/api/teacher/students/route.ts`(GET·POST), `app/api/teacher/students/[uid]/route.ts`(PATCH·DELETE), `lib/teacher/students.ts`, `lib/server/studentQuota.ts`(reserve/refund), `scripts/selftest-student.mjs`(미커밋).
- 수정: `app/api/generate/route.ts`(학생 분기 트랜잭션·환불 — studentQuota 헬퍼 호출), `app/api/me/usage/route.ts`(학생 한도 표시), `app/api/me/route.ts`(학생 탈퇴 차단), `app/api/teacher/me/route.ts`(usedTotal 추가), `components/auth/AuthProvider.tsx`(isStudent), `components/auth/AuthButton.tsx`·`app/mypage/page.tsx`·`components/board/UploadDialog.tsx`(`!isStudent` 면제), `app/teacher/page.tsx`(콘솔: 풀·발급폼·명단), `firestore.rules`(students/{uid}; 배포).

## 범위 밖 (C2)
선생님 이름=게시판 자동 생성 + 선생님이 그 게시판 관리(선생님 소유 카테고리 개념). 선생님 삭제 시 산하 학생 일괄 처리.
