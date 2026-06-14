# 관리자 콘솔 B — 수업용 계정 관리 설계

작성일: 2026-06-14

## 배경 / 목표
A(가입자 목록)에 이어, 교사가 **수업용 계정을 만들고(개별·일괄)·정지/삭제하고·일일 생성 한도를 조절**하는 쓰기 기능을 추가한다. 방향 C(지금 수업, 나중에 공개 운영 대비). 초등 저학년 + 파괴적 동작 포함이라 안전을 최우선으로.

## 결정 사항(확정)
- **계정 생성**: 개별 + 일괄(반 단위) 둘 다.
- **일괄 비밀번호**: 반 공통 비번(교사가 하나 입력, 전원 동일).
- **계정 제거**: **정지(disabled) 우선**(되돌리기 가능) + **하드삭제 별도**(계정 + 그 학생 작품 영구 삭제, 강한 확인).
- **한도**: **전역 기본값**(생성 시 적용, 조정 가능) + **학생별 오버라이드**(관리자 패널에서).
- 인증은 기존 이메일/비번. 학생이 실제 이메일이 없으면 **합성 이메일** 사용.

## 구조 (A의 허브에 확장)
- 허브 `/admin`에 **"계정 관리"** 카드 추가 → **`/admin/accounts`**(신규): 계정 생성(개별·일괄) + 전역 한도 설정.
- 기존 **`/admin/users`** 행에 액션 추가: 정지/해제 · 하드삭제 · 학생별 한도 오버라이드. (정지 배지는 A에서 이미 렌더)

## 계정 생성 (`/admin/accounts`)
- **합성 이메일 규칙**: 도메인 고정 `class.kr`. 일괄은 `{prefix}-{NN}@class.kr`(NN = 2자리 zero-pad, 01..N). prefix는 ASCII 안전문자(`[a-z0-9-]`)만.
- **개별**: 이메일(실제 또는 합성) + 비번(≥6자) → 1건. `adminAuth.createUser`.
- **일괄**: `prefix + 인원수 N(1..50) + 공통 비번(≥6자)` → N개 생성. 계정별 `Promise.allSettled` — 이미 존재(이메일 충돌)하면 그 건만 건너뛰고 성공/실패 수 리포트.
- **자격증명 표시**: 생성 직후 응답으로 `created: [{ email, password }]`(교사가 방금 정한 비번 echo) → 화면에 아이디+비번 표 + 전체 복사. **Firebase는 비번을 다시 못 주므로 이 한 번이 유일**(안내 문구 명시).
- 제약 감수: 아이디가 이메일 형식이라 저학년 타이핑이 길다(email/password 인증의 한계).

## 계정 라이프사이클 (`/admin/users` 행 액션)
- **정지/해제**: `updateUser(uid, { disabled })`. 데이터는 유지. 정지하면 **재로그인·토큰 갱신이 막힘**(이미 발급된 ID 토큰은 만료(최대 1시간)까지 유효 — 즉시 차단까지 필요하면 `revokeRefreshTokens` + 생성 라우트 `checkRevoked` 옵션. 수업용엔 재로그인 차단으로 충분, 이번 범위 밖).
- **하드삭제**(강한 확인 모달): 다음을 순서대로 — `deleteUser(uid)`(Auth) → 그 학생 `posts`(ownerUid==uid) 배치 삭제 → `users/{uid}`(프로필) 삭제 → `nicknames`에서 uid 일치 문서 삭제(닉네임 반환) → `limits/{uid}` 삭제. 되돌릴 수 없음.

## 한도 (전역 + 학생별)
- **전역 기본**: 단일 문서 `config/usage = { dailyLimit: number, updatedAt }`(admin 전용 — 클라이언트 규칙 없음). `/admin/accounts`에서 숫자로 조정. 없으면 env `GEN_DAILY_LIMIT`(30) 폴백.
- **학생별 오버라이드**: `limits/{uid} = { dailyLimit: number, updatedAt }`(admin 전용). `/admin/users` 행에서 설정/해제. `dailyLimit: 0` = 막음. 해제 = `limits/{uid}` 삭제(전역으로 복귀).
- **`/api/generate` 한도 해석**: 사용량 트랜잭션 직전에 **`limits/{uid}` ?? `config/usage` ?? env(30)** 순으로 실효 한도를 읽어 사용. 기존 동작은 env 폴백으로 보존(회귀 주의). admin claim은 종전대로 무제한.
- A의 `GET /api/admin/users`가 각 유저의 오버라이드 값(`limitOverride: number | null`)도 반환 → 표 "오늘 사용"을 `n/실효한도`로 표시.

## API 라우트 (모두 admin claim 서버 검증 — A 패턴 재사용, runtime nodejs)
- `POST /api/admin/accounts` — body `{ mode: 'single', email, password } | { mode: 'batch', prefix, count, password }`. 생성 후 `{ created: [{email,password}], skipped: [{email,reason}] }` 반환.
- `PATCH /api/admin/users/[uid]` — body `{ disabled?: boolean, dailyLimit?: number | null }`(null=오버라이드 해제). disabled → updateUser; dailyLimit → limits/{uid} set/delete.
- `DELETE /api/admin/users/[uid]` — 하드삭제(위 cascade).
- `GET/PATCH /api/admin/config` — 전역 한도 조회/설정(`config/usage`).

## 데이터 계층 (신규/수정)
- 신규 `lib/admin/accounts.ts`(클라): `createAccounts`, `patchUser`, `deleteUser`, `getConfig`, `setConfig` — 모두 ID 토큰 Bearer로 위 라우트 호출.
- 수정 `app/api/admin/users/route.ts`(A): `limits` 컬렉션 조인 → `Member`에 `limitOverride` 추가.
- 수정 `app/api/generate/route.ts`: 실효 한도 해석(override ?? config ?? env).

## 보안 · 배포 · 안전
- 보안 경계 = API 라우트(서버 admin 검증). 클라 가드(`AdminGate`)는 UX용.
- 하드삭제·일괄생성은 확인 모달. 하드삭제는 "되돌릴 수 없음" 명시 + 대상 이름 확인.
- 비번은 생성 직후 1회만 노출(복구 불가 안내).
- **배포 주의(미해결)**: Admin 자격증명이 로컬 전용 → 프로덕션에서 `/api/admin/*`·`/api/generate` 동작하려면 배포 env에 자격증명 필요(A와 동일).
- **성능 주의(수용)**: `/api/generate`가 한도 해석에 문서 1~2회 추가 read. 저트래픽 OK, 급증 시 config 캐시 검토.

## 구현 분할 (스펙 1개 → 플랜 2개)
- **B-1(비파괴적, 먼저)**: `/admin/accounts`(생성 개별·일괄 + 전역 한도), `POST /api/admin/accounts`, `GET/PATCH /api/admin/config`, `/api/generate`에 전역 config 반영, 허브 카드.
- **B-2(파괴적, 나중)**: `/admin/users` 행 액션(정지/해제·하드삭제·오버라이드), `PATCH/DELETE /api/admin/users/[uid]`, `/api/generate`에 학생별 override 반영, A의 users 라우트에 `limitOverride` 추가.

## 검증 기준 (완료 정의)
1. 비admin이 모든 `/api/admin/*` 호출 → 403.
2. 개별 생성 → 그 아이디/비번으로 로그인 가능. 일괄 생성 → N개 생성, 충돌 건 skip 리포트, 자격증명 표 1회 노출.
3. 전역 한도를 5로 바꾸면 새 계정이 하루 5회 후 429. 학생별 오버라이드 10 설정 시 그 학생만 10회.
4. 정지 → 그 계정 재로그인 차단(새 토큰 발급 불가). 해제 → 복구.
5. 하드삭제 → Auth 계정·그 학생 posts·프로필·닉네임·limits 모두 사라짐(닉네임 재사용 가능).
6. `/api/generate` 회귀 없음: 오버라이드·config 없으면 env(30) 그대로.
7. `tsc` + 프로덕션 빌드 + custom-token 통합 self-test(생성·한도·정지·삭제·403).
