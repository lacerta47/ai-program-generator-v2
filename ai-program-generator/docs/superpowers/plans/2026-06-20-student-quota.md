# 학생 계정+한도+공유 풀 차감(C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선생님이 학생 계정을 반 단위로 발급하고 학생별 한도(1일/총)를 정하면, 학생이 일반 앱을 쓰되 자기 한도 + 선생님 공유 풀에 제약되도록 한다(생성 시 풀·학생 카운터 트랜잭션 차감, 소진 시 정지).

**Architecture:** `student` custom claim + `students/{uid}` 문서(teacherUid·limitType·limitValue·usedTotal). `/api/generate`가 학생이면 `lib/server/studentQuota.ts`의 `reserveStudentQuota`로 선생님 풀(`teachers.usedTotal` vs `totalQuota`)과 학생 캡(1일=usage 카운터/총=usedTotal)을 한 트랜잭션에서 체크·차감, 실패/취소 시 `refundStudentQuota`. 선생님은 `/api/teacher/students`로 본인 산하 학생만 발급·관리. 학생은 전용 콘솔 없이 일반 앱 사용(isStudent UI 면제).

**Tech Stack:** Next.js 15 App Router(route handlers, nodejs runtime), Firebase Admin SDK(Auth claims + Firestore 트랜잭션), 기존 `usage/{uid}_{day}` 일일 카운터·`ConfirmProvider`/`useToast`/`components/ui`. 테스트 프레임워크 없음 — `tsc` + 빌드 + self-test + 규칙 배포.

**공통:** 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`. git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. 타입체크 `./node_modules/.bin/tsc --noEmit`. dev 중엔 build 금지. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 브랜치 `feat/student-quota`.

---

### Task 1: firestore.rules — students 컬렉션 + 배포

**Files:** Modify `ai-program-generator/firestore.rules`

- [ ] **Step 1: students 규칙 추가.** `match /teachers/{uid} { … }` 블록 다음에 추가:
```
    // 학생 메타(소속 선생님·한도·누적 소진). 서버 Admin SDK가 발급/수정. 본인·관리자 읽기.
    match /students/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin();
    }
```

- [ ] **Step 2: 배포.** Run: `firebase deploy --only firestore:rules --project test-ai-builder` → `Deploy complete!` 확인.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/firestore.rules
git -C "C:/Users/amh47/Documents/test" commit -m "feat(rules): students 컬렉션(본인·관리자 읽기, 서버 쓰기)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 학생 역할 노출 + UI 면제 + 탈퇴 차단

**Files:**
- Modify `components/auth/AuthProvider.tsx`, `components/auth/AuthButton.tsx`, `components/board/UploadDialog.tsx`, `app/mypage/page.tsx`, `app/api/me/route.ts`

- [ ] **Step 1: AuthProvider 에 isStudent 추가.** `components/auth/AuthProvider.tsx`:
  - `interface AuthState`에 `isStudent: boolean;` 추가(isTeacher 옆).
  - `createContext` 기본값에 `isStudent: false` 추가.
  - `const [isStudent, setIsStudent] = useState(false);` 추가.
  - `onAuthStateChanged` 내 `setIsTeacher(token.claims.teacher === true);` 다음에 `setIsStudent(token.claims.student === true);`; else 블록 `setIsTeacher(false);` 다음에 `setIsStudent(false);`.
  - Provider value `{{ user, isAdmin, isTeacher, isStudent, loading }}`.

- [ ] **Step 2: AuthButton 면제.** `components/auth/AuthButton.tsx`:
  - `const { user, isAdmin, isTeacher, loading } = useAuth();` → `const { user, isAdmin, isTeacher, isStudent, loading } = useAuth();`
  - `{!user.emailVerified && !isTeacher && (` → `{!user.emailVerified && !isTeacher && !isStudent && (`

- [ ] **Step 3: UploadDialog 면제.** `components/board/UploadDialog.tsx`:
  - `const { user, isTeacher } = useAuth();` → `const { user, isTeacher, isStudent } = useAuth();`
  - `if (!user.emailVerified && !isTeacher) return setError(` → `if (!user.emailVerified && !isTeacher && !isStudent) return setError(`

- [ ] **Step 4: mypage 면제.** `app/mypage/page.tsx`:
  - `const { user, loading, isAdmin, isTeacher } = useAuth();` → 추가 `isStudent`.
  - AccountCard 호출에 `isStudent={isStudent}` 추가.
  - AccountCard props 타입에 `isStudent: boolean;` 추가(+ 구조분해).
  - 인증 배너 `{!verified && !isTeacher && (` → `{!verified && !isTeacher && !isStudent && (`

- [ ] **Step 5: /api/me 학생 탈퇴 차단.** `app/api/me/route.ts`:
```ts
    if (decoded.admin === true || decoded.teacher === true) {
      return NextResponse.json({ error: '관리자·선생님 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
```
를:
```ts
    if (decoded.admin === true || decoded.teacher === true || decoded.student === true) {
      return NextResponse.json({ error: '이 계정은 탈퇴할 수 없어요.' }, { status: 403 });
    }
```

- [ ] **Step 6: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 7: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/components/auth/AuthProvider.tsx ai-program-generator/components/auth/AuthButton.tsx ai-program-generator/components/board/UploadDialog.tsx ai-program-generator/app/mypage/page.tsx ai-program-generator/app/api/me/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(student): isStudent 노출 + UI 인증 면제 3곳 + 학생 탈퇴 차단

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 공유 풀 차감 트랜잭션 + generate 분기

**Files:**
- Create `lib/server/studentQuota.ts`
- Modify `app/api/generate/route.ts`

- [ ] **Step 1: studentQuota 헬퍼 생성.** `lib/server/studentQuota.ts`:
```ts
import { adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: 'pool' | 'cap-daily' | 'cap-total' | 'misconfig' };

/** 학생 생성 한도 선점: 선생님 공유 풀 + 학생 캡을 한 트랜잭션에서 체크·차감. */
export async function reserveStudentQuota(uid: string): Promise<ReserveResult> {
  const studentRef = adminDb.doc(`students/${uid}`);
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  try {
    return await adminDb.runTransaction<ReserveResult>(async (tx) => {
      // --- reads (모든 read를 write보다 먼저) ---
      const sSnap = await tx.get(studentRef);
      const s = sSnap.data();
      if (!s || typeof s.teacherUid !== 'string') return { ok: false, reason: 'misconfig' };
      const teacherRef = adminDb.doc(`teachers/${s.teacherUid}`);
      const tSnap = await tx.get(teacherRef);
      const t = tSnap.data();
      if (!t) return { ok: false, reason: 'misconfig' };

      const pool = (t.usedTotal as number | undefined) ?? 0;
      const cap = (t.totalQuota as number | undefined) ?? 0;
      const limitType = s.limitType === 'total' ? 'total' : 'daily';
      const limitValue = (s.limitValue as number | undefined) ?? 0;
      const studentUsed = (s.usedTotal as number | undefined) ?? 0;

      let dayCount = 0;
      if (limitType === 'daily') {
        const uSnap = await tx.get(usageRef);
        dayCount = (uSnap.data()?.count as number | undefined) ?? 0;
      }

      // --- checks ---
      if (pool >= cap) return { ok: false, reason: 'pool' };
      if (limitType === 'total') {
        if (studentUsed >= limitValue) return { ok: false, reason: 'cap-total' };
      } else if (dayCount >= limitValue) {
        return { ok: false, reason: 'cap-daily' };
      }

      // --- writes ---
      tx.set(teacherRef, { usedTotal: pool + 1 }, { merge: true });
      tx.set(studentRef, { usedTotal: studentUsed + 1 }, { merge: true });
      if (limitType === 'daily') {
        tx.set(usageRef, { uid, day, count: dayCount + 1, updatedAt: Date.now() }, { merge: true });
      }
      return { ok: true };
    });
  } catch (e) {
    console.error('[studentQuota] reserve 실패:', e);
    return { ok: false, reason: 'misconfig' };
  }
}

/** 학생 생성 실패/취소 시 선점분 환불(풀·학생 누적·일일 모두, 0 미만 방지). */
export async function refundStudentQuota(uid: string): Promise<void> {
  const studentRef = adminDb.doc(`students/${uid}`);
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  try {
    await adminDb.runTransaction(async (tx) => {
      const sSnap = await tx.get(studentRef);
      const s = sSnap.data();
      if (!s) return;
      const teacherRef = typeof s.teacherUid === 'string' ? adminDb.doc(`teachers/${s.teacherUid}`) : null;
      const tSnap = teacherRef ? await tx.get(teacherRef) : null;
      const limitType = s.limitType === 'total' ? 'total' : 'daily';
      const uSnap = limitType === 'daily' ? await tx.get(usageRef) : null;

      const studentUsed = (s.usedTotal as number | undefined) ?? 0;
      if (studentUsed > 0) tx.update(studentRef, { usedTotal: studentUsed - 1 });
      if (teacherRef && tSnap && tSnap.exists) {
        const pool = (tSnap.data()?.usedTotal as number | undefined) ?? 0;
        if (pool > 0) tx.update(teacherRef, { usedTotal: pool - 1 });
      }
      if (uSnap) {
        const dayCount = (uSnap.data()?.count as number | undefined) ?? 0;
        if (dayCount > 0) tx.update(usageRef, { count: dayCount - 1, updatedAt: Date.now() });
      }
    });
  } catch (e) {
    console.error('[studentQuota] refund 실패:', e);
  }
}
```

- [ ] **Step 2: generate 라우트 — 학생 분기.** `app/api/generate/route.ts`:
  - import 추가(상단, `readEffectiveLimit` import 다음 줄):
    ```ts
    import { reserveStudentQuota, refundStudentQuota } from '@/lib/server/studentQuota';
    ```
  - `// 3) 한도 선점` 블록을 학생 분기로 확장. 현재:
    ```ts
      const day = todayKeyKST();
      const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
      if (!isAdmin && !isTeacher) {
        const dailyLimit = await readEffectiveLimit(uid);
        try {
          const allowed = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(usageRef);
            const count = (snap.data()?.count as number | undefined) ?? 0;
            if (count >= dailyLimit) return false;
            tx.set(usageRef, { uid, day, count: count + 1, updatedAt: Date.now() }, { merge: true });
            return true;
          });
          if (!allowed) {
            return NextResponse.json(
              { error: `오늘 만들 수 있는 횟수(${dailyLimit}번)를 모두 썼어요. 내일 다시 만들어 보세요!` },
              { status: 429 },
            );
          }
        } catch (e) {
          console.error('[/api/generate] 사용량 확인 실패:', e);
          return NextResponse.json(
            { error: '사용량을 확인하지 못했어요. 잠시 후 다시 해주세요.' },
            { status: 500 },
          );
        }
      }
    ```
    를 다음으로 교체:
    ```ts
      const day = todayKeyKST();
      const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
      if (isStudent) {
        const r = await reserveStudentQuota(uid);
        if (!r.ok) {
          const msg =
            r.reason === 'pool'
              ? '선생님이 정한 우리 반 한도를 다 썼어요.'
              : r.reason === 'cap-daily'
                ? '오늘 만들 수 있는 횟수를 다 썼어요. 내일 다시 만들어 보세요!'
                : r.reason === 'cap-total'
                  ? '만들 수 있는 횟수를 다 썼어요.'
                  : '한도를 확인하지 못했어요. 잠시 후 다시 해주세요.';
          return NextResponse.json({ error: msg }, { status: r.reason === 'misconfig' ? 500 : 429 });
        }
      } else if (!isAdmin && !isTeacher) {
        const dailyLimit = await readEffectiveLimit(uid);
        try {
          const allowed = await adminDb.runTransaction(async (tx) => {
            const snap = await tx.get(usageRef);
            const count = (snap.data()?.count as number | undefined) ?? 0;
            if (count >= dailyLimit) return false;
            tx.set(usageRef, { uid, day, count: count + 1, updatedAt: Date.now() }, { merge: true });
            return true;
          });
          if (!allowed) {
            return NextResponse.json(
              { error: `오늘 만들 수 있는 횟수(${dailyLimit}번)를 모두 썼어요. 내일 다시 만들어 보세요!` },
              { status: 429 },
            );
          }
        } catch (e) {
          console.error('[/api/generate] 사용량 확인 실패:', e);
          return NextResponse.json(
            { error: '사용량을 확인하지 못했어요. 잠시 후 다시 해주세요.' },
            { status: 500 },
          );
        }
      }
    ```
  - 환불 가드 `refundOnce`를 학생 분기로:
    ```ts
      const refundOnce = async () => {
        if (refunded || isAdmin || isTeacher) return;
        refunded = true;
        await refundQuota(usageRef);
      };
    ```
    를:
    ```ts
      const refundOnce = async () => {
        if (refunded || isAdmin || isTeacher) return;
        refunded = true;
        if (isStudent) await refundStudentQuota(uid);
        else await refundQuota(usageRef);
      };
    ```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/server/studentQuota.ts ai-program-generator/app/api/generate/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(student): 공유 풀 차감 트랜잭션(reserve/refund) + generate 학생 분기

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 선생님 — 학생 발급/관리 API + 클라 헬퍼

**Files:**
- Create `app/api/teacher/students/route.ts`, `app/api/teacher/students/[uid]/route.ts`, `lib/teacher/students.ts`

- [ ] **Step 1: 목록·배치발급 라우트.** `app/api/teacher/students/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const PREFIX_RE = /^[a-z0-9-]+$/;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  const snap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
  const students = await Promise.all(
    snap.docs.map(async (d) => {
      const s = d.data();
      let email: string | null = null;
      let disabled = false;
      try {
        const u = await adminAuth.getUser(d.id);
        email = u.email ?? null;
        disabled = u.disabled;
      } catch {
        /* Auth 계정이 사라진 고아 문서 — email null */
      }
      return {
        uid: d.id,
        email,
        name: (s.name as string) ?? '',
        limitType: (s.limitType as string) === 'total' ? 'total' : 'daily',
        limitValue: (s.limitValue as number) ?? 0,
        usedTotal: (s.usedTotal as number) ?? 0,
        disabled,
      };
    }),
  );
  return NextResponse.json({ students });
}

export async function POST(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const prefix = typeof b.prefix === 'string' ? b.prefix.trim() : '';
  const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
  const password = typeof b.password === 'string' ? b.password : '';
  const limitType = b.limitType === 'total' ? 'total' : 'daily';
  const limitValue = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;

  if (!PREFIX_RE.test(prefix)) {
    return NextResponse.json({ error: "반 이름은 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
  }
  if (count < 1 || count > 50) {
    return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!Number.isInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
  }

  const created: { email: string; password: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const name = `${prefix}-${pad2(i)}`;
    const email = `${name}@${DOMAIN}`;
    try {
      const user = await adminAuth.createUser({ email, password });
      await adminAuth.setCustomUserClaims(user.uid, { student: true });
      await adminDb.doc(`students/${user.uid}`).set({
        teacherUid: gate.uid,
        name,
        limitType,
        limitValue,
        usedTotal: 0,
        createdAt: Date.now(),
      });
      created.push({ email, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      skipped.push({ email, reason: code === 'auth/email-already-exists' ? '이미 있는 아이디' : '생성 실패' });
    }
  }
  return NextResponse.json({ created, skipped });
}
```

- [ ] **Step 2: 수정·삭제 라우트.** `app/api/teacher/students/[uid]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { deleteAccountCascade } from '@/lib/server/deleteAccount';

export const runtime = 'nodejs';

/** 대상 학생이 caller 소속이 아니면 403. 맞으면 null. */
async function ensureOwned(callerUid: string, uid: string): Promise<NextResponse | null> {
  const snap = await adminDb.doc(`students/${uid}`).get();
  if (!snap.exists || snap.data()?.teacherUid !== callerUid) {
    return NextResponse.json({ error: '우리 반 학생이 아니에요.' }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const notOwned = await ensureOwned(gate.uid, uid);
  if (notOwned) return notOwned;

  try {
    const patch: Record<string, unknown> = {};
    if (typeof b.name === 'string' && b.name.trim() && b.name.trim().length <= 20) {
      patch.name = b.name.trim();
    }
    if (b.limitType === 'daily' || b.limitType === 'total') {
      patch.limitType = b.limitType;
    }
    if ('limitValue' in b) {
      const v = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;
      if (!Number.isInteger(v) || v < 1) {
        return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
      }
      patch.limitValue = v;
    }
    if (Object.keys(patch).length > 0) {
      await adminDb.doc(`students/${uid}`).set(patch, { merge: true });
    }
    if (typeof b.disabled === 'boolean') {
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('학생 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { uid } = await params;

  const notOwned = await ensureOwned(gate.uid, uid);
  if (notOwned) return notOwned;

  try {
    await deleteAccountCascade(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('학생 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 클라 헬퍼.** `lib/teacher/students.ts`:
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

export interface Student {
  uid: string;
  email: string | null;
  name: string;
  limitType: 'daily' | 'total';
  limitValue: number;
  usedTotal: number;
  disabled: boolean;
}

export function listStudents(): Promise<{ students: Student[] }> {
  return authed('/api/teacher/students');
}

export function createStudents(body: {
  prefix: string;
  count: number;
  password: string;
  limitType: 'daily' | 'total';
  limitValue: number;
}): Promise<{ created: { email: string; password: string }[]; skipped: { email: string; reason: string }[] }> {
  return authed('/api/teacher/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function patchStudent(
  uid: string,
  body: { name?: string; limitType?: 'daily' | 'total'; limitValue?: number; disabled?: boolean },
): Promise<{ ok: true }> {
  return authed(`/api/teacher/students/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteStudent(uid: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/students/${uid}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/teacher/students/ ai-program-generator/lib/teacher/students.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(student): 선생님 학생 발급/관리 API(배치·소유권검증) + 클라 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 남은 한도 표시 — /api/me/usage 학생 확장 + /api/teacher/me 풀 + 마이페이지 라벨

**Files:** Modify `app/api/me/usage/route.ts`, `app/api/teacher/me/route.ts`, `app/mypage/page.tsx`

- [ ] **Step 1: /api/me/usage 학생 분기.** `app/api/me/usage/route.ts`:
  - 디코드부에 `let isStudent = false;` 추가, `isAdmin = decoded.admin === true;` 다음에 `isStudent = decoded.student === true;`.
  - `if (isAdmin) { return … unlimited }` 블록 다음에 추가:
    ```ts
      if (isStudent) {
        try {
          const sSnap = await adminDb.doc(`students/${uid}`).get();
          const s = sSnap.data() ?? {};
          const limit = (s.limitValue as number | undefined) ?? 0;
          if (s.limitType === 'total') {
            return NextResponse.json({ used: (s.usedTotal as number | undefined) ?? 0, limit, unlimited: false, kind: 'total' });
          }
          const day = todayKeyKST();
          const snap = await adminDb.collection('usage').doc(`${uid}_${day}`).get();
          return NextResponse.json({ used: (snap.data()?.count as number | undefined) ?? 0, limit, unlimited: false, kind: 'daily' });
        } catch (e) {
          console.error('학생 사용량 조회 실패:', e);
          return NextResponse.json({ error: '사용량을 불러오지 못했어요.' }, { status: 500 });
        }
      }
    ```

- [ ] **Step 2: /api/teacher/me 에 usedTotal 추가.** `app/api/teacher/me/route.ts`의 return을:
    ```ts
      return NextResponse.json({ name: (d.name as string) ?? '', totalQuota: (d.totalQuota as number) ?? 0 });
    ```
    를:
    ```ts
      return NextResponse.json({
        name: (d.name as string) ?? '',
        totalQuota: (d.totalQuota as number) ?? 0,
        usedTotal: (d.usedTotal as number) ?? 0,
      });
    ```

- [ ] **Step 3: 마이페이지 — 학생 한도 라벨.** `app/mypage/page.tsx`:
  - `interface Usage`에 `kind?: 'daily' | 'total';` 추가.
  - `usageText` 계산부 위/근처에서 라벨을 kind에 맞게. 현재 카드의 `오늘 사용` span을 다음으로 교체:
    ```tsx
        <span className="text-muted">
          {usage?.kind === 'total' ? '사용' : '오늘 사용'} <span className="text-ink">{usageText}</span>
        </span>
    ```
    (`usageText`는 그대로 `used/limit` 또는 무제한.)

- [ ] **Step 4: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/me/usage/route.ts ai-program-generator/app/api/teacher/me/route.ts ai-program-generator/app/mypage/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(student): 학생 한도 표시(/api/me/usage·마이페이지) + 선생님 풀 사용량(/api/teacher/me)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 선생님 콘솔 (/teacher) — 풀 + 학생 발급폼 + 명단

**Files:** Modify `app/teacher/page.tsx`

- [ ] **Step 1: /teacher 페이지 전체 교체.** `app/teacher/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { listStudents, createStudents, patchStudent, deleteStudent, type Student } from '@/lib/teacher/students';

interface TeacherInfo {
  name: string;
  totalQuota: number;
  usedTotal: number;
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

  useEffect(() => {
    if (loading) return;
    if (!user || !isTeacher) router.replace('/');
  }, [loading, user, isTeacher, router]);

  return (
    <main className="min-h-screen">
      <Header />
      {loading || !user || !isTeacher ? (
        <div className="py-16">
          <LoadingDots label="확인 중…" />
        </div>
      ) : (
        <Console />
      )}
    </main>
  );
}

function Console() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState<TeacherInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [prefix, setPrefix] = useState('');
  const [count, setCount] = useState('');
  const [password, setPassword] = useState('');
  const [limitType, setLimitType] = useState<'daily' | 'total'>('daily');
  const [limitValue, setLimitValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string }[] | null>(null);

  const reload = () => {
    fetchTeacherMe()
      .then(setInfo)
      .catch((e) => console.error('선생님 정보 조회 실패:', e));
    listStudents()
      .then((r) => setStudents(r.students))
      .catch((e) => {
        console.error('학생 목록 조회 실패:', e);
        toast('학생 목록을 불러오지 못했어요.');
      })
      .finally(() => setLoadingList(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = Number(count);
    const v = Number(limitValue);
    if (!Number.isInteger(c) || c < 1 || c > 50) return toast('인원수는 1~50명으로 적어 주세요.');
    if (!Number.isInteger(v) || v < 1) return toast('한도는 1 이상의 정수로 적어 주세요.');
    setBusy(true);
    try {
      const r = await createStudents({ prefix: prefix.trim(), count: c, password, limitType, limitValue: v });
      setCreated(r.created);
      if (r.skipped.length) toast(`${r.skipped.length}명은 이미 있는 아이디라 건너뛰었어요.`);
      setPrefix('');
      setCount('');
      setPassword('');
      setLimitValue('');
      toast(`${r.created.length}명 만들었어요.`, 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function changeLimit(s: Student) {
    const v = window.prompt(`${s.name} 한도 (${s.limitType === 'total' ? '총' : '1일'} 횟수)`, String(s.limitValue));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) return toast('1 이상의 정수로 적어 주세요.');
    try {
      await patchStudent(s.uid, { limitValue: n });
      toast('한도를 바꿨어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

  async function remove(s: Student) {
    const ok = await confirm({
      title: '학생 삭제',
      message: `${s.name} 계정을 삭제할까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteStudent(s.uid);
      toast('삭제했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-[24px]">{info?.name ? `${info.name} 선생님` : '선생님'}</h1>
      <p className="mt-1 text-[14px] text-muted">
        우리 반 한도 <span className="text-ink">{info ? `${info.usedTotal}/${info.totalQuota}` : '…'}</span>
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="text-[18px]">학생 만들기</h2>
        <Label text="반 이름 (영문 소문자·숫자·-)" required>
          <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="haetnim" required />
        </Label>
        <Label text="인원수 (1~50)" required>
          <TextInput inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="20" required />
        </Label>
        <Label text="공용 비밀번호 (6자 이상)" required>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Label>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" checked={limitType === 'daily'} onChange={() => setLimitType('daily')} /> 1일 한도
          </label>
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" checked={limitType === 'total'} onChange={() => setLimitType('total')} /> 총 한도
          </label>
        </div>
        <Label text="한도 값 (횟수)" required>
          <TextInput inputMode="numeric" value={limitValue} onChange={(e) => setLimitValue(e.target.value)} placeholder="5" required />
        </Label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '만드는 중…' : '학생 만들기'}
        </Button>
        {created && (
          <div className="rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[13px] text-mint-ink">
            <p className="mb-1 font-medium">만든 계정 (공용 비번으로 로그인) — 학생들에게 나눠주세요</p>
            <ul className="space-y-0.5">
              {created.map((c) => (
                <li key={c.email}>{c.email}</li>
              ))}
            </ul>
          </div>
        )}
      </form>

      <h2 className="mb-2 mt-6 text-[18px]">우리 반 ({students.length}명)</h2>
      {loadingList ? (
        <div className="py-8">
          <LoadingDots label="확인 중…" />
        </div>
      ) : students.length === 0 ? (
        <p className="py-8 text-center text-muted">아직 학생이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((s) => (
            <div key={s.uid} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-[16px]">
                  {s.name} {s.disabled && <span className="text-coral-ink">· 정지됨</span>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {s.limitType === 'total' ? '총' : '1일'} {s.limitValue} · 누적 {s.usedTotal}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="soft" onClick={() => changeLimit(s)}>한도</Button>
                <Button variant="ghost" onClick={() => remove(s)}>삭제</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/teacher/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): /teacher 콘솔 — 풀 사용량 + 학생 배치 발급 + 명단(한도·삭제)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: self-test + 전체 검증

**Files:** Create `scripts/selftest-student.mjs` (미커밋)

- [ ] **Step 1: self-test 작성.** dev 서버 + 규칙 배포 전제. `scripts/selftest-student.mjs`:
```js
// 학생 한도(C1) 검증: 발급, 소유권, 풀 소진 429, 캡 429, 탈퇴 차단, 삭제.
// 풀/캡 정지는 생성 §3(한도)에서 Gemini(§4) 이전에 429를 내므로 비용 없음.
// 사전: npm run dev + 규칙 배포. 사용: node scripts/selftest-student.mjs [baseUrl]
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
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  return d.idToken;
}
const authH = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const T1 = 'selftest-stu-teacher1';
const T2 = 'selftest-stu-teacher2';
const PREFIX = 'selfteststu';

async function cleanup() {
  for (const uid of [T1, T2]) await auth.deleteUser(uid).catch(() => {});
  const snap = await db.collection('students').where('name', '>=', PREFIX).where('name', '<', PREFIX + '￿').get();
  for (const d of snap.docs) { await auth.deleteUser(d.id).catch(() => {}); await d.ref.delete().catch(() => {}); }
  await db.doc(`teachers/${T1}`).delete().catch(() => {});
  await db.doc(`teachers/${T2}`).delete().catch(() => {});
}

async function main() {
  await cleanup();
  // 선생님 2명 시드(직접): claim + teachers 문서(풀 5)
  await auth.createUser({ uid: T1, email: `${T1}@class.kr`, password: 'pw1234' });
  await auth.setCustomUserClaims(T1, { teacher: true });
  await db.doc(`teachers/${T1}`).set({ name: '셀프선생1', totalQuota: 5, usedTotal: 0, createdAt: Date.now() });
  await auth.createUser({ uid: T2, email: `${T2}@class.kr`, password: 'pw1234' });
  await auth.setCustomUserClaims(T2, { teacher: true });
  await db.doc(`teachers/${T2}`).set({ name: '셀프선생2', totalQuota: 5, usedTotal: 0, createdAt: Date.now() });
  const t1 = await tokenFor(T1);
  const t2 = await tokenFor(T2);

  // 1) 학생 배치 발급(2명, 1일 3)
  const r1 = await fetch(`${BASE}/api/teacher/students`, { method: 'POST', headers: authH(t1), body: JSON.stringify({ prefix: PREFIX, count: 2, password: 'pw1234', limitType: 'daily', limitValue: 3 }) });
  const j1 = await r1.json().catch(() => ({}));
  check('학생 배치 발급 200(2명)', r1.status === 200 && j1.created?.length === 2, `status=${r1.status} ${JSON.stringify(j1)}`);
  // 발급된 학생 uid 조회
  const stuSnap = await db.collection('students').where('teacherUid', '==', T1).get();
  const stu = stuSnap.docs.map((d) => d.id);
  check('students 문서 2개 + teacherUid', stu.length === 2 && stuSnap.docs.every((d) => d.data().teacherUid === T1));
  const claim0 = (await auth.getUser(stu[0])).customClaims;
  check('student claim 부여', !!claim0 && claim0.student === true);

  // 2) 타 선생님 소유권 403
  const rOwn = await fetch(`${BASE}/api/teacher/students/${stu[0]}`, { method: 'PATCH', headers: authH(t2), body: JSON.stringify({ limitValue: 1 }) });
  check('타 선생님 학생 PATCH 403', rOwn.status === 403, `status=${rOwn.status}`);

  const sToken = await tokenFor(stu[0]);
  const validBody = JSON.stringify({ prompt: '간단한 버튼', mode: 'generate', variant: 'default' });

  // 3) 풀 소진 → 429(pool). 선생님 풀 usedTotal=totalQuota로 시드.
  await db.doc(`teachers/${T1}`).set({ usedTotal: 5 }, { merge: true });
  const rPool = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: authH(sToken), body: validBody });
  check('풀 소진 → 429', rPool.status === 429, `status=${rPool.status}`);

  // 4) 풀 복구 + 학생 캡 0 → 429(cap). (풀 ok, 학생 daily limit=0)
  await db.doc(`teachers/${T1}`).set({ usedTotal: 0 }, { merge: true });
  await db.doc(`students/${stu[0]}`).set({ limitValue: 0 }, { merge: true });
  const rCap = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: authH(sToken), body: validBody });
  check('학생 캡 소진 → 429', rCap.status === 429, `status=${rCap.status}`);

  // 5) 학생 탈퇴 차단 403
  const rMe = await fetch(`${BASE}/api/me`, { method: 'DELETE', headers: authH(sToken) });
  check('학생 → DELETE /api/me 403', rMe.status === 403, `status=${rMe.status}`);

  // 6) 선생님 → 학생 삭제 200 + 흔적 제거
  const rDel = await fetch(`${BASE}/api/teacher/students/${stu[0]}`, { method: 'DELETE', headers: authH(t1) });
  check('선생님 → 학생 삭제 200', rDel.status === 200, `status=${rDel.status}`);
  let gone = false;
  try { await auth.getUser(stu[0]); } catch (e) { gone = e.code === 'auth/user-not-found'; }
  const sdoc = await db.doc(`students/${stu[0]}`).get();
  check('Auth·students 문서 삭제됨', gone && !sdoc.exists);

  await cleanup();
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 띄운 채 실행.** Run: `node scripts/selftest-student.mjs`
  Expected: 8개 체크 모두 ✅ → `결과: 8 통과, 0 실패`. 실패 시 구현 수정 후 재실행.

- [ ] **Step 3: 타입체크 + 빌드.** dev 정지 후:
  Run: `./node_modules/.bin/tsc --noEmit` → 에러 0.
  Run: `rm -rf .next && npm run build` → 빌드 성공. `/api/teacher/students`, `/teacher` 등 라우트 출력 확인.

- [ ] **Step 4: self-test 미커밋 확인.** `git -C "C:/Users/amh47/Documents/test" status` 에서 `scripts/selftest-student.mjs`가 untracked(`??`)인지 확인. 별도 커밋 없음.

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- students 규칙 → Task 1. ✓
- isStudent 노출 + UI 면제 3곳 + 학생 탈퇴 차단 → Task 2. ✓
- 공유 풀 차감(reserve/refund) + generate 분기 → Task 3. ✓
- 학생 배치 발급/관리 API(소유권) + 헬퍼 → Task 4. ✓
- 학생 한도 표시(/api/me/usage·마이페이지) + 선생님 풀(/api/teacher/me) → Task 5. ✓
- /teacher 콘솔(풀·발급폼·명단) → Task 6. ✓
- 검증(self-test 8/8·tsc·build·배포 Task1) → Task 7. ✓
- C2(게시판)는 플랜에 없음(범위 밖). ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 모든 코드 블록 완전. eslint-disable 한 줄은 의도(반복 reload). ✓

**3. Type consistency:**
- `ReserveResult` reason 값('pool'|'cap-daily'|'cap-total'|'misconfig') — Task 3 정의·generate 분기 메시지 매핑 일치. ✓
- `reserveStudentQuota(uid)`/`refundStudentQuota(uid)` — Task 3 정의, generate에서 호출. ✓
- `students/{uid}` 필드 {teacherUid,name,limitType,limitValue,usedTotal,createdAt} — Task 4(set)·Task 3(read)·Task 5(read)·Task 7(검증) 일치. ✓
- `Student` 인터페이스(uid·email·name·limitType·limitValue·usedTotal·disabled) — Task 4 정의, Task 6 사용. ✓
- `teachers.usedTotal` — Task 3(증감)·Task 5(/api/teacher/me 반환)·Task 6(표시) 일치. ✓
- AuthProvider `isStudent` — Task 2 정의, Task 2 소비. ✓
- `/api/teacher/me` 반환 {name,totalQuota,usedTotal} — Task 5 정의, Task 6 `TeacherInfo` 일치. ✓
