# 관리자 콘솔 B-1 (계정 생성 + 전역 한도) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 `/admin/accounts`에서 수업용 계정을 개별·일괄 생성하고 전역 일일 한도를 조정한다(비파괴적 부분만; 정지/삭제/학생별 오버라이드는 B-2).

**Architecture:** 전역 한도를 `config/usage`(admin 전용 문서)에 두고 서버 헬퍼 `readDailyLimit`(config ?? env)로 `/api/generate`·`/api/admin/users`·`/api/admin/config`가 공유(DRY, 회귀 보존). 계정 생성은 admin 게이트 `POST /api/admin/accounts`에서 Admin SDK `createUser`로, 일괄은 순차 루프+계정별 try/catch로 rate-limit 회피. 비번은 생성 직후 응답으로 1회 echo해 화면 표로 노출.

**Tech Stack:** Next.js 15 App Router(Route Handler, nodejs runtime), TypeScript, firebase-admin(Auth/Firestore), firebase client SDK, Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + custom-token 통합 self-test.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/admin/usageConfig.ts` | 전역 한도 read/write(config/usage ?? env) — 서버 전용 | 신규 |
| `lib/admin/requireAdmin.ts` | API 라우트 admin 게이트(Bearer+claim) 공용 | 신규 |
| `app/api/admin/accounts/route.ts` | POST 계정 생성(개별·일괄, 순차) | 신규 |
| `app/api/admin/config/route.ts` | GET/PATCH 전역 한도 | 신규 |
| `lib/admin/accounts.ts` | 클라 헬퍼(createAccounts/getConfig/setConfig) | 신규 |
| `app/admin/accounts/page.tsx` | 계정 관리 화면(전역한도+개별+일괄+결과표) | 신규 |
| `app/admin/page.tsx` | 허브에 "계정 관리" 카드 추가 | 수정 |
| `app/api/generate/route.ts` | 한도를 `readDailyLimit()`로(회귀 보존) | 수정 |
| `app/api/admin/users/route.ts` | `usageLimit`을 `readDailyLimit()`로 | 수정 |

**계약(태스크 간 의존 시그니처):**
- `readDailyLimit(): Promise<number>` / `writeDailyLimit(n: number): Promise<void>` / `ENV_DAILY_LIMIT: number`
- `requireAdmin(req): Promise<NextResponse | null>` (null=통과)
- `POST /api/admin/accounts` body `{mode:'single',email,password}|{mode:'batch',prefix,count,password}` → `{ created:{email,password}[], skipped:{email,reason}[] }`
- `GET/PATCH /api/admin/config` → `{ dailyLimit: number }`
- 클라: `createAccounts(body)`, `getConfig()`, `setConfig(n)`

---

## Task 1: 전역 한도 헬퍼 + generate/users 라우트 회귀 보존 수정

**Files:**
- Create: `ai-program-generator/lib/admin/usageConfig.ts`
- Modify: `ai-program-generator/app/api/generate/route.ts` (모듈 상수 제거, 핸들러에서 readDailyLimit)
- Modify: `ai-program-generator/app/api/admin/users/route.ts` (usageLimit = readDailyLimit)

- [ ] **Step 1: `lib/admin/usageConfig.ts` 작성**

`ai-program-generator/lib/admin/usageConfig.ts`:
```ts
import { adminDb } from '@/lib/firebase/admin';

const parsedLimit = Number(process.env.GEN_DAILY_LIMIT);
/** env 기본 일일 한도(설정·오버라이드 없을 때 폴백). 0 허용. */
export const ENV_DAILY_LIMIT =
  Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 30;

/** 전역 일일 한도: config/usage.dailyLimit ?? env. 읽기 실패 시 env 폴백. */
export async function readDailyLimit(): Promise<number> {
  try {
    const snap = await adminDb.doc('config/usage').get();
    const v = snap.exists ? (snap.data()?.dailyLimit as number | undefined) : undefined;
    return typeof v === 'number' && v >= 0 ? v : ENV_DAILY_LIMIT;
  } catch (e) {
    console.error('config/usage 읽기 실패:', e);
    return ENV_DAILY_LIMIT;
  }
}

/** 전역 일일 한도 저장(admin 전용). */
export async function writeDailyLimit(dailyLimit: number): Promise<void> {
  await adminDb.doc('config/usage').set({ dailyLimit, updatedAt: Date.now() }, { merge: true });
}
```

- [ ] **Step 2: generate 라우트 — 모듈 상수 제거 + import**

`app/api/generate/route.ts` 상단의 다음 3줄(주석 + 2 const)을 **삭제**:
```ts
// 계정당 하루 생성 한도 (관리자는 무제한). env로 조정 가능. (0 = 전체 차단도 허용)
const parsedLimit = Number(process.env.GEN_DAILY_LIMIT);
const DAILY_LIMIT = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 30;
```
그리고 import 블록에 추가:
```ts
import { readDailyLimit } from '@/lib/admin/usageConfig';
```

- [ ] **Step 3: generate 라우트 — 핸들러에서 실효 한도 사용**

`app/api/generate/route.ts`의 비admin 한도 블록을 교체. 기존:
```ts
  if (!isAdmin) {
    try {
      const allowed = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const count = (snap.data()?.count as number | undefined) ?? 0;
        if (count >= DAILY_LIMIT) return false;
        tx.set(usageRef, { uid, day, count: count + 1, updatedAt: Date.now() }, { merge: true });
        return true;
      });
      if (!allowed) {
        return NextResponse.json(
          { error: `오늘 만들 수 있는 횟수(${DAILY_LIMIT}번)를 모두 썼어요. 내일 다시 만들어 보세요!` },
          { status: 429 },
        );
      }
```
교체:
```ts
  if (!isAdmin) {
    const dailyLimit = await readDailyLimit();
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
```
(회귀 보존: config 문서가 없으면 `readDailyLimit`이 env(30)을 반환 → 기존과 동일.)

- [ ] **Step 4: users 라우트(A) — usageLimit을 readDailyLimit로**

`app/api/admin/users/route.ts` 상단의 다음 2줄을 **삭제**:
```ts
const parsedLimit = Number(process.env.GEN_DAILY_LIMIT);
const DAILY_LIMIT = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 30;
```
import 블록에 추가:
```ts
import { readDailyLimit } from '@/lib/admin/usageConfig';
```
그리고 마지막 반환문을 교체. 기존:
```ts
  return NextResponse.json({ members, usageLimit: DAILY_LIMIT, days });
```
교체:
```ts
  const usageLimit = await readDailyLimit();
  return NextResponse.json({ members, usageLimit, days });
```

- [ ] **Step 5: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. `DAILY_LIMIT` 미정의/중복 없음.

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/usageConfig.ts ai-program-generator/app/api/generate/route.ts ai-program-generator/app/api/admin/users/route.ts
git commit -m "feat(admin-B1): 전역 일일 한도 헬퍼(config/usage ?? env) + 라우트 반영

readDailyLimit/writeDailyLimit. generate·users 라우트가 공유(회귀 보존: config 없으면 env).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: admin 게이트 + 계정 생성 / 전역 한도 API

**Files:**
- Create: `ai-program-generator/lib/admin/requireAdmin.ts`
- Create: `ai-program-generator/app/api/admin/accounts/route.ts`
- Create: `ai-program-generator/app/api/admin/config/route.ts`

- [ ] **Step 1: `lib/admin/requireAdmin.ts` 작성**

`ai-program-generator/lib/admin/requireAdmin.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

/** Bearer ID 토큰 + admin claim 검증. 통과면 null, 아니면 401/403 응답. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.admin !== true) {
      return NextResponse.json({ error: '관리자만 할 수 있어요.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }
  return null;
}
```

- [ ] **Step 2: `app/api/admin/accounts/route.ts` 작성**

`ai-program-generator/app/api/admin/accounts/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';

export const runtime = 'nodejs';

const DOMAIN = 'class.kr';
const PREFIX_RE = /^[a-z0-9-]+$/;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

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

  let emails: string[];
  let password: string;

  if (b.mode === 'single') {
    const email = typeof b.email === 'string' ? b.email.trim() : '';
    password = typeof b.password === 'string' ? b.password : '';
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: '이메일을 올바르게 입력해 주세요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
    }
    emails = [email];
  } else if (b.mode === 'batch') {
    const prefix = typeof b.prefix === 'string' ? b.prefix.trim() : '';
    const count = typeof b.count === 'number' ? Math.floor(b.count) : 0;
    password = typeof b.password === 'string' ? b.password : '';
    if (!PREFIX_RE.test(prefix)) {
      return NextResponse.json({ error: "반 이름은 영문 소문자·숫자·'-'만 돼요." }, { status: 400 });
    }
    if (count < 1 || count > 50) {
      return NextResponse.json({ error: '인원수는 1~50명까지예요.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 해요.' }, { status: 400 });
    }
    emails = Array.from({ length: count }, (_, i) => `${prefix}-${pad2(i + 1)}@${DOMAIN}`);
  } else {
    return NextResponse.json({ error: "mode는 'single' 또는 'batch' 여야 해요." }, { status: 400 });
  }

  // 순차 생성(계정별 try/catch — Auth rate-limit 회피)
  const created: { email: string; password: string }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  for (const email of emails) {
    try {
      await adminAuth.createUser({ email, password });
      created.push({ email, password });
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      const reason =
        code === 'auth/email-already-exists'
          ? '이미 있는 아이디'
          : (e as Error).message || '생성 실패';
      skipped.push({ email, reason });
    }
  }

  return NextResponse.json({ created, skipped });
}
```

- [ ] **Step 3: `app/api/admin/config/route.ts` 작성**

`ai-program-generator/app/api/admin/config/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { readDailyLimit, writeDailyLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  return NextResponse.json({ dailyLimit: await readDailyLimit() });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바르지 않아요.' }, { status: 400 });
  }
  const v = (body as { dailyLimit?: unknown })?.dailyLimit;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    return NextResponse.json({ error: '한도는 0 이상의 정수여야 해요.' }, { status: 400 });
  }
  await writeDailyLimit(v);
  return NextResponse.json({ dailyLimit: v });
}
```

- [ ] **Step 4: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/requireAdmin.ts ai-program-generator/app/api/admin/accounts/route.ts ai-program-generator/app/api/admin/config/route.ts
git commit -m "feat(admin-B1): 계정 생성 API + 전역 한도 API + 공용 admin 게이트

POST /api/admin/accounts(개별·일괄 순차 생성), GET/PATCH /api/admin/config.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 클라이언트 데이터 계층

**Files:**
- Create: `ai-program-generator/lib/admin/accounts.ts`

- [ ] **Step 1: `lib/admin/accounts.ts` 작성**

`ai-program-generator/lib/admin/accounts.ts`:
```ts
import { auth } from '@/lib/firebase/client';

export interface CreateResult {
  created: { email: string; password: string }[];
  skipped: { email: string; reason: string }[];
}

export type CreateBody =
  | { mode: 'single'; email: string; password: string }
  | { mode: 'batch'; prefix: string; count: number; password: string };

async function authedFetch(path: string, init?: RequestInit) {
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

export function createAccounts(body: CreateBody): Promise<CreateResult> {
  return authedFetch('/api/admin/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getConfig(): Promise<{ dailyLimit: number }> {
  return authedFetch('/api/admin/config');
}

export function setConfig(dailyLimit: number): Promise<{ dailyLimit: number }> {
  return authedFetch('/api/admin/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dailyLimit }),
  });
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/accounts.ts
git commit -m "feat(admin-B1): 계정/한도 클라이언트 데이터 계층

createAccounts/getConfig/setConfig — ID 토큰 Bearer로 admin API 호출.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 계정 관리 화면 + 허브 카드

**Files:**
- Create: `ai-program-generator/app/admin/accounts/page.tsx`
- Modify: `ai-program-generator/app/admin/page.tsx` (허브 카드 추가)

- [ ] **Step 1: `app/admin/accounts/page.tsx` 작성**

`ai-program-generator/app/admin/accounts/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users2, Copy, Check, Settings2 } from 'lucide-react';
import { createAccounts, getConfig, setConfig, type CreateResult } from '@/lib/admin/accounts';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';

export default function AdminAccountsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
          <h1 className="text-[24px]">계정 관리</h1>
          <GlobalLimit />
          <CreateForms />
        </div>
      </AdminGate>
    </main>
  );
}

function GlobalLimit() {
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getConfig()
      .then((c) => { if (alive) setLimit(String(c.dailyLimit)); })
      .catch((e) => console.error('한도 불러오기 실패:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function save() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) {
      toast('한도는 0 이상의 정수여야 해요.');
      return;
    }
    setBusy(true);
    try {
      await setConfig(n);
      toast('전역 한도를 바꿨어요.', 'success');
    } catch (e) {
      console.error(e);
      toast('한도를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 text-[18px]">
        <Settings2 size={18} aria-hidden /> 전역 일일 한도
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        모든 학생이 하루에 만들 수 있는 기본 횟수예요. (학생별 조절은 가입자 목록에서)
      </p>
      {loading ? (
        <LoadingDots label="불러오는 중…" />
      ) : (
        <div className="flex items-end gap-2">
          <Label text="하루 횟수">
            <TextInput type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-28" />
          </Label>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</Button>
        </div>
      )}
    </section>
  );
}

function CreateForms() {
  const { toast } = useToast();
  const [result, setResult] = useState<CreateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [singlePw, setSinglePw] = useState('');
  const [prefix, setPrefix] = useState('');
  const [count, setCount] = useState('10');
  const [batchPw, setBatchPw] = useState('');

  async function run(fn: () => Promise<CreateResult>) {
    setBusy(true);
    setResult(null);
    try {
      const r = await fn();
      setResult(r);
      if (r.created.length) toast(`${r.created.length}개 계정을 만들었어요.`, 'success');
      else toast('새로 만든 계정이 없어요.');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : '계정을 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[18px]"><UserPlus size={18} aria-hidden /> 개별 만들기</h2>
        <div className="flex flex-col gap-3">
          <Label text="아이디(이메일)">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hong@class.kr" />
          </Label>
          <Label text="비밀번호 (6자 이상)">
            <TextInput value={singlePw} onChange={(e) => setSinglePw(e.target.value)} />
          </Label>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => createAccounts({ mode: 'single', email: email.trim(), password: singlePw }))}
            >
              만들기
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[18px]"><Users2 size={18} aria-hidden /> 반 단위로 만들기</h2>
        <p className="mb-3 text-[13px] text-muted">아이디는 <span className="text-ink">반이름-01@class.kr</span> 처럼 자동으로 붙어요.</p>
        <div className="flex flex-col gap-3">
          <Label text="반 이름 (영문 소문자·숫자·-)">
            <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="3-1" />
          </Label>
          <div className="flex flex-wrap gap-3">
            <Label text="인원수 (1~50)">
              <TextInput type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
            </Label>
            <Label text="반 공통 비밀번호 (6자 이상)">
              <TextInput value={batchPw} onChange={(e) => setBatchPw(e.target.value)} />
            </Label>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => createAccounts({ mode: 'batch', prefix: prefix.trim(), count: Number(count), password: batchPw }))}
            >
              만들기
            </Button>
          </div>
        </div>
      </section>

      {result && <ResultPanel result={result} />}
    </>
  );
}

function ResultPanel({ result }: { result: CreateResult }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = result.created.map((c) => `${c.email}\t${c.password}`).join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast('복사했어요.', 'success');
      },
      () => toast('복사하지 못했어요.'),
    );
  }

  return (
    <section className="rounded-[var(--r-lg)] border-2 border-mint/50 bg-mint-soft/40 p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[18px]">만든 계정 ({result.created.length})</h2>
        {result.created.length > 0 && (
          <Button variant="soft" onClick={copyAll}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} 전체 복사
          </Button>
        )}
      </div>
      <p className="mb-3 text-[13px] text-coral-ink">비밀번호는 지금만 볼 수 있어요. 꼭 복사해 두세요.</p>
      {result.created.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-line bg-surface">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] text-muted">
              <tr><th className="p-2.5 font-medium">아이디</th><th className="p-2.5 font-medium">비밀번호</th></tr>
            </thead>
            <tbody>
              {result.created.map((c) => (
                <tr key={c.email} className="border-t border-line">
                  <td className="p-2.5">{c.email}</td>
                  <td className="p-2.5">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.skipped.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[14px] text-muted">건너뛴 계정 ({result.skipped.length}):</p>
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {result.skipped.map((s) => (
              <li key={s.email}>{s.email} — {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: 허브에 "계정 관리" 카드 추가**

`app/admin/page.tsx`의 lucide import에 `UserPlus` 추가:
```tsx
import { Flag, Users, ChevronRight, UserPlus } from 'lucide-react';
```
그리고 "가입자" HubCard 다음에 카드 추가:
```tsx
        <HubCard
          href="/admin/accounts"
          icon={<UserPlus size={22} aria-hidden />}
          title="계정 관리"
          desc="수업용 계정 만들기·한도"
        />
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 브라우저 확인(가드만)**

dev 서버에서 비로그인 `/admin/accounts` → 홈 리다이렉트(AdminGate). 콘솔 에러 0. (실제 생성·표는 admin 로그인 + Task 5 self-test로 검증.)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/app/admin/accounts/page.tsx ai-program-generator/app/admin/page.tsx
git commit -m "feat(admin-B1): 계정 관리 화면 /admin/accounts + 허브 카드

전역 한도 설정 + 개별/일괄 생성 + 생성 결과 자격증명 표(복사)·건너뜀 안내.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 통합 self-test + 빌드 + 푸시

**Files:**
- Create: `ai-program-generator/scripts/selftest-accounts.mjs` (일회성, 커밋 안 함, 생성 계정 자동 정리)

- [ ] **Step 1: dev 서버 실행 확인**

self-test는 실행 중인 dev 서버의 `/api/admin/*`를 HTTP로 친다. `localhost:3000`에 떠 있어야 함(없으면 `npm run dev`).

- [ ] **Step 2: self-test 스크립트 작성**

`ai-program-generator/scripts/selftest-accounts.mjs` (생성한 계정은 finally에서 전부 삭제, config 원복):
```javascript
// 계정 생성/한도 API 통합 self-test — 실행 중인 dev 서버(localhost:3000) 대상.
// 생성한 테스트 계정과 config 변경은 끝에서 원복한다. 실행: node scripts/selftest-accounts.mjs
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sa = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
initAdmin({ credential: cert(sa) });
const adminAuth = getAdminAuth();
const adminDb = getAdminDb();
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const BASE = 'http://localhost:3000';
const STAMP = Date.now();
const PREFIX = `selftest${STAMP}`;
const SINGLE = `selftest-${STAMP}@class.kr`;
const createdEmails = [];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK ', m); } else { fail++; console.log('  XX ', m); } };
async function idTokenFor(uid, claims) {
  const t = await adminAuth.createCustomToken(uid, claims);
  await signInWithCustomToken(auth, t);
  return auth.currentUser.getIdToken();
}
const post = (tok, path, body) => fetch(`${BASE}${path}`, {
  method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

let originalLimit = 30;
try {
  const adminTok = await idTokenFor('selftest-admin', { admin: true });

  // 1) 개별 생성
  const r1 = await post(adminTok, '/api/admin/accounts', { mode: 'single', email: SINGLE, password: 'pw123456' });
  const d1 = await r1.json().catch(() => ({}));
  ok(r1.status === 200 && d1.created?.length === 1, `개별 생성 (got ${r1.status})`);
  d1.created?.forEach((c) => createdEmails.push(c.email));

  // 2) 일괄 생성 3명
  const r2 = await post(adminTok, '/api/admin/accounts', { mode: 'batch', prefix: PREFIX, count: 3, password: 'pw123456' });
  const d2 = await r2.json().catch(() => ({}));
  ok(r2.status === 200 && d2.created?.length === 3, `일괄 3명 생성 (created ${d2.created?.length})`);
  d2.created?.forEach((c) => createdEmails.push(c.email));

  // 3) 같은 prefix 재생성 → 3건 skip(이미 있음)
  const r3 = await post(adminTok, '/api/admin/accounts', { mode: 'batch', prefix: PREFIX, count: 3, password: 'pw123456' });
  const d3 = await r3.json().catch(() => ({}));
  ok(d3.skipped?.length === 3 && d3.created?.length === 0, `중복 3건 skip (skipped ${d3.skipped?.length})`);

  // 4) config GET → PATCH 5 → GET 5
  const g0 = await fetch(`${BASE}/api/admin/config`, { headers: { Authorization: `Bearer ${adminTok}` } });
  originalLimit = (await g0.json()).dailyLimit ?? 30;
  const p = await fetch(`${BASE}/api/admin/config`, { method: 'PATCH', headers: { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyLimit: 5 }) });
  ok(p.status === 200, `config PATCH (got ${p.status})`);
  const g1 = await fetch(`${BASE}/api/admin/config`, { headers: { Authorization: `Bearer ${adminTok}` } });
  ok((await g1.json()).dailyLimit === 5, 'config GET 반영 5');

  // 5) 비admin → 403
  await signOut(auth);
  const userTok = await idTokenFor('selftest-plainuser', {});
  const r5 = await post(userTok, '/api/admin/accounts', { mode: 'single', email: 'x@class.kr', password: 'pw123456' });
  ok(r5.status === 403, `비admin accounts 403 (got ${r5.status})`);
} catch (e) {
  fail++; console.error('스크립트 예외:', e);
} finally {
  // 정리: 생성 계정 삭제 + config 원복
  for (const email of createdEmails) {
    try { const u = await adminAuth.getUserByEmail(email); await adminAuth.deleteUser(u.uid); } catch {}
  }
  try { await adminDb.doc('config/usage').set({ dailyLimit: originalLimit, updatedAt: Date.now() }, { merge: true }); } catch {}
  await signOut(auth).catch(() => {});
  console.log(`\n정리: 계정 ${createdEmails.length}개 삭제, config ${originalLimit} 원복`);
  console.log(`결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
```

- [ ] **Step 3: self-test 실행**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && node scripts/selftest-accounts.mjs`
Expected: `결과: 6 pass / 0 fail` (개별·일괄·중복skip·config PATCH·config GET·비admin403) + 생성 계정 자동 삭제 + config 원복 로그. 실패 시 라우트 수정 후 재실행.

- [ ] **Step 4: dev 정지 후 프로덕션 빌드**

dev를 끄고:
Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공. 라우트에 `/admin/accounts`, `/api/admin/accounts`, `/api/admin/config` 보임.

- [ ] **Step 5: 푸시 전 점검 + 푸시**

```bash
cd /c/Users/amh47/Documents/test
git status            # selftest-accounts.mjs 등 일회성은 미커밋 확인
git log origin/main..HEAD --oneline
```
diff 검토 + `tsc` + `npm run build` clean이면:
```bash
git push origin main
```
Expected: Task 1~4 커밋이 origin/main에 반영.

---

## Self-Review

**1. Spec coverage** (스펙 B-1 부분 대조):
- 전역 한도(config/usage ?? env) + readDailyLimit 공유 → Task 1 ✓
- generate 회귀 보존(config 없으면 env) → Task 1 Step3 ✓
- A users 라우트 usageLimit = config → Task 1 Step4 ✓
- POST accounts(개별·일괄·순차·class.kr·prefix/count/password 검증·created/skipped) → Task 2 ✓
- GET/PATCH config → Task 2 ✓
- 클라 createAccounts/getConfig/setConfig → Task 3 ✓
- /admin/accounts(전역한도+개별+일괄+자격증명표 1회+skipped) → Task 4 ✓
- 허브 카드 → Task 4 ✓
- config admin전용·rules 변경 없음(default deny) → 코드상 client 미접근 ✓
- 검증(tsc+빌드+self-test 생성·중복·config·403) → Task 5 ✓

**2. Placeholder scan:** TBD/TODO/"적절히" 없음. 모든 코드 단계 완전.

**3. Type consistency:**
- `CreateResult`(created/skipped) — Task 2 라우트 반환 ↔ Task 3 클라 타입 ↔ Task 4 화면 ↔ Task 5 self-test 일치 ✓
- `CreateBody`(single/batch 합) — Task 3 정의 ↔ Task 4 호출 일치 ✓
- `readDailyLimit`/`writeDailyLimit`/`ENV_DAILY_LIMIT` — Task 1 정의 ↔ Task 1·2 사용 일치 ✓
- `requireAdmin(req)` 반환 `NextResponse|null` — Task 2 정의 ↔ accounts·config 라우트 사용 일치 ✓
- `{ dailyLimit }` — config 라우트 ↔ getConfig/setConfig ↔ GlobalLimit 일치 ✓
- `Label text=` / `TextInput type/min/className` — Field 시그니처(InputHTMLAttributes 스프레드) 일치 ✓
