# 관리자 콘솔 확장 (A) — 운영 대시보드: 가입자 목록 설계

작성일: 2026-06-14

## 배경 / 목표
`/admin`을 "교사용 운영 콘솔"로 키운다. 1차 용도는 **C(지금 수업 운영 중심 / 나중에 공개 모더레이션도 대비)**. 이번 하위 프로젝트 **A**는 **읽기 전용 운영 대시보드 — 가입자 목록**만 만든다. 교사가 학생 계정·닉네임·사용량을 한눈에 본다.

## 범위
- **포함**: 콘솔 구조 재편(허브 + 하위 라우트), 가입자 목록(`/admin/users`), 이를 위한 admin 전용 API 라우트.
- **제외(다음/B 이후)**: 계정 생성·삭제, 사용량 한도 조절, 계정 정지, 비번 재설정, 작품 관리, 통계 대시보드. 공지 배너는 로드맵에서 **제외**.
- 확장 대비: 행에 나중에 모더레이션 컬럼(정지 여부 등)을 얹을 수 있게 구조만 열어둔다(이번엔 구현 안 함).

## 콘솔 구조 (허브 + 하위 라우트)
- **`/admin`** — 허브(메뉴). admin 가드. 카드: **신고 처리**(미처리 신고 N 표시) / **가입자**. 각 카드 클릭 → 하위 라우트.
- **`/admin/reports`** — 기존 신고 처리 화면을 **그대로 이동**(로직 변경 없음). 현재 `app/admin/page.tsx`의 내용이 이리로.
- **`/admin/users`** — 신규 가입자 목록.
- 헤더 "관리자" 칩은 계속 `/admin`(허브)로 링크. 칩의 "신고 N"은 유지(세션 1회 `countReports`).

## 데이터 흐름 — admin 전용 API 라우트
가입자 목록은 `listUsers`·이메일·전체 `usage` 등 **Admin SDK 전용 데이터**라 서버 라우트가 필요하다(클라이언트 SDK·규칙으로는 불가). `/api/generate`의 게이트 패턴을 그대로 재사용.

### `GET /api/admin/users` (신규)
- **인증**: `Authorization: Bearer <Firebase ID 토큰>` → `adminAuth.verifyIdToken` → `decoded.admin === true` 아니면 **403**. 토큰 없음 → **401**.
- **조립(Admin SDK)**:
  1. **(핵심)** `adminAuth.listUsers(1000)` → uid, email, `disabled`, `metadata.creationTime`, `metadata.lastSignInTime`, `customClaims.admin`. **이 단계 실패 시에만 500**(명단 자체가 없으므로).
  2~4. **(부가 — `Promise.allSettled`로 병렬 + 개별 폴백)**: 하나가 실패해도 빈 맵으로 폴백해 표는 정상 렌더한다.
     - `adminDb.collection('users').get()` → uid→nickname 맵 (실패 → 닉네임 빈값)
     - `adminDb.collection('usage').where('day','in', last7Keys).get()` → uid별 `{day: count}` (실패 → usage 0)
     - `adminDb.collection('posts').select('ownerUid').get()` → uid별 작품 수 집계 (실패 → 0)
- **반환**: `{ members: Member[], usageLimit: number, days: string[] }` (`days` = 최근 7일 키 오름차순, 스파크라인 정렬 기준)
- **에러**: 401(토큰 없음)/403(비admin)/500(Admin SDK 오류) + JSON `{ error }`.

### 타입 (`lib/admin/members.ts`)
```ts
export interface Member {
  uid: string;
  email: string | null;
  nickname: string | null;
  createdAt: number;        // ms (metadata.creationTime → getTime)
  lastSignInAt: number | null;
  isAdmin: boolean;
  disabled: boolean;        // listUsers의 user.disabled — 정지 계정 표시·모더레이션 대비
  postCount: number;
  usageToday: number;       // 오늘(KST) 생성 횟수
  usage7d: number[];        // days 순서에 맞춘 7개 카운트(없는 날 0)
}
```
- 클라이언트 `fetchMembers(): Promise<{ members: Member[]; usageLimit: number; days: string[] }>` — `auth.currentUser.getIdToken()`을 Bearer로 붙여 `/api/admin/users` 호출, 응답 검증.

### KST 날짜 헬퍼 (`lib/usageDay.ts`, 신규 — DRY)
- 현재 `todayKeyKST()`가 `app/api/generate/route.ts`에만 있음. 공용 모듈로 추출:
  - `todayKeyKST(): string` — `(UTC+9).toISOString().slice(0,10)` → `YYYY-MM-DD`
  - `lastDayKeysKST(n: number): string[]` — 오늘 포함 최근 n일 키(오름차순)
- `app/api/generate/route.ts`가 이 모듈에서 `todayKeyKST`를 import하도록 교체(동작 동일).

## `/admin/users` 화면
- admin 가드(아래 `AdminGate`). `fetchMembers()` 호출.
- 표 컬럼: **닉네임 · 이메일(아이디) · 가입일 · 마지막 접속 · 작품 수 · 오늘 사용량(`n/한도`, admin이면 `무제한`) · 7일 추이(막대)**
- **비활성 계정**(`disabled`): 행을 흐리게 + "정지" 배지. 자동 숨김은 안 함(관리자는 전부 봐야). B의 정지/차단 액션으로 확장.
- **검색**: 닉네임/이메일 부분일치(클라이언트 필터)
- **정렬**: 사용량(오늘) / 가입일 토글
- 7일 추이 = **순수 CSS 미니 막대**(`Sparkline`), 차트 라이브러리 미사용
- 상태: 로딩(`LoadingDots`) / 빈("가입자가 없어요") / 에러(친절 메시지 + 다시 시도)
- 행 클릭 상세는 이번 범위 밖(추후 B에서 계정 액션과 함께).

## 공용 조각 (DRY)
- **`components/admin/AdminGate.tsx`** — `{ children }`을 받아 admin일 때만 렌더. `authLoading` 동안 로딩, 비admin이면 토스트+`/` 리다이렉트. 현재 `/admin`의 가드 로직을 여기로 추출해 허브·reports·users 세 곳이 공유.
- **`components/admin/Sparkline.tsx`** — `{ values: number[]; max?: number }` 받아 7개 막대 렌더(높이 = count/max). 0이면 최소 높이.

## 보안 · 배포 · 성능
- **보안 경계 = API 라우트**(서버에서 admin claim 검증). `AdminGate`는 UX용 가드일 뿐.
- **배포 주의(미해결, 출시 시)**: `serviceAccountKey.json`은 로컬 전용(gitignored). 프로덕션에서 `/api/admin/*`와 `/api/generate`가 돌려면 배포 env에 Admin 자격증명 필요. 지금(로컬) 동작에는 영향 없음.
- **성능 주의(현재 수용 / 공개 확장 시 재검토)**:
  - `usage where day in [7키]`는 *최근 7일에 실제 생성한 (유저×날짜) 문서*만 읽음(미생성일은 문서 없음) → "전체유저×7"이 아니다. `in` 값은 7개(≤30 제한 내). 교사 규모(수백 미만)엔 가벼움.
  - 작품 수는 `posts.select('ownerUid')` 전체 1회 스캔. 게시물 급증 시 비정규화 카운트로 재검토.
  - **공개 운영(C의 다음 단계)에서 가입자 수백~수천이면**: 유저 목록 **페이지네이션 + 페이지 단위 usage 조인**이 1차로 필요(B 근처 작업). A(교사 규모)엔 페이지네이션 미포함 — YAGNI.

## 영향 파일
- 신규: `app/admin/users/page.tsx`, `app/admin/reports/page.tsx`(이동), `app/api/admin/users/route.ts`, `lib/admin/members.ts`, `lib/usageDay.ts`, `components/admin/AdminGate.tsx`, `components/admin/Sparkline.tsx`
- 수정: `app/admin/page.tsx`(→ 허브로 재작성), `app/api/generate/route.ts`(`todayKeyKST`를 `lib/usageDay`에서 import)
- 이동: 현재 `app/admin/page.tsx`의 신고 처리 UI → `app/admin/reports/page.tsx`

## 검증 기준 (완료 정의)
1. 비admin이 `/admin`·`/admin/users`·`/admin/reports` 진입 → 홈 리다이렉트 + API는 403.
2. admin이 `/admin` 허브 → "신고 처리"(신고 N)·"가입자" 카드, 각 하위 라우트로 이동.
3. `/admin/users` → 가입자 표(닉네임·이메일·가입일·마지막접속·작품수·오늘 사용량·7일 막대). 검색·정렬 동작. 비활성 계정은 흐리게+"정지" 배지.
   - 부분 실패 안전: usage/posts 조회만 실패해도 명단은 폴백(0)으로 렌더(`listUsers` 실패만 500).
4. 신고 처리 화면이 `/admin/reports`에서 기존과 동일 동작(삭제/무시).
5. `/api/generate` 사용량 카운트가 헬퍼 추출 후에도 동일 동작(회귀 없음).
6. `tsc` + 프로덕션 빌드 통과. 통합 self-test: admin custom token으로 ID토큰 발급 → `/api/admin/users` 200·형태 확인 / 비admin 토큰 → 403.
