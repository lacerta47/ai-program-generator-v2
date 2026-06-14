# 비밀번호 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 이메일 가입자는 로그인창에서 재설정 메일을 받고, 수업용 합성 계정은 교사가 관리자 콘솔에서 새 비밀번호를 설정한다.

**Architecture:** 자기서비스는 Firebase `sendPasswordResetEmail`(클라 SDK, 백엔드 없음). 관리자 재설정은 B-2의 기존 `PATCH /api/admin/users/[uid]`에 `password` 처리를 더하고(`adminAuth.updateUser`), `patchUser` 클라 헬퍼와 `UserActionModal`에 섹션을 얹는다.

**Tech Stack:** Next.js 15 App Router, TS, firebase-admin(Auth updateUser), firebase client SDK(sendPasswordResetEmail), Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + custom-token self-test + 브라우저.

---

## File Structure

| 파일 | 책임 | 수정 |
|---|---|---|
| `app/api/admin/users/[uid]/route.ts` | PATCH에 `password` → `updateUser` | 수정 |
| `lib/admin/accounts.ts` | `patchUser` 바디에 `password?` | 수정 |
| `app/admin/users/page.tsx` | UserActionModal "비밀번호 재설정" 섹션 | 수정 |
| `components/auth/LoginDialog.tsx` | "비밀번호를 잊으셨어요?" → 재설정 메일 | 수정 |

**계약:** `patchUser(uid, { disabled?, dailyLimit?, password? })` — `password: string`(≥6)이면 `updateUser({password})`, 5자↓ → 400.

---

## Task 1: 관리자 비번 재설정 — API + 클라 헬퍼

**Files:**
- Modify: `ai-program-generator/app/api/admin/users/[uid]/route.ts` (PATCH password 처리)
- Modify: `ai-program-generator/lib/admin/accounts.ts` (patchUser 타입)

- [ ] **Step 1: PATCH 라우트에 password 블록 추가**

`app/api/admin/users/[uid]/route.ts`를 읽고, PATCH 핸들러의 body 캐스트를 확장. FROM:
```ts
  const b = body as { disabled?: unknown; dailyLimit?: unknown };
```
TO:
```ts
  const b = body as { disabled?: unknown; dailyLimit?: unknown; password?: unknown };
```
그리고 `if ('dailyLimit' in b) { ... }` 블록 **다음**, `return NextResponse.json({ ok: true });` **앞**에 추가:
```ts
    if ('password' in b) {
      if (typeof b.password === 'string' && b.password.length >= 6) {
        await adminAuth.updateUser(uid, { password: b.password });
      } else {
        return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
      }
    }
```
(admin 게이트는 기존대로. password는 비파괴적이라 `blockIfAdminTarget` 미적용.)

- [ ] **Step 2: `patchUser` 바디 타입에 password 추가**

`lib/admin/accounts.ts`의 `patchUser`를 읽고, 바디 타입을 확장. FROM:
```ts
export function patchUser(
  uid: string,
  body: { disabled?: boolean; dailyLimit?: number | null },
): Promise<{ ok: true }> {
```
TO:
```ts
export function patchUser(
  uid: string,
  body: { disabled?: boolean; dailyLimit?: number | null; password?: string },
): Promise<{ ok: true }> {
```
(함수 본문 변경 없음 — `authedFetch`가 body를 그대로 JSON으로 보냄.)

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add "ai-program-generator/app/api/admin/users/[uid]/route.ts" ai-program-generator/lib/admin/accounts.ts
git commit -m "feat(pw): 관리자 비번 재설정 API + 클라 헬퍼

PATCH /api/admin/users/[uid]에 password(updateUser, ≥6자). patchUser 타입 확장.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 관리자 비번 재설정 — UserActionModal 섹션

**Files:**
- Modify: `ai-program-generator/app/admin/users/page.tsx` (UserActionModal 비관리자 분기)

- [ ] **Step 1: 비번 입력 state 추가**

`app/admin/users/page.tsx`의 `UserActionModal` 함수에서 `const [limitInput, setLimitInput] = useState(...)` 다음에 추가:
```tsx
  const [pwInput, setPwInput] = useState('');
```

- [ ] **Step 2: "비밀번호 재설정" 섹션 추가**

비관리자 분기(삭제 섹션 `<div className="border-t border-line pt-3">` 으로 시작하는 블록) **바로 앞**에 추가:
```tsx
        <div>
          <p className="mb-1 text-[14px]">비밀번호 재설정</p>
          <div className="flex flex-wrap items-end gap-2">
            <TextInput
              type="password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              placeholder="새 비밀번호 (6자 이상)"
              className="w-44"
            />
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => {
                if (pwInput.length < 6) {
                  toast('비밀번호는 6자 이상이어야 해요.');
                  return;
                }
                act(() => patchUser(member.uid, { password: pwInput }), '비밀번호를 바꿨어요.');
              }}
            >
              재설정
            </Button>
          </div>
        </div>
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 브라우저 확인(가드)**

비로그인 `/admin/users` → 홈 리다이렉트. 콘솔 에러 0. (실제 재설정은 admin 로그인 + Task 4 self-test로.)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/app/admin/users/page.tsx
git commit -m "feat(pw): UserActionModal 비밀번호 재설정 섹션(학생 계정)

새 비번 입력(≥6, masked) → patchUser({password}).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 자기서비스 이메일 재설정 — LoginDialog

**Files:**
- Modify: `ai-program-generator/components/auth/LoginDialog.tsx`

- [ ] **Step 1: import에 sendPasswordResetEmail 추가**

`components/auth/LoginDialog.tsx`의 `firebase/auth` import를 교체. FROM:
```tsx
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
```
TO:
```tsx
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
```

- [ ] **Step 2: notice state + 재설정 핸들러 추가**

`const [error, setError] = useState('');` 다음에 추가:
```tsx
  const [notice, setNotice] = useState('');
```
그리고 `withEmail` 함수 다음에 핸들러 추가:
```tsx
  async function resetPw() {
    setError('');
    setNotice('');
    if (!email.trim()) {
      setError('이메일을 먼저 적어 주세요.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('가입된 이메일이면 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }
```

- [ ] **Step 3: notice 인라인 메시지 렌더 + 모드 전환 시 초기화**

폼 안의 error 블록 다음에 notice 블록 추가. FROM:
```tsx
          {error && (
            <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">
              {error}
            </p>
          )}
```
TO:
```tsx
          {error && (
            <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">
              {error}
            </p>
          )}
          {notice && (
            <p className="anim-pop-in rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[14px] text-mint-ink">
              {notice}
            </p>
          )}
```
그리고 모드 전환 버튼의 onClick에 `setNotice('')` 추가. FROM:
```tsx
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
```
TO:
```tsx
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setNotice('');
            }}
```

- [ ] **Step 4: "비밀번호를 잊으셨어요?" 링크 추가 (login 모드만)**

`</form>` 다음, 모드 전환 div(`<div className="mt-5 text-center">`) **앞**에 추가:
```tsx
        {mode === 'login' && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={resetPw}
              disabled={busy}
              className="text-[13px] text-muted underline-offset-4 hover:underline disabled:opacity-50"
            >
              비밀번호를 잊으셨어요?
            </button>
          </div>
        )}
```

- [ ] **Step 5: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 브라우저 확인**

dev 서버 → 로그인 다이얼로그 열기 → login 모드에 "비밀번호를 잊으셨어요?" 보임. 이메일 비우고 클릭 → "이메일을 먼저 적어 주세요." 이메일 입력 후 클릭 → "가입된 이메일이면 재설정 메일을 보냈어요…"(민트). signup 모드엔 링크 없음. (실제 메일 발송은 Firebase가 처리.)

- [ ] **Step 7: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/auth/LoginDialog.tsx
git commit -m "feat(pw): 로그인창 비밀번호 재설정 메일(자기서비스)

'비밀번호를 잊으셨어요?' → sendPasswordResetEmail. 안전 문구로 성공 안내.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: self-test + 빌드 + 푸시

**Files:**
- Create: `ai-program-generator/scripts/selftest-pwreset.mjs` (일회성, 커밋 안 함)

- [ ] **Step 1: dev 서버 실행 확인** (`localhost:3000`).

- [ ] **Step 2: self-test 스크립트 작성**

`ai-program-generator/scripts/selftest-pwreset.mjs`:
```javascript
// 관리자 비번 재설정 통합 self-test — 실행 중인 dev 서버(localhost:3000) 대상.
// 생성 계정은 끝에서 삭제. 실행: node scripts/selftest-pwreset.mjs
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'firebase/auth';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sa = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
initAdmin({ credential: cert(sa) });
const aAuth = getAdminAuth();
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const BASE = 'http://localhost:3000';
const S = Date.now();
const email = `pwreset-${S}@class.kr`;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK ', m); } else { fail++; console.log('  XX ', m); } };
async function adminToken() {
  await signOut(auth).catch(() => {});
  await signInWithCustomToken(auth, await aAuth.createCustomToken('pwreset-admin', { admin: true }));
  return auth.currentUser.getIdToken();
}
const patch = (tok, uid, body) => fetch(`${BASE}/api/admin/users/${uid}`, {
  method: 'PATCH', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

const student = await aAuth.createUser({ email, password: 'initpw123' });

try {
  // 1) admin이 학생 비번 재설정
  const adm = await adminToken();
  const r1 = await patch(adm, student.uid, { password: 'newpw123' });
  ok(r1.status === 200, `admin 비번 재설정 200 (got ${r1.status})`);

  // 2) 새 비번으로 로그인 성공
  await signOut(auth);
  await signInWithEmailAndPassword(auth, email, 'newpw123');
  ok(auth.currentUser?.uid === student.uid, '새 비번으로 로그인 성공');

  // 3) 5자 비번 → 400
  const adm2 = await adminToken();
  const r3 = await patch(adm2, student.uid, { password: '12345' });
  ok(r3.status === 400, `5자 비번 400 (got ${r3.status})`);

  // 4) 비admin → 403
  await signOut(auth);
  await signInWithCustomToken(auth, await aAuth.createCustomToken('pwreset-plain', {}));
  const userTok = await auth.currentUser.getIdToken();
  const r4 = await patch(userTok, student.uid, { password: 'newpw999' });
  ok(r4.status === 403, `비admin 비번 재설정 403 (got ${r4.status})`);
} catch (e) {
  fail++; console.error('스크립트 예외:', e);
} finally {
  try { await aAuth.deleteUser(student.uid); } catch {}
  await signOut(auth).catch(() => {});
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
```

- [ ] **Step 3: self-test 실행**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && node scripts/selftest-pwreset.mjs`
Expected: `결과: 4 pass / 0 fail` (재설정 200·새 비번 로그인·5자 400·비admin 403). 생성 계정 자동 삭제.

- [ ] **Step 4: 자기서비스 브라우저 UX 확인**

dev 서버 → 로그인 다이얼로그 → "비밀번호를 잊으셨어요?"(login 모드) → 빈 이메일 안내 / 이메일 입력 후 성공 안내(민트). signup 모드엔 링크 없음.

- [ ] **Step 5: dev 정지 후 프로덕션 빌드**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공.

- [ ] **Step 6: 푸시 전 점검 + 푸시**

```bash
cd /c/Users/amh47/Documents/test
git status            # selftest-pwreset.mjs 등 일회성 미커밋 확인
git log origin/main..HEAD --oneline
```
diff 검토 + `tsc` + `npm run build` clean이면:
```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- Part 1 자기서비스(LoginDialog 링크·sendPasswordResetEmail·notice·빈이메일 안내) → Task 3 ✓
- Part 2 API password(updateUser ≥6, 400) → Task 1 ✓
- Part 2 patchUser password → Task 1 ✓
- Part 2 UserActionModal 비번 섹션(학생만) → Task 2 ✓
- 검증(self-test 재설정·새비번 로그인·5자 400·비admin 403, 자기서비스 UX) → Task 4 ✓
- 비용 메모 = 설계 문서(코드 변경 없음) ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 코드 단계 완전.

**3. Type consistency:**
- `patchUser(uid, {disabled?,dailyLimit?,password?})` — Task 1 정의 ↔ Task 2 모달 `patchUser({password})` 호출 ↔ Task 4 self-test body 일치 ✓
- PATCH `password` 처리(string ≥6 / 400) — Task 1 ↔ Task 4 검증 일치 ✓
- `sendPasswordResetEmail(auth, email)` / `notice` state — Task 3 일관 ✓
- `act`/`busy`/`toast` (UserActionModal) — 기존 헬퍼 재사용, Task 2 일치 ✓
- 토큰 `bg-mint-soft`/`text-mint-ink`(notice), `type="password"` TextInput — 기존 사용처 있음 ✓
