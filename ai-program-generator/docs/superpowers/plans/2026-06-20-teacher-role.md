# 선생님 역할 체계(B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 선생님(teacher) 계정을 발급·관리하고, 발급된 선생님이 이메일 인증 없이 로그인·생성·게시할 수 있게 한다(관리자↔선생님 토대 + `/teacher` 셸). 학생·풀 차감 카운팅·게시판은 C(범위 밖).

**Architecture:** `teacher` custom claim으로 역할 판별(admin 패턴 미러). 발급 계정(teacher/student claim)은 이메일 인증 게이트 면제. 관리자가 `/api/admin/teachers`로 발급(claim + `teachers/{uid}` 문서: name·totalQuota 누적풀 cap). 선생님은 별도 `/teacher` 라우트(admin 화면 분리). 회원탈퇴는 선생님도 차단.

**Tech Stack:** Next.js 15 App Router(route handlers, `runtime='nodejs'`), Firebase Admin SDK(Auth custom claims + Firestore), Firebase client SDK, 기존 `ConfirmProvider`/`useToast`/`components/ui` 프리미티브. 테스트 프레임워크 없음 — 검증은 `tsc --noEmit` + `npm run build` + 일회성 self-test + 규칙 배포.

**공통 주의:** 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`에서. git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. 타입체크 `./node_modules/.bin/tsc --noEmit`. dev 서버 실행 중엔 `npm run build` 금지. 커밋 본문 끝에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 브랜치 `feat/teacher-role`.

---

### Task 1: firestore.rules — 발급 계정 쓰기 허용 + teachers 컬렉션

**Files:**
- Modify: `ai-program-generator/firestore.rules`

- [ ] **Step 1: `isRoleAccount()` 헬퍼 추가**

`isVerified()` 함수 정의 바로 아래에 추가:
```
    // 발급 계정(선생님/학생) — 가짜 이메일이라 email_verified 없이도 쓰기 허용(역할 기반).
    function isRoleAccount() {
      return isSignedIn() && (request.auth.token.teacher == true || request.auth.token.student == true);
    }
```

- [ ] **Step 2: posts 생성/수정 쓰기 자격에 발급 계정 포함**

posts `create`의 `&& (isAdmin() || isVerified())` 를 다음으로 교체:
```
        && (isAdmin() || isVerified() || isRoleAccount())
```
posts `update`의 `if (isAdmin() || (isOwner(resource.data.ownerUid) && isVerified()))` 를 다음으로 교체:
```
      allow update: if (isAdmin() || (isOwner(resource.data.ownerUid) && (isVerified() || isRoleAccount())))
```

- [ ] **Step 3: teachers 컬렉션 규칙 추가**

`match /users/{uid} { … }` 블록 다음에 추가(쓰기는 서버 Admin SDK 전용이라 클라 write는 admin만 — 실제로는 서버가 규칙 우회):
```
    // 선생님 메타(표시명·총 한도 풀). 서버 Admin SDK가 발급/수정. 본인·관리자 읽기.
    match /teachers/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin();
    }
```

- [ ] **Step 4: 규칙 배포**

Run: `firebase deploy --only firestore:rules --project test-ai-builder`
Expected: `Deploy complete!` 출력.

- [ ] **Step 5: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/firestore.rules
git -C "C:/Users/amh47/Documents/test" commit -m "feat(rules): 발급 계정(teacher/student) posts 쓰기 허용 + teachers 컬렉션

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: /api/generate — 발급 계정 이메일 게이트 면제 + 선생님 무제한

**Files:**
- Modify: `ai-program-generator/app/api/generate/route.ts`

- [ ] **Step 1: 토큰 디코드부에 teacher/student 추출**

`let isAdmin = false;` 와 `let emailVerified = false;` 가 있는 선언부에 두 줄 추가하고, decode 블록에서 값을 채운다. 현재:
```ts
  let uid: string;
  let isAdmin = false;
  let emailVerified = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
    emailVerified = decoded.email_verified === true;
  } catch {
```
를 다음으로 교체:
```ts
  let uid: string;
  let isAdmin = false;
  let isTeacher = false;
  let isStudent = false;
  let emailVerified = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
    isTeacher = decoded.teacher === true;
    isStudent = decoded.student === true;
    emailVerified = decoded.email_verified === true;
  } catch {
```

- [ ] **Step 2: 이메일 게이트에 발급 계정 면제**

```ts
  if (!isAdmin && !emailVerified) {
```
를:
```ts
  if (!isAdmin && !isTeacher && !isStudent && !emailVerified) {
```

- [ ] **Step 3: 한도 트랜잭션에서 선생님 무제한**

`// 3) 한도 선점` 아래 `if (!isAdmin) {` 를:
```ts
  if (!isAdmin && !isTeacher) {
```
그리고 환불 가드 `const refundOnce = async () => { if (refunded || isAdmin) return;` 의 조건을:
```ts
  const refundOnce = async () => {
    if (refunded || isAdmin || isTeacher) return;
```
(student는 무제한 아님 — 일반 일일 한도 경로를 탄다. 실제 풀 차감은 C.)

- [ ] **Step 4: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0. (행위 검증은 Task 7 self-test.)

- [ ] **Step 5: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/generate/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(generate): 발급 계정(teacher/student) 이메일 인증 면제 + 선생님 생성 무제한

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 계정 삭제 캐스케이드 확장 + 선생님 회원탈퇴 차단

**Files:**
- Modify: `ai-program-generator/lib/server/deleteAccount.ts`
- Modify: `ai-program-generator/app/api/me/route.ts`

- [ ] **Step 1: 캐스케이드에 teachers/students 문서 추가**

`lib/server/deleteAccount.ts`의
```ts
  refs.push(adminDb.doc(`users/${uid}`));
  refs.push(adminDb.doc(`limits/${uid}`));
```
다음에 두 줄 추가:
```ts
  refs.push(adminDb.doc(`teachers/${uid}`));
  refs.push(adminDb.doc(`students/${uid}`));
```
(없는 문서 삭제는 무해. 일반/관리자 삭제 동작에 영향 없음.)

- [ ] **Step 2: /api/me 가 선생님도 거부**

`app/api/me/route.ts`의
```ts
    if (decoded.admin === true) {
      return NextResponse.json({ error: '관리자 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
```
를:
```ts
    if (decoded.admin === true || decoded.teacher === true) {
      return NextResponse.json({ error: '관리자·선생님 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
```

- [ ] **Step 3: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/server/deleteAccount.ts ai-program-generator/app/api/me/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(account): 캐스케이드에 teachers/students 추가 + 선생님 탈퇴 차단

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 선생님 발급/관리 API + 클라 헬퍼

**Files:**
- Create: `ai-program-generator/lib/admin/requireTeacher.ts`
- Create: `ai-program-generator/app/api/admin/teachers/route.ts`
- Create: `ai-program-generator/app/api/admin/teachers/[uid]/route.ts`
- Create: `ai-program-generator/lib/admin/teachers.ts`

- [ ] **Step 1: requireTeacher 가드 생성**

`lib/admin/requireTeacher.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/** Bearer ID 토큰 + teacher claim 검증. 통과면 { uid }, 아니면 401/403 NextResponse. */
export async function requireTeacher(req: NextRequest): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.teacher !== true) {
      return NextResponse.json({ error: '선생님만 할 수 있어요.' }, { status: 403 });
    }
    return { uid: decoded.uid };
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
}
```

- [ ] **Step 2: 목록·생성 라우트 생성**

`app/api/admin/teachers/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const LOGIN_RE = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  const teachers: { uid: string; email: string | null; name: string; totalQuota: number; disabled: boolean }[] = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const u of page.users) {
      if (u.customClaims?.teacher === true) {
        const doc = await adminDb.doc(`teachers/${u.uid}`).get();
        const d = doc.data() ?? {};
        teachers.push({
          uid: u.uid,
          email: u.email ?? null,
          name: (d.name as string) ?? '',
          totalQuota: (d.totalQuota as number) ?? 0,
          disabled: u.disabled,
        });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return NextResponse.json({ teachers });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const loginId = typeof b.loginId === 'string' ? b.loginId.trim() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const totalQuota = typeof b.totalQuota === 'number' ? Math.floor(b.totalQuota) : NaN;

  if (!LOGIN_RE.test(loginId)) {
    return NextResponse.json({ error: "아이디는 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!name || name.length > 20) {
    return NextResponse.json({ error: '표시명은 1~20자로 적어 주세요.' }, { status: 400 });
  }
  if (!Number.isInteger(totalQuota) || totalQuota < 0) {
    return NextResponse.json({ error: '총 한도는 0 이상의 정수여야 해요.' }, { status: 400 });
  }

  const email = `${loginId}@${DOMAIN}`;
  try {
    const user = await adminAuth.createUser({ email, password });
    await adminAuth.setCustomUserClaims(user.uid, { teacher: true });
    await adminDb.doc(`teachers/${user.uid}`).set({ name, totalQuota, createdAt: Date.now() });
    return NextResponse.json({ uid: user.uid, email, password });
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: '이미 있는 아이디예요.' }, { status: 409 });
    }
    console.error('선생님 생성 실패:', e);
    return NextResponse.json({ error: '선생님 계정을 만들지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 수정·삭제 라우트 생성**

`app/api/admin/teachers/[uid]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

/** 대상이 teacher claim 아니면 400. 맞으면 null. */
async function ensureTeacher(uid: string): Promise<NextResponse | null> {
  const u = await adminAuth.getUser(uid);
  if (u.customClaims?.teacher !== true) {
    return NextResponse.json({ error: '선생님 계정이 아니에요.' }, { status: 400 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const notTeacher = await ensureTeacher(uid);
  if (notTeacher) return notTeacher;

  try {
    if ('totalQuota' in b) {
      const q = typeof b.totalQuota === 'number' ? Math.floor(b.totalQuota) : NaN;
      if (!Number.isInteger(q) || q < 0) {
        return NextResponse.json({ error: '총 한도는 0 이상의 정수여야 해요.' }, { status: 400 });
      }
      await adminDb.doc(`teachers/${uid}`).set({ totalQuota: q }, { merge: true });
    }
    if (typeof b.disabled === 'boolean') {
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('선생님 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  const notTeacher = await ensureTeacher(uid);
  if (notTeacher) return notTeacher;

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('선생님 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 4: 클라 헬퍼 생성**

`lib/admin/teachers.ts`:
```ts
import { auth } from '@/lib/firebase/client';

async function authed(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export interface Teacher {
  uid: string;
  email: string | null;
  name: string;
  totalQuota: number;
  disabled: boolean;
}

export function listTeachers(): Promise<{ teachers: Teacher[] }> {
  return authed('/api/admin/teachers');
}

export function createTeacher(body: {
  loginId: string;
  password: string;
  name: string;
  totalQuota: number;
}): Promise<{ uid: string; email: string; password: string }> {
  return authed('/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchTeacher(uid: string, body: { totalQuota?: number; disabled?: boolean }): Promise<{ ok: true }> {
  return authed(`/api/admin/teachers/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteTeacher(uid: string): Promise<{ ok: true }> {
  return authed(`/api/admin/teachers/${uid}`, { method: 'DELETE' });
}
```

- [ ] **Step 5: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 6: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/admin/requireTeacher.ts ai-program-generator/app/api/admin/teachers/ ai-program-generator/lib/admin/teachers.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): 선생님 발급/관리 API(GET·POST·PATCH·DELETE) + requireTeacher + 클라 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: AuthProvider.isTeacher + /api/teacher/me + /teacher 셸 + 마이페이지 버튼 숨김

**Files:**
- Modify: `ai-program-generator/components/auth/AuthProvider.tsx`
- Create: `ai-program-generator/app/api/teacher/me/route.ts`
- Create: `ai-program-generator/app/teacher/page.tsx`
- Modify: `ai-program-generator/app/mypage/page.tsx`

- [ ] **Step 1: AuthProvider 에 isTeacher 노출**

`components/auth/AuthProvider.tsx` 전체를 다음으로 교체:
```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isTeacher: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, isTeacher: false, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // 역할은 custom claim 으로 판별 (admin: set-admin 스크립트 / teacher: 관리자 발급)
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
        setIsTeacher(token.claims.teacher === true);
      } else {
        setIsAdmin(false);
        setIsTeacher(false);
      }
      setLoading(false);
    });
  }, []);

  return <AuthContext.Provider value={{ user, isAdmin, isTeacher, loading }}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 2: /api/teacher/me 생성**

`app/api/teacher/me/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const doc = await adminDb.doc(`teachers/${gate.uid}`).get();
  const d = doc.data() ?? {};
  return NextResponse.json({ name: (d.name as string) ?? '', totalQuota: (d.totalQuota as number) ?? 0 });
}
```

- [ ] **Step 3: /teacher 셸 페이지 생성**

`app/teacher/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import LoadingDots from '@/components/ui/LoadingDots';

interface TeacherInfo {
  name: string;
  totalQuota: number;
}

async function fetchTeacherMe(): Promise<TeacherInfo> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요해요.');
  const idToken = await u.getIdToken();
  const res = await fetch('/api/teacher/me', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as TeacherInfo;
}

export default function TeacherPage() {
  const { user, loading, isTeacher } = useAuth();
  const router = useRouter();
  const [info, setInfo] = useState<TeacherInfo | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isTeacher) {
      router.replace('/');
      return;
    }
    fetchTeacherMe()
      .then(setInfo)
      .catch((e) => console.error('선생님 정보 조회 실패:', e));
  }, [loading, user, isTeacher, router]);

  return (
    <main className="min-h-screen">
      <Header />
      {loading || !user || !isTeacher ? (
        <div className="py-16">
          <LoadingDots label="확인 중…" />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          <h1 className="text-[24px]">{info?.name ? `${info.name} 선생님` : '선생님'}</h1>
          <p className="mt-1 text-[14px] text-muted">총 한도 {info ? `${info.totalQuota}회` : '…'}</p>
          <div className="mt-6 rounded-[var(--r-lg)] border-2 border-dashed border-line p-8 text-center text-muted">
            내 반 관리는 준비 중이에요.
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: 마이페이지 — 선생님도 회원탈퇴 버튼 숨김**

`app/mypage/page.tsx`에서:
- `const { user, loading, isAdmin } = useAuth();` → `const { user, loading, isAdmin, isTeacher } = useAuth();`
- AccountCard 호출에 `isTeacher={isTeacher}` 추가: `<AccountCard uid={user.uid} email={user.email} createdAt={user.metadata?.creationTime} isAdmin={isAdmin} isTeacher={isTeacher} />`
- `AccountCard` props 타입에 `isTeacher: boolean` 추가:
  ```tsx
  }: {
    uid: string;
    email: string | null;
    createdAt?: string;
    isAdmin: boolean;
    isTeacher: boolean;
  }) {
  ```
- 회원탈퇴 버튼 게이트 `{!isAdmin && (` 를 `{!isAdmin && !isTeacher && (` 로 변경.

- [ ] **Step 5: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 6: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/components/auth/AuthProvider.tsx ai-program-generator/app/api/teacher/ ai-program-generator/app/teacher/ ai-program-generator/app/mypage/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): isTeacher 노출 + /api/teacher/me + /teacher 셸 + 마이페이지 탈퇴버튼 선생님 숨김

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 관리자 선생님 관리 UI

**Files:**
- Create: `ai-program-generator/app/admin/teachers/page.tsx`
- Modify: `ai-program-generator/app/admin/page.tsx`

- [ ] **Step 1: 관리자 선생님 관리 페이지 생성**

`app/admin/teachers/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import { listTeachers, createTeacher, patchTeacher, deleteTeacher, type Teacher } from '@/lib/admin/teachers';

export default function AdminTeachersPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <Content />
      </AdminGate>
    </main>
  );
}

function Content() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const reload = () =>
    listTeachers()
      .then((r) => setTeachers(r.teachers))
      .catch((e) => console.error('선생님 목록 조회 실패:', e));

  useEffect(() => {
    reload();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const totalQuota = Number(quota);
    if (!Number.isInteger(totalQuota) || totalQuota < 0) {
      toast('총 한도는 0 이상의 정수로 적어 주세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await createTeacher({ loginId: loginId.trim(), password, name: name.trim(), totalQuota });
      setCreated({ email: r.email, password });
      setLoginId('');
      setPassword('');
      setName('');
      setQuota('');
      toast('선생님 계정을 만들었어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function changeQuota(t: Teacher) {
    const v = window.prompt(`${t.name} 선생님 총 한도 (누적 횟수)`, String(t.totalQuota));
    if (v === null) return;
    const q = Number(v);
    if (!Number.isInteger(q) || q < 0) {
      toast('0 이상의 정수로 적어 주세요.');
      return;
    }
    try {
      await patchTeacher(t.uid, { totalQuota: q });
      toast('총 한도를 바꿨어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

  async function remove(t: Teacher) {
    const ok = await confirm({
      title: '선생님 삭제',
      message: `${t.name} 선생님 계정을 삭제할까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTeacher(t.uid);
      toast('삭제했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 flex items-center gap-2 text-[24px]">
        <GraduationCap size={24} aria-hidden /> 선생님 관리
      </h1>

      <form onSubmit={submit} className="mb-6 flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <Label text="아이디 (영문 소문자·숫자·-)" required>
          <TextInput value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="teacher1" required />
        </Label>
        <Label text="비밀번호 (6자 이상)" required>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Label>
        <Label text="표시명 (게시판 이름으로 쓰여요)" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="김선생" required />
        </Label>
        <Label text="총 한도 (누적 횟수)" required>
          <TextInput inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="2000" required />
        </Label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '만드는 중…' : '선생님 만들기'}
        </Button>
        {created && (
          <p className="rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[14px] text-mint-ink">
            만들었어요! 아이디 <b>{created.email}</b> / 비밀번호 <b>{created.password}</b> — 선생님께 전달하세요.
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        {teachers.map((t) => (
          <div key={t.uid} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-line bg-surface p-4">
            <div className="min-w-0">
              <p className="truncate text-[16px]">
                {t.name || '(이름 없음)'} {t.disabled && <span className="text-coral-ink">· 정지됨</span>}
              </p>
              <p className="truncate text-[13px] text-muted">{t.email} · 총 한도 {t.totalQuota}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="soft" onClick={() => changeQuota(t)}>한도</Button>
              <Button variant="ghost" onClick={() => remove(t)}>삭제</Button>
            </div>
          </div>
        ))}
        {!teachers.length && <p className="py-8 text-center text-muted">아직 선생님이 없어요.</p>}
      </div>
    </div>
  );
}
```
(총 한도 변경은 관리자 전용 내부 화면이라 `window.prompt`로 간단히 — 키즈 대면 화면의 window.confirm 금지 규칙과 별개. 삭제는 기존 `ConfirmProvider` 사용.)

- [ ] **Step 2: /admin 허브에 "선생님 관리" 카드 추가**

`app/admin/page.tsx`의 lucide import 줄에 `GraduationCap` 추가:
```ts
import { Flag, Users, ChevronRight, UserPlus, FolderTree, Sparkles, GraduationCap } from 'lucide-react';
```
"계정 관리" HubCard 다음에 추가:
```tsx
        <HubCard
          href="/admin/teachers"
          icon={<GraduationCap size={22} aria-hidden />}
          title="선생님 관리"
          desc="선생님 계정 발급·총 한도"
        />
```

- [ ] **Step 3: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 커밋**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/admin/teachers/ ai-program-generator/app/admin/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(admin): 선생님 관리 UI(발급·총한도·정지·삭제) + 허브 진입

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: self-test + 전체 검증

**Files:**
- Create: `ai-program-generator/scripts/selftest-teacher.mjs` (미커밋 — 일회성)

- [ ] **Step 1: self-test 스크립트 작성**

dev 서버가 떠 있어야 함(`http://localhost:3000`). `serviceAccountKey.json`·`.env.local`은 프로젝트 루트.

`ai-program-generator/scripts/selftest-teacher.mjs`:
```js
// 선생님 역할(B) 검증: 발급 403/200, 게이트 면제, 탈퇴 차단, 삭제, posts 쓰기 허용.
// 사전: npm run dev 실행 중 + 규칙 배포됨.
// 사용: node scripts/selftest-teacher.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3000';
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const PROJECT = sa.project_id;
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
const authH = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const ADMIN_UID = 'selftest-teacher-admin';
const PLAIN_UID = 'selftest-teacher-plain';
const LOGIN = 'selftest-teacher-x';
const EMAIL = `${LOGIN}@class.kr`;

async function main() {
  // 잔여 정리
  await auth.getUserByEmail(EMAIL).then((u) => auth.deleteUser(u.uid)).catch(() => {});
  await auth.deleteUser(ADMIN_UID).catch(() => {});
  await auth.deleteUser(PLAIN_UID).catch(() => {});

  const adminToken = await tokenFor(ADMIN_UID, { admin: true });
  const plainToken = await tokenFor(PLAIN_UID); // 미인증 일반(대조군)

  // 1) 비관리자 → 발급 403
  const r1 = await fetch(`${BASE}/api/admin/teachers`, { method: 'POST', headers: authH(plainToken), body: JSON.stringify({ loginId: LOGIN, password: 'pw1234', name: '셀프', totalQuota: 100 }) });
  check('비관리자 → 선생님 발급 403', r1.status === 403, `status=${r1.status}`);

  // 2) 관리자 → 발급 200
  const r2 = await fetch(`${BASE}/api/admin/teachers`, { method: 'POST', headers: authH(adminToken), body: JSON.stringify({ loginId: LOGIN, password: 'pw1234', name: '셀프선생', totalQuota: 100 }) });
  const j2 = await r2.json().catch(() => ({}));
  check('관리자 → 선생님 발급 200', r2.status === 200, `status=${r2.status} ${JSON.stringify(j2)}`);
  const tUid = j2.uid;
  const tdoc = tUid ? await db.doc(`teachers/${tUid}`).get() : null;
  check('teachers 문서 생성(totalQuota=100)', !!tdoc && tdoc.exists && tdoc.data().totalQuota === 100);
  const claims = tUid ? (await auth.getUser(tUid)).customClaims : null;
  check('teacher claim 부여', !!claims && claims.teacher === true);

  // 3) 선생님 토큰 → 이메일 게이트 면제(빈 본문이면 403 아니라 400)
  const tToken = await tokenFor(tUid); // 지속 claim(teacher) 반영
  const rGen = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: authH(tToken), body: JSON.stringify({}) });
  check('선생님 → /api/generate 게이트 면제(400, !=403)', rGen.status === 400, `status=${rGen.status}`);
  const rGenPlain = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: authH(plainToken), body: JSON.stringify({}) });
  check('대조군 미인증 → /api/generate 403', rGenPlain.status === 403, `status=${rGenPlain.status}`);

  // 4) 선생님 → posts 쓰기 허용(규칙 isRoleAccount)
  const doc = { fields: {
    title: { stringValue: '선생테스트' }, categoryId: { stringValue: 'devtestcat' },
    ownerUid: { stringValue: tUid }, authorName: { stringValue: '셀프선생' },
    prompt: { stringValue: '' }, createdAt: { integerValue: '1700000000000' },
    code: { mapValue: { fields: { html: { stringValue: '<p>x</p>' }, css: { stringValue: '' }, javascript: { stringValue: '' } } } },
  } };
  const rPost = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/posts`, { method: 'POST', headers: authH(tToken), body: JSON.stringify(doc) });
  check('선생님 → posts 생성 허용(!=403)', rPost.status !== 403, `status=${rPost.status}`);
  if (rPost.ok) { const created = await rPost.json(); const name = created.name?.split('/').pop(); if (name) await db.doc(`posts/${name}`).delete().catch(() => {}); }

  // 5) 선생님 → 회원탈퇴 차단 403
  const rMe = await fetch(`${BASE}/api/me`, { method: 'DELETE', headers: authH(tToken) });
  check('선생님 → DELETE /api/me 403', rMe.status === 403, `status=${rMe.status}`);

  // 6) 관리자 → 선생님 삭제 200 + 흔적 제거
  const rDel = await fetch(`${BASE}/api/admin/teachers/${tUid}`, { method: 'DELETE', headers: authH(adminToken) });
  check('관리자 → 선생님 삭제 200', rDel.status === 200, `status=${rDel.status}`);
  let gone = false;
  try { await auth.getUser(tUid); } catch (e) { gone = e.code === 'auth/user-not-found'; }
  const tdoc2 = await db.doc(`teachers/${tUid}`).get();
  check('Auth·teachers 문서 삭제됨', gone && !tdoc2.exists);

  // 정리
  await auth.deleteUser(ADMIN_UID).catch(() => {});
  await auth.deleteUser(PLAIN_UID).catch(() => {});

  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 띄운 채 self-test 실행**

dev 서버 확인(없으면 `npm run dev`). 그 다음:
Run: `node scripts/selftest-teacher.mjs`
Expected: 9개 체크 모두 ✅ → `결과: 9 통과, 0 실패`. 실패 시 해당 라우트/규칙을 고치고 재실행(테스트가 아니라 구현을 수정).

- [ ] **Step 3: 타입체크 + 프로덕션 빌드**

dev 정지 후:
Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 0.
Run: `rm -rf .next && npm run build`
Expected: 빌드 성공(`.next/BUILD_ID`). `/teacher`, `/admin/teachers`, `/api/admin/teachers`, `/api/teacher/me` 라우트가 출력에 보임.

- [ ] **Step 4: self-test 스크립트는 커밋하지 않음**

`git -C "C:/Users/amh47/Documents/test" status` 에서 `scripts/selftest-teacher.mjs`가 untracked(`??`)로만 보이는지 확인. 별도 커밋 없음(앞 태스크들의 커밋으로 B 구현은 이미 반영됨).

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- teacher claim 발급 + teachers 문서 → Task 4(POST). ✓
- 이메일 게이트 면제(generate + rules) → Task 2 + Task 1. ✓
- 선생님 무제한 본인 생성 → Task 2 Step 3. ✓
- totalQuota 누적풀 cap 필드(설정·조회·수정) → Task 4(POST/PATCH/GET) + Task 5(/api/teacher/me). ✓
- requireTeacher 가드 → Task 4 Step 1. ✓
- 관리자 발급/관리 UI → Task 6. ✓
- /teacher 셸 + isTeacher → Task 5. ✓
- 선생님 회원탈퇴 차단(API+버튼) → Task 3 + Task 5 Step 4. ✓
- 캐스케이드 teachers/students 확장 → Task 3 Step 1. ✓
- 규칙 배포 → Task 1 Step 4. ✓
- 검증(self-test 9/9, tsc, build) → Task 7. ✓
- C(학생·풀 차감·게시판)는 플랜에 없음(범위 밖). ✓

**2. Placeholder scan:** "TODO/TBD/적절히" 없음. 모든 코드 블록 완전. ✓

**3. Type consistency:**
- `requireTeacher(req): Promise<{uid}|NextResponse>` — Task 4 정의, Task 5 `/api/teacher/me`에서 `gate instanceof NextResponse` 분기 후 `gate.uid` 사용. 일치. ✓
- `Teacher` 인터페이스(uid·email·name·totalQuota·disabled) — Task 4 정의, Task 6에서 동일 사용. ✓
- `teachers/{uid}` 필드 `{name, totalQuota, createdAt}` — Task 4(set)·Task 5(get)·Task 7(검증) 일치. ✓
- `deleteAccountCascade(uid)` — Task 3에서 확장, Task 4 DELETE에서 호출(시그니처 불변). ✓
- AuthProvider `isTeacher` — Task 5 정의, Task 5 mypage·/teacher에서 소비. ✓
- generate `isTeacher`/`isStudent` 로컬 변수 — Task 2 내부에서 선언·사용. ✓
