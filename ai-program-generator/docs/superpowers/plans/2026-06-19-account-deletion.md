# 회원탈퇴(A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 일반 회원이 마이페이지에서 본인 계정과 모든 작품을 영구 삭제(회원탈퇴)할 수 있게 한다.

**Architecture:** 관리자 삭제 라우트의 캐스케이드 로직을 서버 공유 헬퍼 `deleteAccountCascade(uid)`로 추출(DRY). 신규 `DELETE /api/me`가 본인 ID 토큰을 검증해 admin이면 403, 아니면 헬퍼로 삭제. 마이페이지에 ConfirmDialog 1회 → `signOut` → 홈 이동 버튼(관리자에겐 숨김).

**Tech Stack:** Next.js 15 App Router(route handler, `runtime='nodejs'`), Firebase Admin SDK(Auth/Firestore), Firebase client SDK(`signOut`), 기존 `ConfirmProvider`/`useToast`. 테스트 프레임워크 없음 — 검증은 `tsc --noEmit` + `npm run build` + 일회성 self-test 스크립트.

**참고:** 모든 명령은 `ai-program-generator/`에서 실행. dev 서버 실행 중엔 `npm run build` 금지(.next 공유) — 빌드는 dev 정지 후. tsc는 `./node_modules/.bin/tsc --noEmit`로 dev와 무관하게 안전.

---

### Task 1: `deleteAccountCascade` 헬퍼 추출 + 관리자 라우트 리팩터

**Files:**
- Create: `ai-program-generator/lib/server/deleteAccount.ts`
- Modify: `ai-program-generator/app/api/admin/users/[uid]/route.ts` (import 줄 2, DELETE 인라인 블록 75–90)

- [ ] **Step 1: 헬퍼 파일 생성**

`ai-program-generator/lib/server/deleteAccount.ts`:

```ts
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * uid의 모든 흔적을 삭제한다: Firestore(작품·닉네임·users·limits)를 먼저 지우고
 * (중간 실패 시 고아 닉네임 방지), Auth 계정을 마지막에 삭제.
 * usage 날짜문서·다른 글의 likes/views·본인이 낸 reports는 삭제하지 않는다(관리자 삭제와 동일, 무해·경미).
 */
export async function deleteAccountCascade(uid: string): Promise<void> {
  const refs: FirebaseFirestore.DocumentReference[] = [];
  const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
  posts.forEach((d) => refs.push(d.ref));
  const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
  nicks.forEach((d) => refs.push(d.ref));
  refs.push(adminDb.doc(`users/${uid}`));
  refs.push(adminDb.doc(`limits/${uid}`));
  for (let i = 0; i < refs.length; i += 450) {
    const batch = adminDb.batch();
    refs.slice(i, i + 450).forEach((r) => batch.delete(r));
    await batch.commit();
  }
  await adminAuth.deleteUser(uid);
}
```

- [ ] **Step 2: 관리자 라우트가 헬퍼를 쓰도록 수정**

`ai-program-generator/app/api/admin/users/[uid]/route.ts` 상단 import에 헬퍼 추가하고, `adminDb`는 더 이상 이 파일에서 직접 안 쓰므로 import에서 제거(PATCH는 `adminAuth`+`setUserLimit`/`clearUserLimit`만 사용).

2번째 줄을:
```ts
import { adminAuth, adminDb } from '@/lib/firebase/admin';
```
다음으로 교체:
```ts
import { adminAuth } from '@/lib/firebase/admin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';
```

그리고 DELETE 핸들러의 try 블록(현재 75–90줄, "1) Firestore 먼저 …" 주석부터 "await adminAuth.deleteUser(uid);"까지)을 다음으로 교체:

```ts
  try {
    const blocked = await blockIfAdminTarget(uid);
    if (blocked) return blocked;

    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('계정 삭제 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
```

- [ ] **Step 3: 타입체크 (동작 동일, 컴파일 확인)**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 출력 없이 종료(에러 0). `adminDb` 미사용 에러가 없어야 함(import에서 뺐으므로).

- [ ] **Step 4: 커밋**

```bash
git add ai-program-generator/lib/server/deleteAccount.ts "ai-program-generator/app/api/admin/users/[uid]/route.ts"
git commit -m "refactor(account): 계정 삭제 캐스케이드를 deleteAccountCascade 헬퍼로 추출"
```

---

### Task 2: `DELETE /api/me` 라우트 + self-test

**Files:**
- Create: `ai-program-generator/app/api/me/route.ts`
- Create: `ai-program-generator/scripts/selftest-account-delete.mjs` (미커밋 — 일회성)

- [ ] **Step 1: self-test 스크립트 작성(먼저)**

`ai-program-generator/scripts/selftest-account-delete.mjs`:

```js
// 회원탈퇴 검증: 임시계정 생성→흔적 시드→DELETE /api/me→계정·문서 삭제 확인, 관리자→403.
// 사전: npm run dev 실행 중 + serviceAccountKey.json + .env.local.
// 사용: node scripts/selftest-account-delete.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3000';
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();

async function tokenFor(uid, claims) {
  const custom = await auth.createCustomToken(uid, claims);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  return d.idToken;
}

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const UID = 'selftest-delete-user';
const NICK = 'selftestdelnick';
const ADMIN_UID = 'selftest-delete-admin';

async function main() {
  await auth.deleteUser(UID).catch(() => {});
  await auth.deleteUser(ADMIN_UID).catch(() => {});

  // 임시 계정 + 토큰(signIn이 Auth 유저를 생성) + 흔적 시드
  const token = await tokenFor(UID);
  await db.doc(`users/${UID}`).set({ nickname: '탈퇴테스터' });
  await db.doc(`limits/${UID}`).set({ dailyLimit: 5 });
  await db.doc(`nicknames/${NICK}`).set({ uid: UID });
  const postRef = await db.collection('posts').add({ ownerUid: UID, title: '탈퇴테스트', createdAt: 1700000000000 });

  // 본인 탈퇴 → 200
  const res = await fetch(`${BASE}/api/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  check('DELETE /api/me → 200', res.status === 200, `status=${res.status}`);

  // Auth 계정 삭제 확인
  let gone = false;
  try { await auth.getUser(UID); } catch (e) { gone = e.code === 'auth/user-not-found'; }
  check('Auth 계정 삭제됨', gone);

  // Firestore 흔적 삭제 확인
  const [u, lim, nk, pst] = await Promise.all([
    db.doc(`users/${UID}`).get(), db.doc(`limits/${UID}`).get(),
    db.doc(`nicknames/${NICK}`).get(), postRef.get(),
  ]);
  check('users/limits/nickname/post 삭제됨', !u.exists && !lim.exists && !nk.exists && !pst.exists,
    `u=${u.exists} lim=${lim.exists} nk=${nk.exists} pst=${pst.exists}`);

  // 관리자 토큰 → 403
  const adminToken = await tokenFor(ADMIN_UID, { admin: true });
  const res2 = await fetch(`${BASE}/api/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  check('관리자 → DELETE /api/me 403', res2.status === 403, `status=${res2.status}`);

  // 정리(관리자는 403이라 안 지워짐)
  await auth.deleteUser(ADMIN_UID).catch(() => {});
  await db.doc(`nicknames/${NICK}`).delete().catch(() => {});

  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 실행 중 self-test 돌려 실패 확인(라우트 부재)**

dev 서버가 떠 있어야 함(없으면 `npm run dev`). 그 다음:

Run: `node scripts/selftest-account-delete.mjs`
Expected: FAIL — `DELETE /api/me → 200` 가 ❌(status=405 또는 404, 라우트 없음). 첫 체크가 실패해야 정상.

- [ ] **Step 3: 라우트 구현**

`ai-program-generator/app/api/me/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

// 본인 계정 탈퇴: 본인 ID 토큰으로 uid 확인 후 모든 흔적 삭제. 관리자 계정은 거부.
export async function DELETE(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.admin === true) {
      return NextResponse.json({ error: '관리자 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('회원 탈퇴 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: self-test 다시 돌려 통과 확인**

Run: `node scripts/selftest-account-delete.mjs`
Expected: PASS — 4개 체크 모두 ✅, `결과: 4 통과, 0 실패`.

- [ ] **Step 5: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 6: 커밋(self-test 스크립트는 제외 — 일회성)**

```bash
git add ai-program-generator/app/api/me/route.ts
git commit -m "feat(account): DELETE /api/me 본인 회원탈퇴 라우트(관리자 403)"
```

---

### Task 3: 클라이언트 헬퍼 + 마이페이지 "회원 탈퇴" 버튼

**Files:**
- Create: `ai-program-generator/lib/client/account.ts`
- Modify: `ai-program-generator/app/mypage/page.tsx` (import 줄들, `MyPage`의 useAuth·AccountCard 호출, `AccountCard` 시그니처·핸들러·버튼)

- [ ] **Step 1: 클라 헬퍼 생성**

`ai-program-generator/lib/client/account.ts`:

```ts
import { auth } from '@/lib/firebase/client';

/** 본인 계정 탈퇴 요청. 성공 시 호출부에서 signOut + 홈 이동. */
export async function deleteMyAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || '계정을 삭제하지 못했어요.');
}
```

- [ ] **Step 2: 마이페이지 import 추가**

`ai-program-generator/app/mypage/page.tsx`에서 `import { sendEmailVerification } from 'firebase/auth';` 줄을 다음으로 교체:

```ts
import { sendEmailVerification, signOut } from 'firebase/auth';
```

그리고 `import { useConfirm } from '@/components/ui/ConfirmProvider';` 줄 아래(또는 `useToast` import 근처)에 추가 — 이미 있으면 생략. 없으면 `import { useToast } from '@/components/ui/Toast';` 다음 줄에 추가:

```ts
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { deleteMyAccount } from '@/lib/client/account';
```

- [ ] **Step 3: `MyPage`에서 isAdmin을 AccountCard로 전달**

`const { user, loading } = useAuth();` 를:
```ts
const { user, loading, isAdmin } = useAuth();
```
로 바꾸고, AccountCard 호출을:
```tsx
<AccountCard uid={user.uid} email={user.email} createdAt={user.metadata?.creationTime} isAdmin={isAdmin} />
```
로 교체.

- [ ] **Step 4: `AccountCard` 시그니처에 isAdmin 추가**

`AccountCard` 함수의 props 타입에 `isAdmin: boolean`을 추가:
```tsx
function AccountCard({
  uid,
  email,
  createdAt,
  isAdmin,
}: {
  uid: string;
  email: string | null;
  createdAt?: string;
  isAdmin: boolean;
}) {
```

- [ ] **Step 5: AccountCard에 탈퇴 핸들러 추가**

`AccountCard` 본문에서 기존 `const { toast } = useToast();` 아래에 추가:

```tsx
  const router = useRouter();
  const confirm = useConfirm();
  const [withdrawing, setWithdrawing] = useState(false);

  async function withdraw() {
    const ok = await confirm({
      title: '정말 탈퇴할까요?',
      message: '계정과 만든 작품이 모두 영구 삭제돼요. 되돌릴 수 없어요.',
      confirmLabel: '탈퇴',
      danger: true,
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await deleteMyAccount();
      await signOut(auth);
      toast('탈퇴가 완료됐어요. 그동안 고마웠어요.', 'success');
      router.replace('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : '계정을 삭제하지 못했어요.');
      setWithdrawing(false);
    }
  }
```

(`useRouter`·`useState`는 파일 상단에서 이미 import됨.)

- [ ] **Step 6: 탈퇴 버튼 렌더(관리자엔 숨김)**

`AccountCard`의 `return (...)` 안에서, 미인증 배너 블록 다음·`<Modal open={editOpen} …>` 직전에 추가:

```tsx
      {!isAdmin && (
        <div className="mt-5 border-t border-line pt-4 text-right">
          <button
            type="button"
            onClick={withdraw}
            disabled={withdrawing}
            className="text-[13px] text-muted underline-offset-4 hover:text-coral-ink hover:underline disabled:opacity-50"
          >
            {withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}
          </button>
        </div>
      )}
```

- [ ] **Step 7: 타입체크 + 빌드**

dev 서버를 잠깐 정지(또는 stop)한 뒤:

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

Run: `rm -rf .next && npm run build`
Expected: 빌드 성공(`.next/BUILD_ID` 생성). `/mypage` 라우트·`/api/me` 라우트가 빌드 출력에 보임.

- [ ] **Step 8: 브라우저 — 관리자에겐 버튼 숨김 확인**

dev 재시작 후 관리자 계정으로 로그인된 상태에서 `/mypage` 접속 → 계정 카드에 **"회원 탈퇴" 버튼이 보이지 않아야** 함(관리자 차단 UX). 실제 삭제 동작은 Task 2 self-test로 이미 검증됨.

- [ ] **Step 9: 커밋**

```bash
git add ai-program-generator/lib/client/account.ts ai-program-generator/app/mypage/page.tsx
git commit -m "feat(account): 마이페이지 회원 탈퇴 버튼(관리자 숨김, 확인→로그아웃→홈)"
```

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- 공유 헬퍼 추출 → Task 1. ✓
- `DELETE /api/me`(401/403/200/500) → Task 2 Step 3. ✓
- 클라 헬퍼 `deleteMyAccount` → Task 3 Step 1. ✓
- 마이페이지 버튼(ConfirmDialog 1회·signOut·홈·관리자 숨김) → Task 3 Step 5–6. ✓
- 관리자 라우트 동작 보존(헬퍼 호출) → Task 1 Step 2. ✓
- 검증(tsc·빌드·self-test 200/403/문서삭제·브라우저 버튼숨김) → Task 1 S3, Task 2 S2·S4, Task 3 S7–S8. ✓
- 규칙 변경 없음 → 플랜에 규칙 작업 없음. ✓

**2. Placeholder scan:** "TODO/TBD/적절히" 없음. 모든 코드 블록 완전. ✓

**3. Type consistency:** `deleteAccountCascade(uid: string): Promise<void>`가 Task1 정의·Task2 라우트·Task1 admin라우트에서 동일 시그니처로 호출됨. `deleteMyAccount(): Promise<void>` Task3 정의·호출 일치. `confirm = useConfirm()`(fn 직접 반환) → `await confirm({...})` 시그니처 일치. `toast(msg, 'success')` 기존 사용과 일치. `isAdmin: boolean` prop 정의·전달 일치. ✓
