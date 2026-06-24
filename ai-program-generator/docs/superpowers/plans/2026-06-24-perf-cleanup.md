# 4단계 성능·정리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동작을 보존하며 클라 인증 fetch 중복 제거(A) + 전체-컬렉션 읽기를 페이지네이션(B) + N+1 루프를 배치 조회(C)로 바꾼다.

**Architecture:** 신규 `authedFetch`/`authedJson` 공용 헬퍼로 ~14곳 통일. 신고/사용자 목록은 기존 `posts.ts` 커서 패턴 + 페이지별 조인. 교사 인박스·발급 조회는 `in`/`getUsers`/`getAll` 배치로 경계화. 규칙·인덱스 변경 없음.

**Tech Stack:** Next.js 15 route handlers, Firebase Admin SDK(getUsers/getAll/count), Firestore 클라 SDK(cursor).

**공통:** 명령 `C:/Users/amh47/Documents/test/ai-program-generator`. git `git -C "C:/Users/amh47/Documents/test"`. tsc `./node_modules/.bin/tsc --noEmit`(dev 중 build 금지). 브랜치 `feat/perf-cleanup`. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **태스크 T1~T6은 파일이 겹치지 않음**.

---

### Task 1: authedFetch 공용 헬퍼 + A 이관(13곳)

**Files:** Create `lib/client/authedFetch.ts`; Modify 13 client files (목록 하단).

- [ ] **Step 1: 헬퍼 생성.** `lib/client/authedFetch.ts`:
```ts
import { auth } from '@/lib/firebase/client';

/** Firebase ID 토큰을 Bearer로 붙여 fetch. 원시 Response 반환(스트리밍·프리뷰용). */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  return fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` } });
}

/** authedFetch + JSON 파싱 + !ok면 data.error로 throw(CRUD 헬퍼용). */
export async function authedJson<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `요청 실패 (${res.status})`);
  return data as T;
}
```

- [ ] **Step 2: 로컬 `authed()`/`authedFetch()` 보유 파일 5곳 이관.** 각 파일에서 **로컬 헬퍼 함수 정의를 삭제**하고 상단에 `import { authedJson } from '@/lib/client/authedFetch';` 추가, 호출부의 `authed(...)`/`authedFetch(...)`를 `authedJson(...)`로 치환(시그니처 동일: `(path, init?) → 파싱된 데이터`). 대상: `lib/teacher/posts.ts`, `lib/teacher/reports.ts`, `lib/teacher/students.ts`, `lib/admin/teachers.ts`, `lib/admin/accounts.ts`. READ each first. (각 로컬 헬퍼는 "currentUser→getIdToken→fetch→res.json→!ok throw" 동일 형태라 `authedJson`과 1:1.) 반환 타입이 명시된 곳은 `authedJson<T>(...)`로 제네릭 지정.

- [ ] **Step 3: 인라인 패턴 → `authedJson` 6곳.** 각 파일에서 "currentUser 체크 + getIdToken + fetch(headers Bearer) + res.json + !ok throw"를 `authedJson`(또는 제네릭) 호출로 교체. 대상·함수: `lib/client/account.ts`(deleteMyAccount), `lib/client/postCount.ts`(call), `lib/student/board.ts`(getMyBoard), `lib/admin/members.ts`(fetchMembers — **단 T4에서 다시 손대므로 T1에서는 건드리지 말 것**), `app/mypage/page.tsx`(fetchMyUsage), `app/teacher/page.tsx`(fetchTeacherMe), `components/ui/FullscreenFrame.tsx`(requestPreviewId). **`lib/admin/members.ts`는 제외**(T4 소유). READ each first; method/body/Content-Type은 init으로 전달.

   예시 변환(account.ts):
```ts
// before: const user = auth.currentUser; if (!user) throw ...; const idToken = await user.getIdToken();
//         const res = await fetch('/api/me', { method:'DELETE', headers:{ Authorization:`Bearer ${idToken}` } });
//         const data = await res.json().catch(()=>({})); if (!res.ok) throw new Error(data?.error || ...); return data;
// after:
import { authedJson } from '@/lib/client/authedFetch';
export async function deleteMyAccount() {
  return authedJson('/api/me', { method: 'DELETE' });
}
```

- [ ] **Step 4: 스트리밍 → `authedFetch`(원시 Response) 1곳.** `lib/client/generate.ts`: `requestGenerateStream`의 토큰+fetch 부분을 `const res = await authedFetch(path, init);`로 교체(본문 reader는 그대로 res.body 사용). `import { authedFetch } from '@/lib/client/authedFetch';`. !ok 처리·스트림 파싱 로직은 보존.

- [ ] **Step 5: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 6: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/client/authedFetch.ts ai-program-generator/lib/teacher ai-program-generator/lib/admin/teachers.ts ai-program-generator/lib/admin/accounts.ts ai-program-generator/lib/client/account.ts ai-program-generator/lib/client/postCount.ts ai-program-generator/lib/client/generate.ts ai-program-generator/lib/student/board.ts ai-program-generator/app/mypage/page.tsx ai-program-generator/app/teacher/page.tsx ai-program-generator/components/ui/FullscreenFrame.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "refactor(client): 공용 authedFetch/authedJson로 인증 fetch 통합

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 신고 목록 커서 페이지네이션

**Files:** Modify `lib/firebase/reports.ts`, `app/admin/reports/page.tsx`

- [ ] **Step 1: 커서 조회 추가.** `lib/firebase/reports.ts`에 import 보강(`query, orderBy, limit, startAfter, type QueryDocumentSnapshot, type DocumentData`) 후 추가:
```ts
const REPORTS_PAGE = 30;

export async function fetchReportsPage(
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
): Promise<{ reports: Report[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> {
  const base = [collection(db, COL), orderBy('createdAt', 'desc'), limit(REPORTS_PAGE)] as const;
  const q = cursor ? query(...base, startAfter(cursor)) : query(...base);
  const snap = await getDocs(q);
  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report);
  return { reports, cursor: snap.docs.at(-1) ?? null, hasMore: snap.size === REPORTS_PAGE };
}
```
(기존 `fetchReports`·`countReports`는 유지 — 다른 호출부 호환.)

- [ ] **Step 2: admin/reports 페이지에 "더 보기".** `app/admin/reports/page.tsx` READ. `fetchReports()`(전체) 호출을 `fetchReportsPage()` 기반으로 교체: 상태 `cursor`/`hasMore`/`loadingMore` 추가, 초기 로드 + "더 보기" 버튼(클릭 시 `fetchReportsPage(cursor)` 호출해 누적 append, cursor/hasMore 갱신). 신고 그룹핑·표시 로직은 보존. 글 삭제/무시 후 재로딩은 처음 페이지부터 다시 로드(cursor null로 리셋).

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/firebase/reports.ts ai-program-generator/app/admin/reports/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "perf(reports): 신고 목록 커서 페이지네이션(admin)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 교사 신고 인박스 경계화(in 청크)

**Files:** Modify `app/api/teacher/reports/route.ts` (GET만)

- [ ] **Step 1: GET의 전체 스캔을 in-청크로.** 현재 GET은 `adminDb.collection('reports').get()`(전체) 후 `postOwnerUid ∈ studentUids` 필터. 이를 교체: studentUids를 30개씩 청크해 각 청크를 `where('postOwnerUid','in', chunk)`로 조회·병합. READ the file. 핵심 교체:
```ts
    const studentUids = [...new Set(stuSnap.docs.map((d) => d.id))];
    if (studentUids.length === 0) return NextResponse.json({ reports: [] });

    const chunks: string[][] = [];
    for (let i = 0; i < studentUids.length; i += 30) chunks.push(studentUids.slice(i, i + 30));
    const snaps = await Promise.all(
      chunks.map((c) => adminDb.collection('reports').where('postOwnerUid', 'in', c).get()),
    );
    const docs = snaps.flatMap((s) => s.docs);
```
이후 기존 그룹핑 로직은 `docs`(내 학생 신고만)에 대해 그대로 수행(이미 owner∈학생이므로 추가 필터 불필요). 반환 형태 동일.

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add "ai-program-generator/app/api/teacher/reports/route.ts"
git -C "C:/Users/amh47/Documents/test" commit -m "perf(teacher): 신고 인박스 전체스캔→postOwnerUid in 청크

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: admin/users 페이지별 조인

**Files:** Modify `app/api/admin/users/route.ts`, `lib/admin/members.ts`, `app/admin/users/page.tsx`

- [ ] **Step 1: 라우트 GET 교체.** `app/api/admin/users/route.ts`의 GET을 페이지별 조인으로(멤버 객체 필드 동일 보존). 전체 GET을 다음으로 교체:
```ts
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  const PAGE = 50;
  const pageToken = req.nextUrl.searchParams.get('pageToken') || undefined;
  let page;
  try {
    page = await adminAuth.listUsers(PAGE, pageToken);
  } catch (e) {
    console.error('listUsers 실패:', e);
    return NextResponse.json({ error: '가입자 목록을 불러오지 못했어요.' }, { status: 500 });
  }
  const users = page.users;
  const uids = users.map((u) => u.uid);
  const days = lastDayKeysKST(7);
  const today = todayKeyKST();

  // 페이지 uid에 한정한 조인(전체 컬렉션 스캔 제거)
  const userDocs = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.doc(`users/${u}`))) : [];
  const limitDocs = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.doc(`limits/${u}`))) : [];
  const usageRefs = uids.flatMap((u) => days.map((d) => adminDb.doc(`usage/${u}_${d}`)));
  const usageDocs = usageRefs.length ? await adminDb.getAll(...usageRefs) : [];
  const postCounts = await Promise.all(
    uids.map(async (u) => {
      try {
        const c = await adminDb.collection('posts').where('ownerUid', '==', u).count().get();
        return c.data().count;
      } catch {
        return 0;
      }
    }),
  );

  const nickById = new Map<string, string>();
  userDocs.forEach((d) => {
    const n = (d.data() as { nickname?: string } | undefined)?.nickname;
    if (n) nickById.set(d.id, n);
  });
  const overrideById = new Map<string, number>();
  limitDocs.forEach((d) => {
    const v = (d.data() as { dailyLimit?: number } | undefined)?.dailyLimit;
    if (typeof v === 'number' && v >= 0) overrideById.set(d.id, v);
  });
  const usageByUid = new Map<string, Map<string, number>>();
  usageDocs.forEach((snap, i) => {
    const uid = uids[Math.floor(i / days.length)];
    const day = days[i % days.length];
    const count = snap.exists ? ((snap.data() as { count?: number }).count ?? 0) : 0;
    if (!usageByUid.has(uid)) usageByUid.set(uid, new Map());
    usageByUid.get(uid)!.set(day, count);
  });
  const postCountByUid = new Map<string, number>();
  uids.forEach((u, i) => postCountByUid.set(u, postCounts[i]));

  const members = users.map((u) => {
    const perDay = usageByUid.get(u.uid);
    return {
      uid: u.uid,
      email: u.email ?? null,
      nickname: nickById.get(u.uid) ?? null,
      createdAt: toMs(u.metadata.creationTime) ?? 0,
      lastSignInAt: toMs(u.metadata.lastSignInTime),
      isAdmin: u.customClaims?.admin === true,
      disabled: u.disabled === true,
      postCount: postCountByUid.get(u.uid) ?? 0,
      usageToday: perDay?.get(today) ?? 0,
      usage7d: days.map((d) => perDay?.get(d) ?? 0),
      limitOverride: overrideById.get(u.uid) ?? null,
    };
  });

  const usageLimit = await readDailyLimit();
  return NextResponse.json({ members, usageLimit, days, nextPageToken: page.pageToken ?? null });
}
```
(imports·`toMs`·상단 헬퍼는 기존 그대로. `Promise.allSettled` 4-스캔 블록 제거.)

- [ ] **Step 2: members.ts에 pageToken + authedJson.** `lib/admin/members.ts` READ. `fetchMembers`를 `fetchMembers(pageToken?: string)`로: `authedJson`(T1 헬퍼) 사용 + `/api/admin/users` 쿼리에 `pageToken` 부착, 응답 타입에 `nextPageToken: string | null` 추가. (T1에서 이 파일을 건드리지 않았으므로 여기서 인라인 fetch→authedJson 이관도 함께.) 예:
```ts
import { authedJson } from '@/lib/client/authedFetch';
// ... Member 타입 유지 ...
export async function fetchMembers(pageToken?: string): Promise<{ members: Member[]; usageLimit: number; days: string[]; nextPageToken: string | null }> {
  const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
  return authedJson(`/api/admin/users${qs}`);
}
```

- [ ] **Step 3: admin/users 페이지 "더 보기".** `app/admin/users/page.tsx` READ. `fetchMembers()` 호출에 pageToken 상태 + "더 보기"(클릭 시 `fetchMembers(nextPageToken)` 누적 append, nextPageToken 갱신; null이면 버튼 숨김). 검색·표시 로직 보존.

- [ ] **Step 4: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/admin/users/route.ts ai-program-generator/lib/admin/members.ts ai-program-generator/app/admin/users/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "perf(admin): 사용자 목록 페이지네이션 + 페이지별 조인(전체 스캔 제거)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: teacher/students getUsers 배치

**Files:** Modify `app/api/teacher/students/route.ts` (GET만)

- [ ] **Step 1: per-student getUser → getUsers 배치.** GET의 `Promise.all(snap.docs.map(async d => { const u = await adminAuth.getUser(d.id) ... }))`를 배치로. READ the file. 핵심:
```ts
  const docs = snap.docs;
  const uids = docs.map((d) => d.id);
  const recById = new Map<string, import('firebase-admin/auth').UserRecord>();
  for (let i = 0; i < uids.length; i += 100) {
    const res = await adminAuth.getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    res.users.forEach((u) => recById.set(u.uid, u));
  }
  const students = docs.map((d) => {
    const s = d.data();
    const u = recById.get(d.id);
    return {
      uid: d.id,
      email: u?.email ?? null,
      name: (s.name as string) ?? '',
      limitType: (s.limitType as string) === 'total' ? 'total' : 'daily',
      limitValue: (s.limitValue as number) ?? 0,
      usedTotal: (s.usedTotal as number) ?? 0,
      disabled: u?.disabled ?? false,
    };
  });
```
(없는 계정=고아 문서는 `u` undefined → email null·disabled false, 현행과 동일.)

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/teacher/students/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "perf(teacher): 학생 목록 getUser N+1 → getUsers 배치

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: admin/teachers getAll 배치

**Files:** Modify `app/api/admin/teachers/route.ts` (GET만)

- [ ] **Step 1: per-teacher doc.get → getAll 배치.** GET의 `Promise.all(teacherUsers.map(u => adminDb.doc(`teachers/${u.uid}`).get()))`를 `await adminDb.getAll(...teacherUsers.map((u) => adminDb.doc(`teachers/${u.uid}`)))`로 교체(빈 배열이면 getAll 호출 생략하고 `[]`). READ the file. listUsers 페이지 루프·claim 필터는 유지. `docs[i]`로 매핑하는 기존 로직 동일.
```ts
    const refs = teacherUsers.map((u) => adminDb.doc(`teachers/${u.uid}`));
    const docs = refs.length ? await adminDb.getAll(...refs) : [];
```

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/admin/teachers/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "perf(admin): 교사 목록 doc.get N+1 → getAll 배치

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: self-test + 검증

**Files:** Create `scripts/selftest-pagination.mjs` (미커밋)

- [ ] **Step 1: 기존 self-test 재실행(동작 보존).** dev 띄운 채:
  - `node scripts/selftest-teacher-reports.mjs` → 8/8(인박스 in-청크 후에도).
  - `node scripts/selftest-student-login.mjs` → 6/6(teacher/students 배치 후에도).
  - 존재 시 `node scripts/selftest-admin-users.mjs`, `node scripts/selftest-accounts.mjs`, `node scripts/selftest-mypage.mjs` 실행 → 모두 통과. (없으면 생략하고 보고.)

- [ ] **Step 2: 페이지네이션 self-test 작성.** `scripts/selftest-pagination.mjs`(미커밋): Admin SDK로 신고 35건 시드 → 클라SDK `fetchReportsPage`를 두 번 호출(페이지 분할·커서 전진·중복 없음·합집합=35 확인) → 정리. 또는 admin 토큰으로 `/api/admin/users?pageToken=`을 호출해 nextPageToken으로 두 페이지가 안 겹치는지 확인. (구현 시 selftest-teacher-reports.mjs의 시드/토큰 헬퍼 패턴 재사용.)
  Run: `node scripts/selftest-pagination.mjs` → `결과: N 통과, 0 실패`.

- [ ] **Step 3: tsc + 빌드.** dev 정지 후: `./node_modules/.bin/tsc --noEmit` → 0; `rm -rf .next && npm run build` → 성공.

- [ ] **Step 4: 미커밋 확인.** `scripts/selftest-pagination.mjs`가 `??`(untracked).

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- A authedFetch 통합(헬퍼 + ~14곳) → T1(13곳) + T4 Step2(members.ts). ✓
- B1 신고 커서 → T2. ✓ / B2 인박스 청크 → T3. ✓ / B3 admin/users 페이지조인 → T4. ✓
- C1 students 배치 → T5. ✓ / C2 teachers 배치 → T6. ✓
- 검증(기존+신규 self-test, tsc/build) → T7. ✓
- 규칙·인덱스 변경 없음 → 플랜에 없음. ✓

**2. Placeholder scan:** 백엔드 로직은 완전 코드. UI "더 보기"(T2/T4)·기존 헬퍼 1:1 치환(T1)은 "READ 후 동일 패턴 적용"으로 명시(동작 보존 리팩터라 파일별 현재 코드에 의존 — 구현자가 읽고 적용). "TODO/TBD" 없음.

**3. Type/이름 일관성:**
- `authedFetch`(Response)·`authedJson<T>`(데이터) — T1 정의, T1·T4 사용 일치. ✓
- `fetchReportsPage` 반환 `{reports, cursor, hasMore}` — T2 정의·페이지 사용 일치. ✓
- admin/users 멤버 객체 11필드 + 응답 `{members, usageLimit, days, nextPageToken}` — 현행 + nextPageToken 추가, `fetchMembers` 반환 타입(T4 Step2)과 일치. ✓
- usage 문서 id `${uid}_${day}` — studentQuota/generate/me-usage와 동일(확인됨). ✓
- `getUsers([{uid}])`·`getAll(...refs)` — Admin SDK 시그니처 정확(빈 배열 가드). ✓
- 멤버비침: T1(members.ts 제외)·T4(members.ts 소유) — 충돌 없음. T1~T6 파일 disjoint. ✓
