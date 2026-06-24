# 학생 간편 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초등 저학년이 **학교(드롭다운) + 학번 + 6자리 PIN**으로 로그인하고, 학생 계정은 단일 세션(동시접속 차단)으로 보호한다.

**Architecture:** 별도 로그인 API 없이 클라가 `{schoolCode}-{학번}@class.kr` 이메일을 조합해 `signInWithEmailAndPassword(email, PIN)`. schoolCode=교사 loginId. 발급은 admin(학교)→teacher(학번) 2단. 단일 세션은 `sessions/{uid}.activeToken` + 클라 리스너(협조적 킥).

**Tech Stack:** Next.js 15, Firebase Auth(이메일/비번 + custom claim) + Firestore, Admin SDK(발급), Firestore Rules.

**공통:** 명령 `C:/Users/amh47/Documents/test/ai-program-generator`. git `git -C "C:/Users/amh47/Documents/test"`. tsc `./node_modules/.bin/tsc --noEmit`(dev 중 build 금지). 브랜치 `feat/student-login`. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. pad2 = `(n)=> n<10?`0${n}`:`${n}``.

---

### Task 1: rules — schools 공개읽기 + sessions 단일세션

**Files:** Modify `ai-program-generator/firestore.rules`

- [ ] **Step 1: match 블록 추가.** `// few-shot 참고 예시` 주석(현재 exemplars 블록) 바로 앞에 삽입:
```
    // 학교 목록(학생 로그인 드롭다운). 공개 읽기, 쓰기는 서버 Admin SDK만.
    match /schools/{schoolCode} {
      allow read: if true;
      allow write: if false;
    }

    // 학생 단일 세션 토큰. 본인만 읽기/쓰기. 새 로그인이 activeToken을 덮어 이전 세션을 밀어냄.
    match /sessions/{uid} {
      allow read: if isOwner(uid);
      allow write: if isOwner(uid)
        && request.resource.data.keys().hasOnly(['activeToken', 'updatedAt'])
        && request.resource.data.activeToken is string
        && request.resource.data.updatedAt == request.time;
    }
```

- [ ] **Step 2: 배포.** Run: `firebase deploy --only firestore:rules --project test-ai-builder`
  Expected: `rules file firestore.rules compiled successfully` + `Deploy complete!`. 컴파일 에러 시 문법 수정 후 재배포.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/firestore.rules
git -C "C:/Users/amh47/Documents/test" commit -m "feat(rules): schools 공개읽기 + sessions 단일세션

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: admin 학교 발급 (schoolCode + schools 문서)

**Files:** Modify `ai-program-generator/app/api/admin/teachers/route.ts`

교사 발급 시 loginId를 schoolCode로 저장하고 공개 `schools` 문서를 만든다.

- [ ] **Step 1: POST의 teacher 문서 생성부 교체.** 다음 한 줄을(현재 70행)
```
    await adminDb.doc(`teachers/${user.uid}`).set({ name, totalQuota, createdAt: Date.now() });
```
다음으로 교체:
```
    await adminDb.doc(`teachers/${user.uid}`).set({ name, totalQuota, schoolCode: loginId, createdAt: Date.now() });
    await adminDb.doc(`schools/${loginId}`).set({ name, teacherUid: user.uid });
```

- [ ] **Step 2: GET 응답에 schoolCode 추가.** GET의 `teachers.push({...})`(현재 22–29행)에 `schoolCode` 필드를 추가:
```
      teachers.push({
        uid: u.uid,
        email: u.email ?? null,
        name: (d.name as string) ?? '',
        schoolCode: (d.schoolCode as string) ?? '',
        totalQuota: (d.totalQuota as number) ?? 0,
        usedTotal: (d.usedTotal as number) ?? 0,
        disabled: u.disabled,
      });
```
그리고 같은 파일 GET 상단의 배열 타입 선언(현재 14행)에 `schoolCode: string;`를 추가:
```
  const teachers: { uid: string; email: string | null; name: string; schoolCode: string; totalQuota: number; usedTotal: number; disabled: boolean }[] = [];
```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0. (admin/teachers/page.tsx가 이 응답 타입을 쓰면 schoolCode 옵셔널 처리 필요 — 에러나면 page의 Teacher 타입에 `schoolCode?: string` 추가.)

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/admin/teachers/route.ts ai-program-generator/app/admin/teachers/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(admin): 교사 발급 시 학교(schoolCode=loginId) + 공개 schools 문서 생성

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: teacher 학번 발급 API (학년·반·인원·PIN)

**Files:** Modify `ai-program-generator/app/api/teacher/students/route.ts` (POST만)

발급을 `prefix` 자유입력 → 구조화(학년·반)로 바꾸고 이메일 스킴 `{schoolCode}-{학번}@class.kr`을 쓴다.

- [ ] **Step 1: POST 함수 전체 교체.** 기존 `export async function POST(...)`(현재 42–95행)를 다음으로 교체:
```ts
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
  const grade = typeof b.grade === 'number' ? Math.floor(b.grade) : NaN;
  const classNo = typeof b.classNo === 'number' ? Math.floor(b.classNo) : NaN;
  const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
  const password = typeof b.password === 'string' ? b.password : '';
  const limitType = b.limitType === 'total' ? 'total' : 'daily';
  const limitValue = typeof b.limitValue === 'number' ? Math.floor(b.limitValue) : NaN;

  if (!Number.isInteger(grade) || grade < 1 || grade > 6) {
    return NextResponse.json({ error: '학년은 1~6이에요.' }, { status: 400 });
  }
  if (!Number.isInteger(classNo) || classNo < 1 || classNo > 99) {
    return NextResponse.json({ error: '반은 1~99예요.' }, { status: 400 });
  }
  if (count < 1 || count > 50) {
    return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'PIN은 6자 이상이어야 해요.' }, { status: 400 });
  }
  if (!Number.isInteger(limitValue) || limitValue < 1) {
    return NextResponse.json({ error: '한도는 1 이상의 정수여야 해요.' }, { status: 400 });
  }

  const tDoc = await adminDb.doc(`teachers/${gate.uid}`).get();
  const schoolCode = (tDoc.data()?.schoolCode as string) ?? '';
  if (!schoolCode) {
    return NextResponse.json({ error: '학교 정보가 없어요. 관리자에게 문의해 주세요.' }, { status: 400 });
  }

  const created: { email: string; hakbun: string; password: string }[] = [];
  const skipped: { hakbun: string; reason: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const hakbun = `${grade}${pad2(classNo)}${pad2(i)}`;
    const email = `${schoolCode}-${hakbun}@${DOMAIN}`;
    try {
      const user = await adminAuth.createUser({ email, password });
      await adminAuth.setCustomUserClaims(user.uid, { student: true });
      await adminDb.doc(`students/${user.uid}`).set({
        teacherUid: gate.uid,
        schoolCode,
        hakbun,
        name: hakbun,
        limitType,
        limitValue,
        usedTotal: 0,
        createdAt: Date.now(),
      });
      created.push({ email, hakbun, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      skipped.push({ hakbun, reason: code === 'auth/email-already-exists' ? '이미 있는 학번' : '생성 실패' });
    }
  }
  return NextResponse.json({ created, skipped, schoolCode });
}
```

- [ ] **Step 2: pad2 헬퍼 확인.** 파일 상단에 이미 `const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);`가 있음(현재 9행). 없으면 추가. `PREFIX_RE`는 더 안 쓰면 제거.

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/teacher/students/route.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): 학번 구조 발급(학년·반·인원·PIN, {schoolCode}-{학번}@class.kr)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: teacher 발급 폼 + 배포 표시

**Files:** Modify `ai-program-generator/lib/teacher/students.ts`, `ai-program-generator/app/teacher/page.tsx`

- [ ] **Step 1: createStudents 시그니처 변경.** `lib/teacher/students.ts`의 `createStudents` 입력 타입과 본문에서 `prefix`를 `grade`·`classNo`로 교체. READ the file first. 입력 객체를 `{ grade: number; classNo: number; count: number; password: string; limitType: 'daily'|'total'; limitValue: number }`로, 반환 `created`의 항목 타입을 `{ email: string; hakbun: string; password: string }`로, `skipped`를 `{ hakbun: string; reason: string }`로 맞춘다(POST 응답과 동일). 호출은 `authedFetch('/api/teacher/students', { method:'POST', body: JSON.stringify(input) })` 형태 유지(기존 패턴 그대로, prefix→grade/classNo만 교체).

- [ ] **Step 2: 발급 폼 교체.** `app/teacher/page.tsx`에서 상태 `prefix`를 `grade`·`classNo`로 교체:
```tsx
  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
```
(`const [prefix, setPrefix] = useState('');` 제거.)

- [ ] **Step 3: submit 교체.** `submit` 함수에서 검증·호출을 교체:
```tsx
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(grade);
    const c = Number(classNo);
    const n = Number(count);
    const v = Number(limitValue);
    if (!Number.isInteger(g) || g < 1 || g > 6) return toast('학년은 1~6으로 적어 주세요.');
    if (!Number.isInteger(c) || c < 1 || c > 99) return toast('반은 1~99로 적어 주세요.');
    if (!Number.isInteger(n) || n < 1 || n > 50) return toast('인원수는 1~50명으로 적어 주세요.');
    if (password.length < 6) return toast('PIN은 6자 이상으로 적어 주세요.');
    if (!Number.isInteger(v) || v < 1) return toast('한도는 1 이상의 정수로 적어 주세요.');
    setBusy(true);
    try {
      const r = await createStudents({ grade: g, classNo: c, count: n, password, limitType, limitValue: v });
      setCreated(r.created);
      if (r.skipped.length) toast(`${r.skipped.length}명은 이미 있는 학번이라 건너뛰었어요.`);
      setGrade('');
      setClassNo('');
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
```
(상태 타입: `const [created, setCreated] = useState<{ email: string; hakbun: string; password: string }[] | null>(null);`로 맞춘다.)

- [ ] **Step 4: 폼 입력 필드 교체.** 발급 폼에서 "반 이름" `Label`(현재 prefix TextInput)을 학년·반 두 입력으로 교체, "공용 비밀번호"를 "공용 PIN(6자리)"로 라벨만 바꾼다:
```tsx
        <div className="flex gap-3">
          <Label text="학년 (1~6)" required>
            <TextInput inputMode="numeric" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="1" required />
          </Label>
          <Label text="반 (1~99)" required>
            <TextInput inputMode="numeric" value={classNo} onChange={(e) => setClassNo(e.target.value)} placeholder="1" required />
          </Label>
        </div>
```
(기존 "반 이름" Label 블록을 위 블록으로 교체. "공용 비밀번호" Label 텍스트를 "공용 PIN (6자리 이상)"으로.)

- [ ] **Step 5: 배포 표시(buildCredText + created 박스) 교체.** `buildCredText`를 학교·PIN·학번용으로:
```tsx
function buildCredText(schoolCode: string, list: { email: string; hakbun: string; password: string }[]): string {
  if (!list.length) return '';
  return `학교 코드: ${schoolCode}\n공용 PIN: ${list[0].password}\n학번:\n` + list.map((c) => c.hakbun).join('\n');
}
```
`created` 상태와 함께 `schoolCode`도 보관: submit에서 `setCreatedSchool(r.schoolCode)` (상태 `const [createdSchool, setCreatedSchool] = useState('');` 추가). created 표시 박스(현재 292–333행)를 교체:
```tsx
        {created && (
          <div className="rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[13px] text-mint-ink">
            <p className="mb-1 font-medium">만든 계정 — 학생들에게 나눠주세요</p>
            <p className="mb-1">학교 코드: <b>{createdSchool}</b> · 공용 PIN: <b>{created[0]?.password}</b></p>
            <p className="mb-1 text-[12px]">학생은 로그인에서 학교를 고르고, 자기 학번 + PIN을 넣어요.</p>
            <ul className="space-y-0.5">
              {created.map((c) => (
                <li key={c.hakbun}>학번 {c.hakbun}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="soft" onClick={async () => {
                try { await navigator.clipboard.writeText(buildCredText(createdSchool, created)); toast('계정 목록을 복사했어요.', 'success'); }
                catch { toast('복사하지 못했어요.'); }
              }}>전체 복사</Button>
              <Button type="button" variant="ghost" onClick={() => {
                const blob = new Blob([buildCredText(createdSchool, created)], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = '우리반-계정.txt'; a.click(); URL.revokeObjectURL(url);
              }}>텍스트로 저장</Button>
            </div>
          </div>
        )}
```

- [ ] **Step 6: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 7: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/teacher/students.ts ai-program-generator/app/teacher/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): 발급 폼 학년·반·PIN + 배포 표시(학교·PIN·학번)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 학생 로그인 탭

**Files:** Create `ai-program-generator/lib/firebase/schools.ts`; Modify `ai-program-generator/components/auth/LoginDialog.tsx`

- [ ] **Step 1: schools 목록 헬퍼.** `lib/firebase/schools.ts`:
```ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from './client';

export interface School {
  schoolCode: string;
  name: string;
}

export async function listSchools(): Promise<School[]> {
  const snap = await getDocs(collection(db, 'schools'));
  return snap.docs
    .map((d) => ({ schoolCode: d.id, name: (d.data().name as string) ?? d.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}
```

- [ ] **Step 2: LoginDialog에 탭 + 학생 폼.** READ the file first. 변경점:
  - 임포트 추가: `import { listSchools, type School } from '@/lib/firebase/schools';` 와 `Select` (`import { TextInput, Select } from '@/components/ui/Field';` — 기존 `TextInput`만 import이면 Select 추가).
  - 상태 추가: `const [tab, setTab] = useState<'general' | 'student'>('general');` `const [schools, setSchools] = useState<School[]>([]);` `const [schoolCode, setSchoolCode] = useState('');` `const [hakbun, setHakbun] = useState('');` `const [pin, setPin] = useState('');`
  - `open` 초기화 effect에 `setTab('general'); setHakbun(''); setPin('');` 추가.
  - schools 로드 effect: `useEffect(() => { if (open && tab === 'student' && schools.length === 0) listSchools().then(setSchools).catch(() => {}); }, [open, tab, schools.length]);`
  - 학생 로그인 핸들러:
```tsx
  async function withStudent(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!schoolCode) return setError('학교를 골라 주세요.');
    if (!hakbun.trim() || !pin) return setError('학번과 PIN을 적어 주세요.');
    setBusy(true);
    try {
      const email = `${schoolCode}-${hakbun.trim()}@class.kr`;
      await signInWithEmailAndPassword(auth, email, pin);
      onClose();
    } catch {
      setError('학교·학번·비밀번호를 다시 확인해 주세요.');
    } finally {
      setBusy(false);
    }
  }
```
  - 탭 스위처를 모달 상단(아이콘 헤더 아래)에 렌더:
```tsx
        <div className="mb-5 flex gap-1 rounded-full bg-surface-2 p-1">
          <button type="button" onClick={() => setTab('general')}
            className={`flex-1 rounded-full px-3 py-1.5 text-[14px] ${tab === 'general' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>일반</button>
          <button type="button" onClick={() => setTab('student')}
            className={`flex-1 rounded-full px-3 py-1.5 text-[14px] ${tab === 'student' ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}>학생</button>
        </div>
```
  - `tab === 'general'`일 때 기존 Google+이메일 폼을, `tab === 'student'`일 때 학생 폼을 보이게 감싼다:
```tsx
        {tab === 'student' ? (
          <form onSubmit={withStudent} className="flex flex-col gap-3">
            <Select value={schoolCode} onChange={(e) => setSchoolCode(e.target.value)} aria-label="학교">
              <option value="">학교를 골라요</option>
              {schools.map((s) => (<option key={s.schoolCode} value={s.schoolCode}>{s.name}</option>))}
            </Select>
            <TextInput inputMode="numeric" value={hakbun} onChange={(e) => setHakbun(e.target.value)} placeholder="학번 (예: 10101)" />
            <TextInput inputMode="numeric" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="비밀번호 (PIN)" />
            {error && <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">{error}</p>}
            <Button type="submit" variant="primary" disabled={busy} className="w-full">{busy ? '잠깐만요…' : '학생 로그인'}</Button>
          </form>
        ) : (
          <>
            {/* 기존 Google 버튼 + 구분선 + 이메일 폼 + 비번찾기 + 가입전환 전체를 이 안에 둔다 */}
          </>
        )}
```
  (주의: 기존 일반 로그인 마크업 전체를 `tab==='general'` 분기로 감싸기만 하면 됨 — 내용 변경 없음.)

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/firebase/schools.ts ai-program-generator/components/auth/LoginDialog.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(auth): 로그인 일반/학생 양분 — 학생은 학교+학번+PIN

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 단일 세션 무결성 (학생만)

**Files:** Create `ai-program-generator/lib/client/session.ts`; Modify `ai-program-generator/components/auth/AuthProvider.tsx`

- [ ] **Step 1: 세션 모듈.** `lib/client/session.ts`:
```ts
import { doc, setDoc, onSnapshot, serverTimestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

/** 이 기기를 활성 세션으로 등록하고 세션 id를 반환(이전 세션을 밀어냄). */
export async function claimSession(uid: string): Promise<string> {
  const id = crypto.randomUUID();
  await setDoc(doc(db, 'sessions', uid), { activeToken: id, updatedAt: serverTimestamp() });
  return id;
}

/** activeToken이 내 세션과 달라지면(=다른 기기 로그인) onKicked 호출. */
export function watchSession(uid: string, myId: string, onKicked: () => void): Unsubscribe {
  return onSnapshot(doc(db, 'sessions', uid), (snap) => {
    const tok = snap.data()?.activeToken as string | undefined;
    if (tok && tok !== myId) onKicked();
  });
}
```

- [ ] **Step 2: AuthProvider에 세션 연결.** 임포트 추가:
```ts
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { claimSession, watchSession } from '@/lib/client/session';
import type { Unsubscribe } from 'firebase/firestore';
```
`AuthProvider` 안에 ref 추가: `const sessionUnsub = useRef<Unsubscribe | null>(null);`
`onAuthStateChanged` 콜백을 교체:
```tsx
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      sessionUnsub.current?.();
      sessionUnsub.current = null;
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
        setIsTeacher(token.claims.teacher === true);
        const student = token.claims.student === true;
        setIsStudent(student);
        if (student) {
          try {
            const myId = await claimSession(u.uid);
            sessionUnsub.current = watchSession(u.uid, myId, () => {
              signOut(auth).catch(() => {});
              if (typeof window !== 'undefined') {
                window.alert('다른 곳에서 같은 학생으로 로그인했어요. 이 화면은 로그아웃할게요.');
              }
            });
          } catch (e) {
            console.error('세션 설정 실패:', e);
          }
        }
      } else {
        setIsAdmin(false);
        setIsTeacher(false);
        setIsStudent(false);
      }
      setLoading(false);
    });
```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/client/session.ts ai-program-generator/components/auth/AuthProvider.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(auth): 학생 단일 세션(동시접속 차단) — sessions 토큰 + 리스너 킥

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: self-test + 검증

**Files:** Create `ai-program-generator/scripts/selftest-student-login.mjs` (미커밋)

- [ ] **Step 1: self-test 작성.** Admin SDK 시드 + dev API 발급 + 클라SDK 규칙/로그인 검증. `scripts/selftest-student-login.mjs`:
```js
// 학생 로그인 검증: 학번 발급·이메일 스킴, 학교+학번+PIN 로그인, 틀린 PIN 거부, 단일 세션, schools 공개읽기.
// 사전: npm run dev + 규칙 배포. 사용: node scripts/selftest-student-login.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as adminAuthFn } from 'firebase-admin/auth';
import { getFirestore as adminDbFn } from 'firebase-admin/firestore';
import { initializeApp as initClient } from 'firebase/app';
import { getAuth as clientAuthFn, signInWithCustomToken, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore as clientDbFn, doc, setDoc, getDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3000';
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
initAdmin({ credential: cert(sa) });
const aAuth = adminAuthFn();
const aDb = adminDbFn();
const capp = initClient({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID });
const cAuth = clientAuthFn(capp);
const cDb = clientDbFn(capp);

let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const SCHOOL = 'selftest-school';
const T = 'selftest-stulogin-teacher';
const PIN = 'pin123';
let createdUids = [];

async function tokenFor(uid, claims) {
  const ct = await aAuth.createCustomToken(uid, claims);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  return d.idToken;
}
async function cleanup() {
  await aAuth.deleteUser(T).catch(() => {});
  await aDb.doc(`teachers/${T}`).delete().catch(() => {});
  await aDb.doc(`schools/${SCHOOL}`).delete().catch(() => {});
  for (const uid of createdUids) { await aAuth.deleteUser(uid).catch(() => {}); await aDb.doc(`students/${uid}`).delete().catch(() => {}); await aDb.doc(`sessions/${uid}`).delete().catch(() => {}); }
  // 학번 스킴 계정 잔여 정리(이메일로 조회)
  for (const hb of ['10101', '10102']) {
    try { const u = await aAuth.getUserByEmail(`${SCHOOL}-${hb}@class.kr`); await aAuth.deleteUser(u.uid).catch(() => {}); await aDb.doc(`students/${u.uid}`).delete().catch(() => {}); await aDb.doc(`sessions/${u.uid}`).delete().catch(() => {}); } catch {}
  }
}

async function main() {
  await cleanup();
  // 교사=학교 시드
  await aAuth.createUser({ uid: T, email: `${SCHOOL}@class.kr`, password: 'pw1234' });
  await aAuth.setCustomUserClaims(T, { teacher: true });
  await aDb.doc(`teachers/${T}`).set({ name: '셀프테스트학교', totalQuota: 100, usedTotal: 0, schoolCode: SCHOOL, createdAt: Date.now() });
  await aDb.doc(`schools/${SCHOOL}`).set({ name: '셀프테스트학교', teacherUid: T });

  // 1) 발급 API: 1학년 1반 2명
  const tTok = await tokenFor(T, { teacher: true });
  const rGen = await fetch(`${BASE}/api/teacher/students`, { method: 'POST', headers: { Authorization: `Bearer ${tTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ grade: 1, classNo: 1, count: 2, password: PIN, limitType: 'daily', limitValue: 5 }) });
  const jGen = await rGen.json().catch(() => ({}));
  const hakbuns = (jGen.created ?? []).map((c) => c.hakbun);
  check('발급: 학번 10101·10102 + 스킴', rGen.status === 200 && hakbuns.includes('10101') && (jGen.created ?? [])[0]?.email === `${SCHOOL}-10101@class.kr`, JSON.stringify(jGen).slice(0, 200));
  // students 문서 필드
  const u1 = await aAuth.getUserByEmail(`${SCHOOL}-10101@class.kr`);
  createdUids = [u1.uid];
  const sDoc = (await aDb.doc(`students/${u1.uid}`).get()).data() ?? {};
  check('students 문서 schoolCode·hakbun', sDoc.schoolCode === SCHOOL && sDoc.hakbun === '10101');

  // 2) 클라 로그인: 올바른 학교+학번+PIN
  try { await signInWithEmailAndPassword(cAuth, `${SCHOOL}-10101@class.kr`, PIN); check('학생 로그인 성공', true); }
  catch (e) { check('학생 로그인 성공', false, e?.code); }

  // 3) 단일 세션: 같은 uid에 두 번 토큰 기록 → 두 번째로 바뀜
  await setDoc(doc(cDb, 'sessions', u1.uid), { activeToken: 'AAA', updatedAt: serverTimestamp() });
  await setDoc(doc(cDb, 'sessions', u1.uid), { activeToken: 'BBB', updatedAt: serverTimestamp() });
  const sess = (await getDoc(doc(cDb, 'sessions', u1.uid))).data();
  check('단일세션 activeToken 갱신(BBB)', sess?.activeToken === 'BBB', JSON.stringify(sess));
  await signOut(cAuth);

  // 4) 틀린 PIN 거부
  try { await signInWithEmailAndPassword(cAuth, `${SCHOOL}-10101@class.kr`, 'wrongpin'); check('틀린 PIN 거부', false, '로그인됨'); }
  catch { check('틀린 PIN 거부', true); }
  await signOut(cAuth).catch(() => {});

  // 5) schools 공개 읽기
  const schoolsSnap = await getDocs(collection(cDb, 'schools'));
  check('schools 공개 읽기', schoolsSnap.docs.some((d) => d.id === SCHOOL));

  await cleanup();
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 띄운 채 실행.** Run: `node scripts/selftest-student-login.mjs`
  Expected: 6개 체크 모두 ✅ → `결과: 6 통과, 0 실패`. 실패 시 해당 구현 수정 후 재실행.

- [ ] **Step 3: 타입체크 + 빌드.** dev 정지 후:
  Run: `./node_modules/.bin/tsc --noEmit` → 에러 0.
  Run: `rm -rf .next && npm run build` → 빌드 성공.

- [ ] **Step 4: 미커밋 확인.** `git -C "C:/Users/amh47/Documents/test" status`에서 `scripts/selftest-student-login.mjs`가 `??`(untracked). 커밋 안 함.

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- rules schools/sessions + 배포 → T1. ✓
- admin 학교(schoolCode=loginId + schools doc) → T2. ✓
- teacher 학번 발급(학년·반·인원·PIN, 이메일 스킴) → T3. ✓
- 발급 폼 + 배포 표시 → T4. ✓
- 학생 로그인 탭(학교 셀렉트·학번·PIN, listSchools) → T5. ✓
- 단일 세션(session.ts + AuthProvider) → T6. ✓
- self-test(발급·로그인·틀린PIN·단일세션·schools 읽기) + tsc/build → T7. ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 코드 블록 전부 제시(LoginDialog의 "기존 마크업 감싸기"는 내용 변경 없는 래핑이라 명시).

**3. Type/이름 일관성:**
- 이메일 스킴 `${schoolCode}-${hakbun}@class.kr` — T3 발급·T5 로그인·T7 self-test 일치. ✓
- `created` 항목 `{email,hakbun,password}` — T3 API·T4 createStudents/표시·T7 일치. ✓
- `schoolCode = loginId` — T2 저장·T3 조회·T5 로그인·T7 시드 일치. ✓
- students 문서 `{teacherUid,schoolCode,hakbun,name,limitType,limitValue,usedTotal,createdAt}` — T3·T7 검증 일치. ✓
- `sessions/{uid}{activeToken,updatedAt}` — T1 규칙·T6 모듈·T7 검증 일치(키 화이트리스트·serverTimestamp). ✓
- `claimSession`/`watchSession` — T6 정의·AuthProvider 사용 일치. ✓
- pad2 — T3에서 사용(기존 students route에 존재). ✓
