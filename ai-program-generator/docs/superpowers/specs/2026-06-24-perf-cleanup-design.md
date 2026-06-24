# 4단계 성능·정리 (authedFetch 통합 + 페이지네이션 + N+1 배치) 설계

작성일: 2026-06-24 · 상태: 승인됨

## 목표
동작을 보존하면서 (A) 클라 인증 fetch 중복 제거, (B) 전체-컬렉션 읽기를 경계 있는 페이지네이션으로, (C) N+1 루프를 배치 조회로 바꿔 확장에 대비한다. **풀카운터 샤딩은 제외**(하드 캡과 상극 + 교실 쓰기율이 단일문서 한계 이하 — 트리거 보존).

## A) authedFetch 통합

### 신규 `lib/client/authedFetch.ts`
```ts
import { auth } from '@/lib/firebase/client';

/** Firebase ID 토큰을 Bearer로 붙여 fetch. 원시 Response 반환(스트리밍·프리뷰용). */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  return fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` } });
}

/** authedFetch + JSON 파싱 + !ok면 data.error로 throw(대부분의 CRUD 헬퍼용). */
export async function authedJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `요청 실패 (${res.status})`);
  return data as T;
}
```

### 이관 (~14곳)
- **기존 로컬 `authed()`/`authedFetch()` 제거 → `authedJson` import**: `lib/teacher/posts.ts`, `lib/teacher/reports.ts`, `lib/teacher/students.ts`, `lib/admin/teachers.ts`, `lib/admin/accounts.ts`, `app/admin/exemplars/page.tsx`.
- **인라인 → `authedJson`**: `lib/client/account.ts`, `lib/client/postCount.ts`, `lib/student/board.ts`, `lib/admin/members.ts`, `app/mypage/page.tsx`(fetchMyUsage), `app/teacher/page.tsx`(fetchTeacherMe), `components/ui/FullscreenFrame.tsx`(requestPreviewId — json 응답이면 authedJson).
- **인라인 → `authedFetch`(원시 Response)**: `lib/client/generate.ts`(스트리밍 본문 reader 필요).
- 각 호출부의 method/body/Content-Type은 `init`으로 그대로 전달. 에러 메시지는 기존 의미 보존(authedJson이 `data.error` 우선).

## B) 페이지네이션 (기존 `lib/firebase/posts.ts` 커서 패턴)

### B1. 신고 목록 커서 — `lib/firebase/reports.ts`
- 추가 `fetchReportsPage(cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<{ reports: Report[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }>` — `query(collection(db,'reports'), orderBy('createdAt','desc'), limit(PAGE), startAfter(cursor?))`. PAGE=30.
- `app/admin/reports/page.tsx`: `fetchReports`(전체) → `fetchReportsPage` + "더 보기"(IntersectionObserver 또는 버튼). `countReports`(배지)는 유지.
- 인덱스: `createdAt desc` 단일필드 — 자동.

### B2. 교사 신고 인박스 경계화 — `app/api/teacher/reports/route.ts` GET
- 현재: `reports` 전체 `.get()` 후 `postOwnerUid ∈ 내학생` 필터.
- 변경: 내 학생 uid를 **30개씩 청크**, 각 청크 `adminDb.collection('reports').where('postOwnerUid','in', chunk).get()` → 합쳐 postId별 그룹(기존과 동일 출력). 전체 스캔 제거, 내 학생 신고만 읽음.

### B3. admin/users 페이지별 조인 — `app/api/admin/users/route.ts` GET (가장 큰 덩어리)
- 현재: `listUsers(1000)` 전체 + `users`/`usage(7일)`/`posts(ownerUid)`/`limits` 4개 컬렉션 전체 스캔으로 멤버 집계.
- 변경(페이지당 경계 조인):
  1. `?pageToken` 쿼리 파라미터. `adminAuth.listUsers(PAGE=50, pageToken)` → 한 페이지 auth 사용자.
  2. 그 페이지 uid들에 대해서만:
     - `users` 문서: `adminDb.getAll(...uids.map(u=>doc(`users/${u}`)))`.
     - `limits` 문서: `adminDb.getAll(...uids.map(u=>doc(`limits/${u}`)))`.
     - `usage`: 필요한 `{uid}_{day}` 문서들(uid×최근 days)을 `adminDb.getAll(...)`로 한 번에.
     - **글수**: uid마다 `getCountFromServer(query(posts where ownerUid==uid))` (페이지당 ≤50 count 쿼리, 전체 posts 스캔 대체).
  3. 반환 `{ members: <기존 멤버 형태>, nextPageToken }`.
- `lib/admin/members.ts` `fetchMembers(pageToken?)` + `app/admin/users/page.tsx` "더 보기". **멤버 객체 필드·의미는 현행 그대로 보존**(구현 시 라우트를 읽어 필드 일치).

## C) N+1 배치

### C1. teacher/students GET — `app/api/teacher/students/route.ts`
- 현재: 학생마다 `adminAuth.getUser(d.id)`.
- 변경: 학생 uid 배열을 **100개씩 청크**, `adminAuth.getUsers(chunk.map(uid=>({uid})))` → uid→UserRecord 맵 구성 후 매핑. email/disabled 추출 동일, 없는 계정(notFound)은 email null·disabled false(현행과 동일 처리).

### C2. admin/teachers GET — `app/api/admin/teachers/route.ts`
- 현재: 페이지 내 교사마다 `adminDb.doc(`teachers/${uid}`).get()`.
- 변경: `adminDb.getAll(...teacherUsers.map(u=>adminDb.doc(`teachers/${u.uid}`)))` 배치. (claim으로 교사 찾는 `listUsers` 루프는 유지 — claim은 쿼리 불가.)

## 데이터 흐름 / 호환
- A는 순수 리팩터(요청·응답 동일). B는 응답에 `nextPageToken`/`hasMore`·`cursor` 추가(클라가 "더 보기"). C는 내부 구현만 변경(응답 동일).
- 규칙 변경 없음. 인덱스: B1·B2의 createdAt desc·postOwnerUid in 모두 단일필드(자동). 새 복합 인덱스 불필요.

## 에러 처리 / 엣지
- `getUsers`/`getAll`은 없는 항목을 notFound/미존재로 반환 → 기존 try/catch 고아 처리와 동일하게 매핑.
- `in` 쿼리 30개 한도 → 청크. `getUsers` 100개 한도 → 청크.
- 빈 페이지/마지막 페이지: nextPageToken 없음 → "더 보기" 숨김.
- count 쿼리 실패 시 글수 0(현행도 누락 시 0).

## 검증
- **기존 self-test 재실행**(미커밋, 있는 것): `selftest-accounts.mjs`, `selftest-admin-users.mjs`, `selftest-mypage.mjs`, `selftest-teacher-reports.mjs`, `selftest-student.mjs` — 동작 보존 확인(특히 admin/users·teacher students·교사 인박스).
- **신규 페이지네이션 self-test**(미커밋) `selftest-pagination.mjs`: PAGE 초과 신고·사용자 시드 → `fetchReportsPage`/admin-users pageToken이 페이지 분할·커서 전진·중복 없음 확인.
- `tsc --noEmit` + 프로덕션 빌드.

## 영향 파일
- 신규: `lib/client/authedFetch.ts`, self-test(미커밋).
- 수정(A): 위 ~14개 클라 헬퍼/컴포넌트.
- 수정(B): `lib/firebase/reports.ts`, `app/admin/reports/page.tsx`, `app/api/teacher/reports/route.ts`, `app/api/admin/users/route.ts`, `lib/admin/members.ts`, `app/admin/users/page.tsx`.
- 수정(C): `app/api/teacher/students/route.ts`, `app/api/admin/teachers/route.ts`.

## 범위 밖
풀카운터 샤딩(트리거 보존), 글수 비정규화 카운터(count() 쿼리로 충분), 신고 인박스 자체 페이지네이션(청크 경계화로 충분 — 한 반 신고는 소수).
