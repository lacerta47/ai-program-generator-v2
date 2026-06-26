# 게시판 리뉴얼 — Plan 1: 교실 보드 비공개화 (구현 플랜)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사(교실) 게시판을 "그 교사 + 그 반 학생만" 읽도록 비공개화한다. 공개 게시판은 현행대로 누구나.

**Architecture:** 각 게시물에 `boardTeacherUid`(공개=null, 교실=그 교사 uid)를 비정규화하고, 학생 클레임에 `classTeacherUid`를 넣어 **목록 쿼리가 규칙으로 인가**되게 한다(Firestore "규칙은 필터가 아님"). 읽기 규칙은 `boardTeacherUid` 분기. 미리보기 공개 GET은 공개 글만 서빙.

**Tech Stack:** Next.js 15(App Router)·TypeScript·Firebase(Firestore rules/indexes·Auth custom claims·Admin SDK)·client SDK self-test.

**스펙:** `ai-program-generator/docs/superpowers/specs/2026-06-25-board-renewal-design.md`
**범위 밖:** 공유링크+관람 PIN(= Plan 2), 사진 업로드(후속 스펙).

---

## ⚠️ 라이브 마이그레이션 안전 순서 (필독)

운영 중 보드를 깨지 않으려면 **이 순서**여야 한다:

1. **A** 새 글이 `boardTeacherUid`를 갖게(create만, 읽기는 아직 공개) → 배포해도 무해.
2. **B** 기존 글 전부 `boardTeacherUid` 백필 + 학생 `classTeacherUid` 클레임 백필.
3. **C** 쿼리를 `boardTeacherUid` 필터로 전환 + 인덱스 배포.
4. **D** 읽기 규칙을 교실-비공개로 조이기(이제 모든 글에 필드 있음 + 쿼리 제약됨 → 안전).
5. **E** 미리보기 공개 GET 게이트.
6. **F** 최종 배포 + 전체 self-test.

> D를 B/C보다 먼저 배포하면 필드 없는 기존 글이 거부되어 보드가 빈다. 반드시 A→B→C→D.

## 파일 맵

| 파일 | 책임 | 변경 |
|---|---|---|
| `firestore.rules` | posts 권한 | validPost에 `boardTeacherUid` 검증(A), 읽기 규칙 분기(D) |
| `lib/firebase/types.ts` | Post 타입 | `boardTeacherUid` 필드(A) |
| `components/board/UploadDialog.tsx` | 게시 폼 | create 시 `boardTeacherUid` 채움(A) |
| `scripts/migrate-board-privacy.mjs` | 1회 마이그레이션(미커밋) | 기존 글·클레임 백필(B) |
| `app/api/teacher/students/route.ts` | 학생 발급 | 클레임에 `classTeacherUid`(B) |
| `lib/firebase/posts.ts` | 쿼리 | `fetchPosts`에 `boardTeacherUid` 필터(C) |
| `firestore.indexes.json` | 인덱스 | 복합 인덱스 교체(C) |
| `components/board/BoardView.tsx` | 브라우징 | 멤버십으로 카테고리 필터 + 쿼리 인자(C) |
| `app/api/preview/post/[id]/route.ts` | 게시물 미리보기 | 교실 글 거부(E) |
| `scripts/selftest-board-privacy.mjs` | 규칙 검증(미커밋) | 전 태스크 누적 |

**검증 현실(이 repo엔 테스트 프레임워크 없음):** "테스트"는 `scripts/selftest-*.mjs`(미커밋, Admin SDK 시드 + custom token→ID token→**client SDK로 규칙 검증**) + `./node_modules/.bin/tsc --noEmit` + `npm run build`. 규칙은 `firebase deploy --only firestore:rules --project test-ai-builder` 후 client SDK로만 검증(Admin SDK는 규칙 우회). 기존 패턴: `scripts/selftest-integrity.mjs`.

---

## Task A: `boardTeacherUid` 데이터 모델 + create 검증 (읽기는 그대로 공개)

**Files:**
- Modify: `lib/firebase/types.ts` (Post 인터페이스)
- Modify: `firestore.rules:52-64`(validPost) + `:114-120`(posts create)
- Modify: `components/board/UploadDialog.tsx:140-150`(createPost 호출)
- Test: `scripts/selftest-board-privacy.mjs` (신규)

- [ ] **Step 1: 실패하는 self-test 작성** — `scripts/selftest-board-privacy.mjs`

`scripts/selftest-integrity.mjs`의 헤더(admin app 초기화·`signInWithCustomToken`으로 client app·시드 헬퍼)를 그대로 본떠 만들고, 다음 케이스를 추가한다:

```js
// 시드: 공개 카테고리 PUB(teacherUid 없음), 교사 T(teachers/{T}), 교사 카테고리 CAT(teacherUid=T)
// client(교사 T로 로그인)로 create 시도:
//  (1) 교실 글 boardTeacherUid=T  → 성공
//  (2) 교실 글 boardTeacherUid=null(위조) → 거부
//  (3) 공개 글 boardTeacherUid=null → 성공
//  (4) 공개 글 boardTeacherUid='someoneElse'(위조) → 거부
await assertSucceeds(addDoc(postsCol, mkPost({ categoryId: CAT, boardTeacherUid: T })));      // (1)
await assertFails(addDoc(postsCol, mkPost({ categoryId: CAT, boardTeacherUid: null })));        // (2)
await assertSucceeds(addDoc(postsCol, mkPost({ categoryId: PUB, boardTeacherUid: null })));     // (3)
await assertFails(addDoc(postsCol, mkPost({ categoryId: PUB, boardTeacherUid: 'x' })));         // (4)
// mkPost(): 기존 validPost 필수 필드(title/categoryId/ownerUid=본인/authorName/code/prompt/createdAt) + boardTeacherUid
```

- [ ] **Step 2: 배포 전이라 실패 확인** — Run: `node scripts/selftest-board-privacy.mjs`. Expected: (1)(3)이 실패(현 규칙은 `boardTeacherUid` 키를 `hasOnly` 화이트리스트에 없어 거부) → 케이스 불일치로 FAIL.

- [ ] **Step 3: 타입에 필드 추가** — `lib/firebase/types.ts`의 `Post`에 추가(line 48 `forkCount?` 다음):

```ts
  /** 보드 소유자 비정규화: 공개 보드=null, 교실 보드=그 교사 uid. 읽기 권한 분기·목록 쿼리 인가용. 구버전 글엔 없음(마이그레이션 백필). */
  boardTeacherUid?: string | null;
```

- [ ] **Step 4: 규칙 — validPost 화이트리스트 + create 검증** — `firestore.rules`:

`validPost`(line 53) `hasOnly([...])` 배열에 `'boardTeacherUid'` 추가하고, 본문 끝(line 63 다음)에 검증 추가:

```
        && (d.boardTeacherUid == null || (d.boardTeacherUid is string && d.boardTeacherUid.size() <= 128))
```

카테고리 owner를 구하는 헬퍼를 `allowedForCat`(line 82) 아래에 추가:

```
    // 카테고리의 보드 소유자(teacherUid 없으면 null) — boardTeacherUid 위조 차단용.
    function catBoardOwner(catId) {
      let c = get(/databases/$(database)/documents/categories/$(catId)).data;
      return 'teacherUid' in c ? c.teacherUid : null;
    }
```

posts `create`(line 120, `categoryAllowed(...)` 뒤)에 boardTeacherUid 일치 강제 추가:

```
        && (isAdmin() || request.resource.data.boardTeacherUid == catBoardOwner(request.resource.data.categoryId));
```

> get(categories/catId)는 categoryAllowed와 같은 경로라 Firestore가 같은 평가 내에서 1회만 과금. budget(≤10) 이내.

- [ ] **Step 5: UploadDialog가 boardTeacherUid 채우게** — `components/board/UploadDialog.tsx`. `submit()`의 `createPost({...})`(line 140) 직전에 선택 카테고리의 teacherUid를 구하고 전달:

```ts
      const selectedCat = categories.find((c) => c.id === categoryId);
      const boardTeacherUid = selectedCat?.teacherUid ?? null;
      const postId = await createPost({
        title: title.trim(),
        categoryId,
        boardTeacherUid,
        ownerUid: user.uid,
        authorName: name,
        code,
        plan,
        prompt,
        createdAt: Date.now(),
        ...(forkedFrom ? { forkedFrom, forkedFromAuthor: forkedFromAuthor ?? '익명' } : {}),
      });
```

> `categories`는 이미 `subscribeCategories`로 전체(교사보드 포함) 구독 중(line 49)이라 학생의 교실 카테고리도 포함됨. 학생 보드(`studentBoard.boardId`)도 이 목록에 있으니 teacherUid가 잡힌다.

- [ ] **Step 6: 배포 + self-test 통과 확인** — Run:
```
firebase deploy --only firestore:rules --project test-ai-builder
node scripts/selftest-board-privacy.mjs
```
Expected: (1)(2)(3)(4) 모두 기대대로(PASS). 그 후 `./node_modules/.bin/tsc --noEmit` PASS.

- [ ] **Step 7: 커밋**
```
git add ai-program-generator/lib/firebase/types.ts ai-program-generator/firestore.rules ai-program-generator/components/board/UploadDialog.tsx
git commit -m "feat(board): boardTeacherUid 비정규화 + create 위조 차단(읽기는 공개 유지)"
```

---

## Task B: 마이그레이션 백필 + 학생 클레임 (`classTeacherUid`)

**Files:**
- Modify: `app/api/teacher/students/route.ts:85`(setCustomUserClaims)
- Create: `scripts/migrate-board-privacy.mjs` (미커밋 1회 스크립트)

- [ ] **Step 1: 신규 학생 클레임에 classTeacherUid** — `app/api/teacher/students/route.ts` line 85 교체:

```ts
      await adminAuth.setCustomUserClaims(user.uid, { student: true, classTeacherUid: gate.uid });
```

> 교사는 읽기 규칙에서 `request.auth.uid`로 판정하므로 별도 클레임 불필요.

- [ ] **Step 2: 마이그레이션 스크립트 작성** — `scripts/migrate-board-privacy.mjs` (미커밋). Admin SDK로:

```js
// 1) 모든 카테고리 teacherUid 맵 적재
const catSnap = await db.collection('categories').get();
const catOwner = new Map(catSnap.docs.map((d) => [d.id, d.data().teacherUid ?? null]));
// 2) 모든 posts에 boardTeacherUid 백필(없는 문서만) — 450건 배치
const posts = await db.collection('posts').get();
let batch = db.batch(), n = 0, total = 0;
for (const d of posts.docs) {
  if (d.data().boardTeacherUid !== undefined) continue;
  batch.update(d.ref, { boardTeacherUid: catOwner.get(d.data().categoryId) ?? null });
  if (++n === 450) { await batch.commit(); batch = db.batch(); total += n; n = 0; }
}
if (n) { await batch.commit(); total += n; }
console.log('posts 백필:', total);
// 3) 모든 students에 classTeacherUid 클레임 부여(기존 클레임 보존 머지)
const students = await db.collection('students').get();
for (const d of students.docs) {
  const cur = (await admin.auth().getUser(d.id)).customClaims ?? {};
  await admin.auth().setCustomUserClaims(d.id, { ...cur, classTeacherUid: d.data().teacherUid });
}
console.log('students 클레임:', students.size, '— 학생들은 재로그인 1회 필요');
```

- [ ] **Step 3: 실행 + 검증** — Run: `node scripts/migrate-board-privacy.mjs`. Expected: posts 백필 수·students 클레임 수 출력. 임의 post 한 건 `boardTeacherUid` 채워졌는지, 임의 student `customClaims.classTeacherUid` 설정됐는지 Admin SDK로 확인(스크립트 끝에 1건 dump).

- [ ] **Step 4: 재로그인 안내 카피 추가** — `components/auth/AuthProvider.tsx` 또는 학생용 안내 위치에, classTeacherUid 클레임 없는 학생 로그인 시 토스트: "우리 반 게시판을 보려면 한 번 더 로그인해 주세요." (구체 위치는 AuthProvider의 토큰 클레임 확인부; `getIdTokenResult().claims.classTeacherUid` 없으면 안내.) tsc PASS 확인.

- [ ] **Step 5: 커밋**(스크립트는 미커밋 유지)
```
git add ai-program-generator/app/api/teacher/students/route.ts ai-program-generator/components/auth/AuthProvider.tsx
git commit -m "feat(board): 학생 classTeacherUid 클레임 발급 + 재로그인 안내"
```

---

## Task C: 쿼리 + 인덱스 전환 + 브라우징 멤버십 필터

**Files:**
- Modify: `lib/firebase/posts.ts:37-53`(fetchPosts)
- Modify: `firestore.indexes.json`
- Modify: `components/board/BoardView.tsx`(카테고리 필터 + fetchPosts 인자)
- Test: `scripts/selftest-board-privacy.mjs`(쿼리 케이스 추가)

- [ ] **Step 1: fetchPosts에 boardTeacherUid 필터** — `lib/firebase/posts.ts` `fetchPosts`(line 37) 시그니처·쿼리 변경:

```ts
export async function fetchPosts(
  categoryId: string,
  boardTeacherUid: string | null,
  cursor?: PostCursor,
): Promise<PostsPage> {
  const base = [
    where('categoryId', '==', categoryId),
    where('boardTeacherUid', '==', boardTeacherUid),
    orderBy('createdAt', 'desc'),
  ] as const;
  const q = cursor
    ? query(collection(db, COL), ...base, startAfter(cursor), limit(PAGE_SIZE))
    : query(collection(db, COL), ...base, limit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Post),
    cursor: snap.docs[snap.docs.length - 1] ?? null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}
```

- [ ] **Step 2: 인덱스 교체** — `firestore.indexes.json`의 첫 인덱스(categoryId+createdAt)를 교체:

```json
{
  "collectionGroup": "posts",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "categoryId", "order": "ASCENDING" },
    { "fieldPath": "boardTeacherUid", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
(ownerUid+createdAt 인덱스는 그대로 둔다 — fetchMyPosts용.)

- [ ] **Step 3: BoardView가 멤버십으로 카테고리 필터 + teacherUid 전달** — `components/board/BoardView.tsx`. (a) `useAuth()`에서 `user`·`isTeacher`·`isStudent`와 토큰 클레임을 가져오고, 카테고리 목록을 멤버십으로 거른다:

```ts
// classTeacherUid 클레임(학생) 또는 본인 uid(교사)와 일치하는 교사보드 + 모든 공개보드만 노출
const visibleCategories = categories.filter(
  (c) => !c.teacherUid || c.teacherUid === user?.uid || c.teacherUid === myClassTeacherUid,
);
```
(b) `fetchPosts(categoryId, cursor)` 호출부를 `fetchPosts(categoryId, selectedCat?.teacherUid ?? null, cursor)`로 변경. `myClassTeacherUid`는 `user.getIdTokenResult()`의 `claims.classTeacherUid`(없으면 undefined).

- [ ] **Step 4: self-test에 쿼리 케이스 추가** — `scripts/selftest-board-privacy.mjs`:

```js
// 시드: 교사 T 교실글 1개(boardTeacherUid=T), 공개글 1개(boardTeacherUid=null)
// (a) 그 반 학생 S(classTeacherUid=T claim)로 where(categoryId=CAT, boardTeacherUid=T) → 성공·1건
// (b) 비회원/다른반 학생으로 같은 쿼리 → 거부(규칙은 D에서 조임; C 단계선 아직 공개라 통과 — D self-test에서 거부 확인)
// (c) 누구나 where(categoryId=PUB, boardTeacherUid=null) → 성공
await assertSucceeds(getDocs(query(postsCol, where('categoryId','==',CAT), where('boardTeacherUid','==',T), orderBy('createdAt','desc'))));  // (a)
await assertSucceeds(getDocs(query(postsCol, where('categoryId','==',PUB), where('boardTeacherUid','==',null), orderBy('createdAt','desc')))); // (c)
```

- [ ] **Step 5: 인덱스 배포 + 검증** — Run:
```
firebase deploy --only firestore:indexes --project test-ai-builder
node scripts/selftest-board-privacy.mjs
./node_modules/.bin/tsc --noEmit
```
Expected: 인덱스 빌드 완료 후 쿼리 PASS, tsc PASS. (인덱스 빌드는 수 분 걸릴 수 있음 — 콘솔에서 Enabled 확인 후 self-test.)

- [ ] **Step 6: 커밋**
```
git add ai-program-generator/lib/firebase/posts.ts ai-program-generator/firestore.indexes.json ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(board): boardTeacherUid 필터 쿼리·인덱스·브라우징 멤버십 필터"
```

---

## Task D: 읽기 규칙 교실-비공개로 조이기

**Files:**
- Modify: `firestore.rules:115`(posts read)
- Test: `scripts/selftest-board-privacy.mjs`(읽기 거부 케이스)

- [ ] **Step 1: self-test에 읽기 거부 케이스 추가** — `scripts/selftest-board-privacy.mjs`:

```js
// 교실글 doc(CAT, boardTeacherUid=T) 단건 읽기:
await assertSucceeds(getDoc(doc(postsCol, classroomPostId)));      // 그 반 학생 S
await assertSucceeds(getDoc(doc(postsCol, classroomPostId)));      // 교사 T 본인(별도 로그인)
await assertFails(getDoc(doc(postsCol, classroomPostId)));         // 다른 반 학생 / 비로그인
await assertSucceeds(getDoc(doc(postsCol, publicPostId)));         // 공개글은 누구나
// 또한 비회원이 교실 쿼리 시 거부:
await assertFails(getDocs(query(postsCol, where('categoryId','==',CAT), where('boardTeacherUid','==',T), orderBy('createdAt','desc'))));
```

- [ ] **Step 2: 배포 전 실패 확인** — Run: `node scripts/selftest-board-privacy.mjs`. Expected: 현 규칙(`allow read: if true`)이라 거부 케이스가 통과해버려 FAIL.

- [ ] **Step 3: 읽기 규칙 분기** — `firestore.rules` posts `allow read`(line 115) 교체:

```
      // 공개 보드(boardTeacherUid=null/없음)는 누구나. 교실 보드는 그 교사·그 반 학생·관리자만.
      // .get(...,null)로 구버전(필드 없는) 글은 공개로 취급(마이그레이션 전 안전망).
      allow read: if resource.data.get('boardTeacherUid', null) == null
        || isAdmin()
        || resource.data.get('boardTeacherUid', null) == request.auth.uid
        || (isSignedIn() && resource.data.get('boardTeacherUid', null) == request.auth.token.get('classTeacherUid', ''));
```

- [ ] **Step 4: 배포 + self-test 통과** — Run:
```
firebase deploy --only firestore:rules --project test-ai-builder
node scripts/selftest-board-privacy.mjs
```
Expected: 모든 읽기 케이스 기대대로 PASS(그 반 학생·교사·admin 허용, 다른 반·비로그인 거부, 공개 누구나).

- [ ] **Step 5: 커밋**
```
git add ai-program-generator/firestore.rules
git commit -m "feat(board): 교실 보드 읽기 비공개화(그 교사+그 반 학생만)"
```

---

## Task E: 미리보기 공개 GET 게이트(교실 글 누출 차단)

**Files:**
- Modify: `app/api/preview/post/[id]/route.ts:41-58`
- Modify: `components/ui/FullscreenFrame.tsx`(또는 BoardView 호출부) — 교실 글은 POST 경로 사용

- [ ] **Step 1: 공개 GET이 교실 글 거부** — `app/api/preview/post/[id]/route.ts`, post 조회부(line 43)에서 `boardTeacherUid`가 있으면(=교실 글) 404:

```ts
    const snap = await adminDb.collection('posts').doc(id).get();
    const data = snap.data();
    if (snap.exists && data && data.boardTeacherUid) {
      // 교실 글은 공개 GET으로 서빙하지 않는다(누출 차단). 멤버는 POST /api/preview 경로로.
      return new Response(
        '<p style="font-family:sans-serif;color:#888;text-align:center;margin-top:3em">미리보기를 찾을 수 없어요.</p>',
        { status: 404, headers: SECURITY_HEADERS },
      );
    }
    if (snap.exists && isCode(data?.code)) code = data!.code as GeneratedCode;
```

- [ ] **Step 2: 교실 글은 멤버 POST 경로로 미리보기** — `components/board/BoardView.tsx`에서 게시물 미리보기를 띄울 때, `post.boardTeacherUid`가 있으면 `FullscreenFrame`에 `postId`를 넘기지 말고 `code`만 넘긴다(→ FullscreenFrame이 로그인 토큰으로 `POST /api/preview` 경로 사용, [FullscreenFrame.tsx:100](../../components/ui/FullscreenFrame.tsx#L100) 분기). 공개 글은 기존대로 `postId` 전달(공개 GET).

```ts
// BoardView에서 선택 게시물 렌더 시:
<FullscreenFrame
  code={post.code}
  title={post.title}
  postId={post.boardTeacherUid ? undefined : post.id}   // 교실 글이면 즉석 POST 경로
  frameKey={post.id}
/>
```

- [ ] **Step 3: 검증(브라우저)** — dev 서버 띄우고: 공개 글 미리보기 정상, 교실 글을 멤버로 로그인해 미리보기 정상, 비멤버는 보드에서 교실 글 자체가 안 보임. `app/api/preview/post/<교실글id>` 직접 호출 시 404. tsc+build PASS.
```
./node_modules/.bin/tsc --noEmit && npm run build
```

- [ ] **Step 4: 커밋**
```
git add ai-program-generator/app/api/preview/post/[id]/route.ts ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(board): 교실 글 미리보기 공개 GET 차단·멤버 POST 경로 사용"
```

---

## Task F: 최종 배포 + 전체 회귀 self-test

- [ ] **Step 1: 규칙·인덱스 최종 배포**
```
firebase deploy --only firestore:rules,firestore:indexes --project test-ai-builder
```

- [ ] **Step 2: 전체 self-test 통과** — Run: `node scripts/selftest-board-privacy.mjs` (전 케이스) + 기존 `node scripts/selftest-integrity.mjs`(회귀: 공개 글 create/read·신고 정합성 그대로). Expected: 모두 PASS.

- [ ] **Step 3: 빌드 + 수동 회귀** — `./node_modules/.bin/tsc --noEmit && npm run build`. 브라우저: 공개 보드 브라우징·페이지네이션 정상, 학생이 우리 반 보드 보임·올림 정상, 로그아웃 시 교실 보드 안 보임.

- [ ] **Step 4: 마무리** — self-test/마이그레이션 스크립트는 미커밋(`??`) 유지. PR 생성(`fix/board-privacy` 등). 학생·교사 **재로그인 1회 필요** 릴리스 노트 명시.

---

## Self-Review (작성자 점검)

**Spec coverage:** 스펙 §4.1(읽기 모델)=Task A·D, §4.2(클레임·마이그레이션)=Task B, §4.3(브라우징)=Task C, §4.4(미리보기)=Task E. §4.5(공유 PIN)=Plan 2(범위 밖, 명시). ✅
**순서 안전성:** A(create만)→B(백필)→C(쿼리/인덱스)→D(읽기 조임)→E(미리보기). D가 B/C 뒤라 라이브 보드 안 깨짐. ✅
**타입 일관성:** `boardTeacherUid: string|null`(types·rules·createPost·fetchPosts·migration 동일), 클레임 `classTeacherUid`(발급·마이그레이션·규칙 `request.auth.token.get('classTeacherUid','')`·BoardView 동일). ✅
**규칙 get 예산:** create는 categoryAllowed + catBoardOwner가 같은 categories 경로(1회 과금) + isStudentOf(students) ≤ 3 get. ✅
**알려진 한계:** 구버전 글은 `.get(...,null)`로 공개 취급(백필 전 안전망) — 백필 후 전부 명시값. 학생 재로그인 전까지 교실 보드 미표시(안내 토스트로 완화).

## Plan 2 예고 (공유링크 관람 PIN)

`teachers/{uid}.viewPinHash` + 교사 콘솔 관람 PIN 설정 UI + `/share/[postId]` 페이지 + `POST /api/share/[postId]`(PIN 검증·레이트리밋·단기 previews 문서 생성) + 보기 전용 렌더. Plan 1 머지 후 별도 플랜으로 작성.
