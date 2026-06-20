# 선생님 역할 체계 (B) 설계

작성일: 2026-06-20 · 상태: 승인 대기 · 분해: A(회원탈퇴 완료) → **B(선생님 역할)** → C(학생/한도분배/게시판)

## 목표
관리자가 **선생님(teacher) 계정을 발급·관리**하고, 발급된 선생님이 로그인해 만들기/게시판을 쓸 수 있게 한다(이메일 인증 면제). 선생님이 실제로 *학생을 관리/한도 분배/게시판 운영*하는 기능은 C에서 채운다 — B는 **관리자↔선생님**까지의 토대 + `/teacher` 셸.

## 결정 사항 (브레인스토밍 확정)
- **선생님 계정 = 발급형**: 관리자가 Admin SDK로 생성, `teacher` custom claim 부여. 기존 `@class.kr` 발급 인프라(`/api/admin/accounts`) 패턴 확장.
- **역할 저장 = custom claim** `{ teacher: true }`(admin과 동일 패턴). C에서 `{ student: true }` 추가 예정.
- **콘솔 = 별도 `/teacher` 라우트**(teacher claim 가드). 선생님은 `/admin`을 아예 못 봄 → "신고·예시·다른 계정 생성 불가"가 구조적으로 강제됨.
- **한도 = 하향식 예산(상한)**: 관리자가 선생님 `totalLimit`(일일 예산 cap) 지정 → (C) 선생님이 학생에 분배, 불변식 **Σ(산하 학생 limit) ≤ teacher.totalLimit**.
- **이메일 인증 게이트 면제**: 발급 계정(teacher/student claim)은 `email_verified` 없이 생성·게시 통과(가짜 `@class.kr` 이메일이라).
- **가정(승인됨)**: 선생님 본인도 만들기 사용 가능하며 **일일 생성 한도 면제**(신뢰 스태프, admin처럼). `totalLimit`은 어디까지나 *학생 예산*이지 선생님 본인 생성량이 아님. 모든 한도는 **일일**(KST 자정 리셋, 기존과 동일).
- **선생님 회원탈퇴 차단**: 관리자처럼 본인 탈퇴 불가.

## 데이터 모델 (B·C 공통 토대)
- **claims**: `admin`(기존), **`teacher: true`**(B), `student: true`(C).
- **`teachers/{uid}`**: `{ name: string(표시명, 나중에 게시판 이름), totalLimit: number(일일 예산 cap), createdAt: number }`. rules: 읽기 = 본인 또는 admin, 쓰기 = admin 전용.
- **(C 예정) `students/{uid}`**: `{ teacherUid, name, limit }`. 본 spec 범위 밖.
- **한도 저장**: 기존 `limits/{uid}`(서버 Admin SDK 전용, `/api/generate`가 읽는 일일 오버라이드) 재사용. 학생 limit은 C에서 `limits/{studentUid}`에 기록. teacher 본인은 한도 면제라 `limits` 미사용.

## 아키텍처 (B 범위)

### 1) 역할 가드 — `lib/admin/requireTeacher.ts`
`requireAdmin`을 미러링. Bearer 토큰 검증 후 `decoded.teacher === true` 아니면 403. (admin은 통과시키지 않음 — `/teacher`는 선생님 전용. admin은 `/admin` 사용.)

### 2) 이메일 게이트 면제
- **`app/api/generate/route.ts`**: 토큰 디코드부에 `isTeacher = decoded.teacher === true`, `isStudent = decoded.student === true` 추가. 게이트(현재 line 45)를 `if (!isAdmin && !isTeacher && !isStudent && !emailVerified)`로 변경. 또한 본인 생성 **무제한 판정에 teacher 포함**(현재 admin만 unlimited인 곳에 `|| isTeacher` — 해당 트랜잭션 분기). student는 무제한 아님(C에서 limit 적용).
- **`firestore.rules`**: 헬퍼 `isRoleAccount()` 추가 = `isSignedIn() && (request.auth.token.teacher == true || request.auth.token.student == true)`. posts `create`/`update`의 쓰기 자격을 `(isAdmin() || isVerified() || isRoleAccount())`로 확장. (배포 필요.)

### 3) 관리자 선생님 발급/관리 API
- **`GET /api/admin/teachers`**(`requireAdmin`): teacher claim 사용자 목록. 각 항목 `{ uid, email, name, totalLimit, disabled }`. 구현: `adminAuth.listUsers()` 순회하며 `customClaims.teacher===true`만, `teachers/{uid}`에서 name·totalLimit 병합. (선생님 수는 소규모라 listUsers 1페이지로 충분; >1000이면 페이지네이션은 C 이후 과제.)
- **`POST /api/admin/teachers`**(`requireAdmin`): body `{ loginId, password, name, totalLimit }`.
  - 검증: `loginId` `^[a-z0-9-]+$`, `password.length>=6`, `name` 1~20자, `totalLimit` 0 이상 정수.
  - `email = ${loginId}@class.kr`. `adminAuth.createUser({ email, password })` → `setCustomUserClaims(uid, { teacher: true })` → `teachers/{uid}` set `{ name, totalLimit, createdAt }`.
  - 반환 `{ uid, email, password }`. `auth/email-already-exists`면 409.
- **`PATCH /api/admin/teachers/[uid]`**(`requireAdmin`): `{ totalLimit?, disabled? }`. 대상이 teacher claim인지 확인(아니면 400). `totalLimit`이면 `teachers/{uid}` 갱신, `disabled`면 `adminAuth.updateUser(uid,{disabled})`.
- **`DELETE /api/admin/teachers/[uid]`**(`requireAdmin`): `deleteAccountCascade(uid)` 사용. **A의 헬퍼를 확장** — `teachers/${uid}`, `students/${uid}`(C 대비) ref도 삭제 목록에 추가(없으면 무해). (C에서 산하 학생 처리 정책은 별도; B 단계의 선생님은 산하 학생이 없음.)

클라 헬퍼 `lib/admin/teachers.ts`: `listTeachers()`, `createTeacher(body)`, `patchTeacher(uid, body)`, `deleteTeacher(uid)` — 기존 `lib/admin/accounts.ts`의 `authedFetch` 패턴 재사용.

### 4) 관리자 UI — `/admin/teachers`
`/admin`에 "선생님 관리" 진입. 페이지(isAdmin 가드): 선생님 생성 폼(아이디·비번·표시명·총 한도) + 생성 결과(아이디/비번 안내, 배포용) + 선생님 목록(표시명·이메일·총한도, 총한도 수정·정지·삭제). 기존 `components/ui` 프리미티브만 사용.

### 5) `/teacher` 셸
- **`app/teacher/page.tsx`**(클라, teacher claim 가드 — 아니면 홈으로). 표시: 선생님 표시명·총 한도 + "내 반 관리(준비 중)" 플레이스홀더. 학생/게시판 기능은 C.
- **`AuthProvider` 확장**: `isTeacher`(claims.teacher) 노출(기존 `isAdmin` 옆). `/teacher` 가드·헤더 분기에 사용.
- 데이터: 선생님 본인 정보는 `GET /api/teacher/me`(`requireTeacher`) — `teachers/{uid}` 반환. (또는 rules가 본인 읽기 허용하므로 클라가 직접 읽어도 됨. **API 경유로 통일** — claim 면제·서버 권위 일관.)

### 6) 회원탈퇴 차단 확장
- **`app/api/me/route.ts`**: 현재 `decoded.admin === true`만 403. **`|| decoded.teacher === true` 추가**(선생님도 본인 탈퇴 불가). 메시지 "선생님 계정은 탈퇴할 수 없어요."
- 마이페이지 버튼 숨김: `AccountCard`의 `!isAdmin` 조건을 `!isAdmin && !isTeacher`로(둘 다 숨김).

## 데이터 흐름
- 발급: 관리자 `/admin/teachers` → `POST /api/admin/teachers` → createUser+claim+teachers doc → 아이디/비번 표시 → 배포.
- 사용: 선생님 로그인(발급 비번) → claim 면제로 `/api/generate`·게시 가능 → `/teacher`에서 본인 정보·한도 확인(현재 셸).

## 에러 처리 / 엣지
- claim 반영 지연: setCustomUserClaims는 **다음 로그인/토큰 갱신** 시 반영. 발급 직후 첫 로그인이면 정상 적용.
- totalLimit를 현재 Σ학생보다 낮추는 충돌은 **C**에서(학생 분배 시 검증). B엔 학생이 없어 무관.
- 대상이 teacher가 아닌 uid에 teacher PATCH/DELETE → 400/적절 처리.
- `deleteAccountCascade` 확장은 A의 기존 동작(일반/관리자 삭제)에 영향 없음(없는 ref 삭제는 무해).

## 검증
- `tsc --noEmit` + 프로덕션 빌드.
- **self-test** `scripts/selftest-teacher.mjs`(미커밋):
  1. 비관리자 토큰 → `POST /api/admin/teachers` 403.
  2. 관리자 토큰 → 선생님 생성 200(+`teachers/{uid}`·claim 확인).
  3. 생성된 선생님 토큰(이메일 미인증) → `POST /api/generate`에 **본문 `{}`**(prompt 없음) 전송 → **400** 기대. Gemini를 부르지 않고도 검증: 이메일 게이트(line 45, 403)는 입력 검증(line 52+, 400)보다 앞이므로, 면제 안 됐으면 403, 면제됐으면 400이 나온다. 즉 "403이 아니라 400"이면 게이트 면제 통과. (대조군: 미인증 일반 토큰 + `{}` → 403.)
  4. 선생님 토큰 → `DELETE /api/me` 403(탈퇴 차단).
  5. 관리자 → `DELETE /api/admin/teachers/{uid}` → Auth·`teachers/{uid}` 삭제 확인.
- 규칙: 배포 후 발급 계정 posts 생성 허용 확인(self-test에 Firestore REST create 포함).
- 브라우저: 관리자 `/admin/teachers` 생성·목록, 선생님 로그인 후 `/teacher` 셸 — Chrome 연결 시.

## 영향 파일
- 신규: `lib/admin/requireTeacher.ts`, `app/api/admin/teachers/route.ts`, `app/api/admin/teachers/[uid]/route.ts`, `app/api/teacher/me/route.ts`, `lib/admin/teachers.ts`, `app/admin/teachers/page.tsx`, `app/teacher/page.tsx`, `scripts/selftest-teacher.mjs`(미커밋).
- 수정: `app/api/generate/route.ts`(teacher/student 게이트 면제 + teacher unlimited), `firestore.rules`(isRoleAccount + posts 쓰기 자격; 배포), `lib/server/deleteAccount.ts`(teachers/students ref 추가), `app/api/me/route.ts`(teacher 탈퇴 차단), `components/auth/AuthProvider.tsx`(isTeacher 노출), `app/mypage/page.tsx`(teacher도 탈퇴 버튼 숨김), `app/admin/page.tsx`(선생님 관리 진입).

## 범위 밖 (C)
선생님이 학생 계정 발급, 학생별 한도 분배(Σ≤cap 검증 UI), 선생님 이름=게시판 자동 생성 + 그 게시판 관리, 학생 콘솔.
