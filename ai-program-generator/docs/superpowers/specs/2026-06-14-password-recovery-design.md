# 비밀번호 복구 설계

작성일: 2026-06-14

## 배경 / 목표
비밀번호를 잊은 사용자가 다시 들어올 수 있게 한다. 계정이 두 종류라 경로가 갈린다 — **실제 이메일 가입자**는 자기서비스 이메일 재설정, **수업용 합성 계정**(`반-01@class.kr`, 메일 못 받음)은 교사가 관리자 콘솔에서 재설정. **둘 다** 만든다.

## 결정 사항(확정)
- 자기서비스(이메일) + 관리자(교사) 재설정 둘 다.
- 자기서비스는 Firebase `sendPasswordResetEmail`(클라 SDK, 백엔드·외부 메일서비스·추가요금 없음 — Spark 포함 무료).
- 관리자 재설정은 B-2의 기존 `PATCH /api/admin/users/[uid]` + `UserActionModal`에 얹는다.
- 비밀번호는 사용자/교사가 직접 정함(에이전트가 실제 비번 입력 안 함).

## Part 1 — 자기서비스 이메일 재설정 (`LoginDialog`)
- `firebase/auth`에서 `sendPasswordResetEmail` import.
- **로그인 모드**일 때 폼 아래 **"비밀번호를 잊으셨어요?"** 링크.
- 클릭 → 폼의 `email`로 `sendPasswordResetEmail(auth, email)`.
  - 이메일 비었으면 에러 안내 "이메일을 먼저 적어 주세요." (발송 안 함)
  - 성공 → **성공 안내(초록)** "가입된 이메일이면 재설정 메일을 보냈어요. 메일함을 확인해 주세요." — 계정 존재를 노출하지 않는 표현(Firebase 이메일 열거 방지와 일관).
  - 실패 → 기존 `toMessage(e)`로 매핑(`auth/invalid-email` 등은 이미 맵에 있음).
- 상태: 기존 `error`(코랄)와 별도로 `notice`(민트) 인라인 메시지 추가. 모드 전환·재입력 시 둘 다 비움.
- *Google 전용 계정·합성 계정은 무용* — Part 2가 담당. (별도 분기 처리 없음, 안전 문구로 흡수)

## Part 2 — 관리자(교사) 비번 재설정 (B-2 확장)
- **`PATCH /api/admin/users/[uid]`**: 기존 `disabled`/`dailyLimit` 처리에 이어 추가 —
  ```ts
  if ('password' in b) {
    if (typeof b.password === 'string' && b.password.length >= 6) {
      await adminAuth.updateUser(uid, { password: b.password });
    } else {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
    }
  }
  ```
  (admin 게이트는 기존대로. password는 비파괴적이라 `blockIfAdminTarget` 미적용 — 단, UI가 관리자 계정엔 액션을 안 보여주므로 실사용은 학생 계정에만.)
- **`patchUser`**(클라): 바디 타입에 `password?: string` 추가.
- **`UserActionModal`**(비관리자 분기): "비밀번호 재설정" 섹션 — 새 비번 입력(`type="password"`, ≥6) + "재설정" 버튼 → 클라에서 6자 검증 후 `patchUser(uid, { password })` → 토스트 "비밀번호를 바꿨어요". (교사가 직접 입력하므로 echo 불필요.)

## 비용 메모
`sendPasswordResetEmail`은 Firebase Auth 기본 기능으로 **무료**(Spark 포함), Firebase 자체 발송이라 외부 메일서비스·SMTP 불필요. 발신 주소를 우리 도메인으로 바꾸려면(선택) 별도 도메인/SMTP가 필요하지만 필수 아님 — 기본 발신으로 동작.

## 영향 파일
- 수정: `components/auth/LoginDialog.tsx`(Part 1), `app/api/admin/users/[uid]/route.ts`(password), `lib/admin/accounts.ts`(patchUser password), `app/admin/users/page.tsx`(UserActionModal 비번 섹션)

## 검증 기준 (완료 정의)
1. 로그인창 "비밀번호를 잊으셨어요?" → 이메일 입력 후 → 성공 안내. 빈 이메일 → "이메일을 먼저 적어 주세요." (실발송은 Firebase, 브라우저로 UX 확인)
2. 관리자 비번 재설정 self-test: admin이 학생 계정 비번 재설정(`patchUser{password}`) → **그 새 비번으로 `signInWithEmailAndPassword` 성공**; 5자 → 400; 비admin → 403.
3. UserActionModal에서 학생만 비번 재설정 노출(관리자 계정 분기엔 없음).
4. `tsc` + 프로덕션 빌드 통과.
