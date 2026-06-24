# categoryId·신고 정합성 규칙 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 클라이언트가 임의로 채우던 `reports.postOwnerUid`와 `posts.categoryId`를 firestore.rules의 교차문서 검증(get/exists)으로 강제해 위조·무단 투입을 차단한다.

**Architecture:** 규칙만 변경(클라 코드 변경 0). 헬퍼 4개 추가 후 posts/reports의 create 규칙에 검증을 덧붙인다. 규칙은 Admin SDK로 검증 불가(우회)하므로 클라이언트 SDK self-test로 실제 규칙에 쓰기 시도/거부를 확인한다.

**Tech Stack:** Firestore Security Rules v2, Firebase CLI(`firebase deploy --only firestore:rules`), 검증용 firebase-admin(시드/토큰) + firebase 클라이언트 SDK(규칙 적용 쓰기).

**공통:** git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`. 브랜치 `feat/integrity-rules`. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. **tsc/build 불필요**(규칙만 변경). 클라 코드 변경 없음.

---

### Task 1: firestore.rules — 헬퍼 + create 규칙 강화

**Files:** Modify `ai-program-generator/firestore.rules`

- [ ] **Step 1: 헬퍼 4개 추가.** `validPost` 함수의 닫는 `}`(현재 58행) 바로 다음, `// 카테고리(게시판)` 주석(현재 60행) 앞에 삽입:
```
    // 신고의 postOwnerUid가 실제 글 주인과 일치하는지(위조 차단). 글이 없으면 거부.
    function postOwnerMatches(postId, ownerUid) {
      return exists(/databases/$(database)/documents/posts/$(postId))
        && get(/databases/$(database)/documents/posts/$(postId)).data.ownerUid == ownerUid;
    }

    // 이 카테고리에 글을 쓸 수 있는지: 존재 + (공개보드 | 그 교사 | 그 교사 학생).
    function categoryAllowed(catId, uid) {
      return exists(/databases/$(database)/documents/categories/$(catId))
        && allowedForCat(get(/databases/$(database)/documents/categories/$(catId)).data, uid);
    }
    function allowedForCat(cat, uid) {
      return !('teacherUid' in cat)
        || cat.teacherUid == uid
        || isStudentOf(uid, cat.teacherUid);
    }
    function isStudentOf(uid, teacherUid) {
      return exists(/databases/$(database)/documents/students/$(uid))
        && get(/databases/$(database)/documents/students/$(uid)).data.teacherUid == teacherUid;
    }
```

- [ ] **Step 2: posts create에 categoryId 검증 추가.** 다음 블록을(현재 88–91행)
```
      allow create: if isSignedIn()
        && (isAdmin() || isVerified() || isRoleAccount())
        && request.resource.data.ownerUid == request.auth.uid
        && validPost(request.resource.data);
```
다음으로 교체:
```
      allow create: if isSignedIn()
        && (isAdmin() || isVerified() || isRoleAccount())
        && request.resource.data.ownerUid == request.auth.uid
        && validPost(request.resource.data)
        && (isAdmin() || categoryAllowed(request.resource.data.categoryId, request.auth.uid));
```

- [ ] **Step 3: reports create에 owner 정합성 추가.** 다음 블록을(현재 166–173행)
```
      allow create: if isSignedIn()
        && request.resource.data.reporterUid == request.auth.uid
        && reportId == request.resource.data.postId + '_' + request.auth.uid
        && request.resource.data.keys().hasOnly(['postId','postTitle','postAuthorName','postOwnerUid','reporterUid','reason','memo','createdAt'])
        && request.resource.data.postId is string
        && request.resource.data.reason is string && request.resource.data.reason.size() <= 20
        && (!('memo' in request.resource.data) || (request.resource.data.memo is string && request.resource.data.memo.size() <= 500))
        && request.resource.data.createdAt is number;
```
다음으로 교체(마지막 `;`를 옮기고 검증 한 줄 추가):
```
      allow create: if isSignedIn()
        && request.resource.data.reporterUid == request.auth.uid
        && reportId == request.resource.data.postId + '_' + request.auth.uid
        && request.resource.data.keys().hasOnly(['postId','postTitle','postAuthorName','postOwnerUid','reporterUid','reason','memo','createdAt'])
        && request.resource.data.postId is string
        && request.resource.data.reason is string && request.resource.data.reason.size() <= 20
        && (!('memo' in request.resource.data) || (request.resource.data.memo is string && request.resource.data.memo.size() <= 500))
        && request.resource.data.createdAt is number
        && postOwnerMatches(request.resource.data.postId, request.resource.data.postOwnerUid);
```
(reports **update** 규칙은 변경 없음 — 이미 `postOwnerUid`/`postId` 불변 강제.)

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/firestore.rules
git -C "C:/Users/amh47/Documents/test" commit -m "feat(rules): 신고 owner 정합성 + 교사 게시판 보호(categoryId 교차검증)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 클라이언트 SDK self-test 작성

**Files:** Create `ai-program-generator/scripts/selftest-integrity.mjs` (미커밋)

- [ ] **Step 1: 작성.** Admin SDK로 시드/토큰, 클라이언트 SDK로 실제 규칙에 쓰기 시도. 전체 코드:
```js
// 정합성 규칙 검증: 신고 owner 위조 차단 + 교사 게시판 보호. 클라이언트 SDK로 실제 규칙에 쓰기 시도.
// 사전: firebase deploy --only firestore:rules --project test-ai-builder. 사용: node scripts/selftest-integrity.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { initializeApp as initClient } from 'firebase/app';
import { getAuth as getClientAuth, signInWithCustomToken } from 'firebase/auth';
import { getFirestore as getClientDb, doc, setDoc } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
initAdmin({ credential: cert(sa) });
const adminAuth = getAdminAuth();
const adb = getAdminDb();
const clientApp = initClient({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const cauth = getClientAuth(clientApp);
const cdb = getClientDb(clientApp);

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const T = 'selftest-int-teacher';
const T2 = 'selftest-int-teacher2';
const S1 = 'selftest-int-student1'; // T 산하
const S2 = 'selftest-int-student2'; // T2 산하 (외부인 역할)
const PUB = 'selftest-int-cat-public';
const TB = 'selftest-int-cat-board'; // T의 교사 게시판
const P = 'selftest-int-post'; // S1 소유, categoryId=TB
const POSTS = [P, 'selftest-int-s1tb', 'selftest-int-ttb', 'selftest-int-s2pub', 'selftest-int-s2tb', 'selftest-int-s2none'];
const REPORTS = [`${P}_${S2}`];

function postDoc(ownerUid, categoryId) {
  return { title: '테스트 작품', categoryId, ownerUid, authorName: '테스트', code: { html: '<p>hi</p>', css: '', javascript: '' }, prompt: '', createdAt: Date.now() };
}
function reportDoc(ownerUid) {
  return { postId: P, postTitle: 'x', postAuthorName: 'x', postOwnerUid: ownerUid, reporterUid: S2, reason: '나쁨', createdAt: Date.now() };
}
async function signIn(uid, claims) {
  const t = await adminAuth.createCustomToken(uid, claims);
  await signInWithCustomToken(cauth, t);
}
async function tryWrite(label, fn, expectAllowed) {
  try {
    await fn();
    check(label, expectAllowed === true, expectAllowed ? '' : '허용됨(거부 기대)');
  } catch (e) {
    const denied = e?.code === 'permission-denied';
    check(label, expectAllowed === false && denied, `code=${e?.code}`);
  }
}
async function cleanup() {
  for (const uid of [T, T2, S1, S2]) {
    await adminAuth.deleteUser(uid).catch(() => {});
    await adb.doc(`teachers/${uid}`).delete().catch(() => {});
    await adb.doc(`students/${uid}`).delete().catch(() => {});
  }
  for (const c of [PUB, TB]) await adb.doc(`categories/${c}`).delete().catch(() => {});
  for (const p of POSTS) await adb.doc(`posts/${p}`).delete().catch(() => {});
  for (const r of REPORTS) await adb.doc(`reports/${r}`).delete().catch(() => {});
}

async function main() {
  await cleanup();
  // 시드 (Admin = 규칙 우회)
  for (const [t] of [[T], [T2]]) {
    await adminAuth.createUser({ uid: t, email: `${t}@class.kr` });
    await adminAuth.setCustomUserClaims(t, { teacher: true });
    await adb.doc(`teachers/${t}`).set({ name: t, totalQuota: 100, usedTotal: 0, createdAt: Date.now() });
  }
  for (const [s, t] of [[S1, T], [S2, T2]]) {
    await adminAuth.createUser({ uid: s, email: `${s}@class.kr` });
    await adminAuth.setCustomUserClaims(s, { student: true });
    await adb.doc(`students/${s}`).set({ teacherUid: t, name: s, limitType: 'daily', limitValue: 5, usedTotal: 0, createdAt: Date.now() });
  }
  await adb.doc(`categories/${PUB}`).set({ name: '공개', order: 1, createdAt: Date.now() });
  await adb.doc(`categories/${TB}`).set({ name: 'T반', order: 2, createdAt: Date.now(), teacherUid: T });
  await adb.doc(`posts/${P}`).set(postDoc(S1, TB));

  // S2 (외부인 = T2 학생)
  await signIn(S2, { student: true });
  await tryWrite('신고 owner 위조 거부', () => setDoc(doc(cdb, 'reports', `${P}_${S2}`), reportDoc(S2)), false);
  await tryWrite('신고 정상 owner 허용', () => setDoc(doc(cdb, 'reports', `${P}_${S2}`), reportDoc(S1)), true);
  await tryWrite('외부인 교사보드 작성 거부', () => setDoc(doc(cdb, 'posts', 'selftest-int-s2tb'), postDoc(S2, TB)), false);
  await tryWrite('공개 게시판 작성 허용', () => setDoc(doc(cdb, 'posts', 'selftest-int-s2pub'), postDoc(S2, PUB)), true);
  await tryWrite('없는 카테고리 거부', () => setDoc(doc(cdb, 'posts', 'selftest-int-s2none'), postDoc(S2, 'no-such-category')), false);

  // S1 (T 학생) — 교사보드 허용
  await signIn(S1, { student: true });
  await tryWrite('그 교사 학생 교사보드 허용', () => setDoc(doc(cdb, 'posts', 'selftest-int-s1tb'), postDoc(S1, TB)), true);

  // T (교사 본인) — 자기 보드 허용
  await signIn(T, { teacher: true });
  await tryWrite('교사 본인 교사보드 허용', () => setDoc(doc(cdb, 'posts', 'selftest-int-ttb'), postDoc(T, TB)), true);

  await cleanup();
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 미커밋 확인.** 이 스크립트는 커밋하지 않는다(`git status`에서 `?? scripts/selftest-integrity.mjs`).

---

### Task 3: 규칙 배포 + self-test 실행 (검증)

**Files:** 없음(배포·실행)

- [ ] **Step 1: 규칙 배포(프로덕션 — 하위호환).**
  Run: `cd ai-program-generator && firebase deploy --only firestore:rules --project test-ai-builder`
  Expected: `✔  Deploy complete!` (rules compile 성공). 컴파일 에러 시 Task 1 규칙 문법 수정 후 재배포.

- [ ] **Step 2: self-test 실행.**
  Run: `cd ai-program-generator && node scripts/selftest-integrity.mjs`
  Expected: 7개 체크 모두 ✅ → `결과: 7 통과, 0 실패`.
  - 신고 owner 위조 거부 / 신고 정상 owner 허용 / 외부인 교사보드 작성 거부 / 공개 게시판 작성 허용 / 없는 카테고리 거부 / 그 교사 학생 교사보드 허용 / 교사 본인 교사보드 허용.
  - 실패 시: 규칙 로직 수정(Task 1) → 재배포(Step 1) → 재실행.

- [ ] **Step 3: 회귀 확인(기존 정상 흐름 안 깨짐).** Step 2의 "허용" 케이스(공개 게시판 작성·교사보드 정상 작성·정상 신고)가 통과 = 정상 사용자 하위호환 확인.

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- 신고 owner 정합성(get posts.ownerUid==postOwnerUid) → Task 1 Step 3 + 헬퍼. ✓
- 교사 게시판 보호(존재 + 공개|교사|그학생, admin 예외) → Task 1 Step 2 + 헬퍼. ✓
- 규칙 함수 ≤10 get/exists(최악 4) → 헬퍼가 데이터 인자 전달로 재조회 최소화. ✓
- 클라 코드 변경 없음 → 플랜에 코드 변경 태스크 없음. ✓
- 클라이언트 SDK self-test(위조 거부·정상 허용·외부인 거부·존재안함 거부) → Task 2 + Task 3. ✓
- 배포 + 검증 → Task 3. ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 규칙·스크립트 전체 코드 제시. ✓

**3. Type/이름 일관성:**
- 헬퍼명 `postOwnerMatches`/`categoryAllowed`/`allowedForCat`/`isStudentOf` — Task1 정의, posts/reports create 호출과 일치. ✓
- self-test의 시드 필드(students.teacherUid, categories.teacherUid)·doc 경로가 규칙 get() 경로와 일치. ✓
- `permission-denied` 코드 판정(클라 SDK FirebaseError.code) 정확. ✓
- 교사보드 분기: `cat.teacherUid == uid`(교사 본인) + `isStudentOf`(그 학생) — self-test의 S1(허용)/S2(거부)/T(허용) 케이스로 커버. ✓
