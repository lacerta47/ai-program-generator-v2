# 관리자 콘솔(A) 가입자 목록 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin`을 허브+하위라우트로 재편하고, 교사가 학생 계정·닉네임·사용량을 보는 읽기 전용 가입자 목록(`/admin/users`)을 admin 전용 API로 추가한다.

**Architecture:** 가입자 목록은 `listUsers`·이메일·전체 usage 등 Admin SDK 전용 데이터라 admin 게이트(`verifyIdToken`+admin claim) API 라우트 `GET /api/admin/users`로 조립한다. `listUsers`(핵심)는 실패 시 500, 닉네임/usage/posts(부가)는 `Promise.allSettled`로 병렬+개별 폴백. 클라 가드 `AdminGate`는 UX용, 진짜 방어는 서버. KST 날짜 키 헬퍼를 공용 모듈로 추출(DRY).

**Tech Stack:** Next.js 15 App Router(Route Handler, nodejs runtime), TypeScript, firebase-admin(Auth/Firestore), firebase client SDK, Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + custom-token 통합 self-test + 브라우저.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/usageDay.ts` | KST 날짜 키(`todayKeyKST`/`lastDayKeysKST`) — 호스트 TZ 무관 | 신규 |
| `app/api/generate/route.ts` | 로컬 `todayKeyKST` 제거, `lib/usageDay`에서 import | 수정(DRY) |
| `components/admin/AdminGate.tsx` | admin 전용 가드(로딩/리다이렉트) — 3페이지 공유 | 신규 |
| `app/admin/page.tsx` | 허브(신고 처리·가입자 카드) | 재작성 |
| `app/admin/reports/page.tsx` | 기존 신고 처리 UI 이동 | 신규(이동) |
| `app/api/admin/users/route.ts` | admin 게이트 + 가입자 조립 | 신규 |
| `lib/admin/members.ts` | `Member` 타입 + `fetchMembers()` | 신규 |
| `components/admin/Sparkline.tsx` | 7일 막대(순수 CSS) | 신규 |
| `app/admin/users/page.tsx` | 가입자 표(검색·정렬·비활성 표시·상태) | 신규 |

**계약(태스크 간 의존 시그니처):**
- `todayKeyKST(): string` / `lastDayKeysKST(n: number): string[]`(오름차순, 오늘 포함)
- `Member` = `{ uid, email: string|null, nickname: string|null, createdAt: number, lastSignInAt: number|null, isAdmin: boolean, disabled: boolean, postCount: number, usageToday: number, usage7d: number[] }`
- `fetchMembers(): Promise<{ members: Member[]; usageLimit: number; days: string[] }>`
- `GET /api/admin/users` → 위 형태 JSON / 401·403·500 `{ error }`

---

## Task 1: KST 날짜 헬퍼 추출 + generate 라우트 DRY

**Files:**
- Create: `ai-program-generator/lib/usageDay.ts`
- Modify: `ai-program-generator/app/api/generate/route.ts:18-22`(로컬 함수 제거), import 추가

- [ ] **Step 1: `lib/usageDay.ts` 작성**

`ai-program-generator/lib/usageDay.ts`:
```typescript
// 한국 시간(KST) 기준 날짜 키. 호스트 타임존과 무관 — 절대 epoch(Date.now)에 +9h 후
// 항상 UTC로 출력하는 toISOString()을 쓰므로 서버/클라 어디서 돌든 동일.

/** 오늘(KST) 날짜 키 'YYYY-MM-DD' (자정에 한도 리셋). */
export function todayKeyKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 오늘 포함 최근 n일의 KST 날짜 키(오름차순: 가장 오래된 날 → 오늘). */
export function lastDayKeysKST(n: number): string[] {
  const base = Date.now() + 9 * 60 * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(new Date(base - i * DAY).toISOString().slice(0, 10));
  }
  return keys;
}
```

- [ ] **Step 2: generate 라우트가 헬퍼를 import하도록 교체**

`app/api/generate/route.ts` 상단 import 블록에 추가:
```typescript
import { todayKeyKST } from '@/lib/usageDay';
```
그리고 파일 내 로컬 정의(현재 18~22행)를 **삭제**:
```typescript
/** 한국 시간 기준 오늘 날짜 키 (자정에 한도 리셋) */
function todayKeyKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
```
(`const day = todayKeyKST();` 호출부는 그대로 — 동작 동일.)

- [ ] **Step 3: 타입체크 (회귀 확인)**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. `todayKeyKST` 중복 정의/미정의 없이 컴파일.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/usageDay.ts ai-program-generator/app/api/generate/route.ts
git commit -m "refactor(usage): KST 날짜 키를 lib/usageDay로 추출(DRY)

todayKeyKST + lastDayKeysKST. generate 라우트가 import하도록 교체(동작 동일).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: AdminGate + 콘솔 허브/하위라우트 재편

**Files:**
- Create: `ai-program-generator/components/admin/AdminGate.tsx`
- Create: `ai-program-generator/app/admin/reports/page.tsx`
- Modify(재작성): `ai-program-generator/app/admin/page.tsx`

- [ ] **Step 1: `AdminGate.tsx` 작성 (가드 추출)**

`ai-program-generator/components/admin/AdminGate.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import LoadingDots from '@/components/ui/LoadingDots';

/**
 * 관리자 전용 페이지 가드. authLoading 동안 로딩, 비admin이면 토스트+홈 리다이렉트.
 * 진짜 방어는 서버(API admin claim 검증)이고 이건 UX용. Header는 각 페이지가 바깥에서 렌더.
 */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      toast('관리자만 들어갈 수 있어요.');
      router.replace('/');
    }
  }, [loading, isAdmin, router, toast]);

  if (loading || !isAdmin) {
    return (
      <div className="py-16">
        <LoadingDots label="확인 중…" />
      </div>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: 신고 처리 UI를 `/admin/reports`로 이동**

`ai-program-generator/app/admin/reports/page.tsx` (현재 `app/admin/page.tsx`의 로직을 옮기되 가드는 `AdminGate`로 위임):
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { fetchReports, dismissReportsForPost, type Report } from '@/lib/firebase/reports';
import { deletePost } from '@/lib/firebase/posts';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';

interface ReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  items: Report[];
}

function groupReports(reports: Report[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const r of reports) {
    const g = map.get(r.postId);
    if (g) {
      g.items.push(r);
    } else {
      map.set(r.postId, {
        postId: r.postId,
        postTitle: r.postTitle,
        postAuthorName: r.postAuthorName,
        items: [r],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export default function ReportsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <ReportsContent />
      </AdminGate>
    </main>
  );
}

function ReportsContent() {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .catch((e) => {
        console.error('신고 목록 불러오기 실패:', e);
        setReports([]);
      });
  }, []);

  async function handleDelete(postId: string) {
    if (!confirm('이 작품을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await deletePost(postId);
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('작품을 삭제했어요.', 'success');
    } catch (e) {
      console.error('작품 삭제 실패:', e);
      toast('삭제하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  async function handleDismiss(postId: string) {
    try {
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('신고를 정리했어요.', 'success');
    } catch (e) {
      console.error('신고 무시 실패:', e);
      toast('처리하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  const groups = reports ? groupReports(reports) : null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">신고 처리</h1>
      {groups === null ? (
        <div className="py-10">
          <LoadingDots label="신고를 불러오는 중…" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">처리할 신고가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <ReportCard key={g.postId} group={g} onDelete={handleDelete} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  group,
  onDelete,
  onDismiss,
}: {
  group: ReportGroup;
  onDelete: (postId: string) => void;
  onDismiss: (postId: string) => void;
}) {
  return (
    <div className="anim-pop-in rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[19px]" title={group.postTitle}>
            {group.postTitle}
          </h2>
          <p className="text-[13px] text-muted">
            {group.postAuthorName || '익명'} · 신고 {group.items.length}건
          </p>
        </div>
        <a
          href={`/board?post=${group.postId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-line px-3 py-1.5 text-[13px] text-ink hover:border-brand/50"
        >
          작품 보기 <ExternalLink size={14} aria-hidden />
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {group.items.map((r) => (
          <li key={r.id} className="rounded-[var(--r-md)] border border-line px-3 py-2 text-[14px]">
            <span className="font-medium text-coral-ink">{r.reason}</span>
            {r.memo && <span className="text-ink"> — {r.memo}</span>}
            <span className="ml-2 text-[12px] text-muted">{formatDate(r.createdAt)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDismiss(group.postId)}>
          <Check size={16} aria-hidden /> 신고 무시
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => onDelete(group.postId)}
          className="!bg-coral !text-white hover:!brightness-95"
        >
          <Trash2 size={16} aria-hidden /> 작품 삭제
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `/admin`을 허브로 재작성**

`ai-program-generator/app/admin/page.tsx` 전체 교체:
```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flag, Users, ChevronRight } from 'lucide-react';
import { countReports } from '@/lib/firebase/reports';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';

export default function AdminHubPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <HubContent />
      </AdminGate>
    </main>
  );
}

function HubContent() {
  const [reportCount, setReportCount] = useState<number | null>(null);

  useEffect(() => {
    countReports()
      .then(setReportCount)
      .catch((e) => console.error('신고 수 조회 실패:', e));
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">관리자</h1>
      <div className="flex flex-col gap-3">
        <HubCard
          href="/admin/reports"
          icon={<Flag size={22} aria-hidden />}
          title="신고 처리"
          desc={reportCount ? `미처리 신고 ${reportCount}건` : '신고된 작품 검토'}
        />
        <HubCard
          href="/admin/users"
          icon={<Users size={22} aria-hidden />}
          title="가입자"
          desc="회원 목록·사용량 보기"
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="press lift flex items-center gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5 hover:border-brand/50"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px]">{title}</span>
        <span className="block text-[14px] text-muted">{desc}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 브라우저 확인**

dev 서버에서 admin 로그인 → `/admin`이 허브(신고 처리·가입자 카드)로 보임. "신고 처리" 클릭 → `/admin/reports`에서 기존 신고 화면 동작(삭제/무시). "가입자" 클릭 → `/admin/users`(아직 404 또는 미구현 — Task 4에서). 비admin/비로그인 → 홈 리다이렉트.

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/admin/AdminGate.tsx ai-program-generator/app/admin/reports/page.tsx ai-program-generator/app/admin/page.tsx
git commit -m "feat(admin): 콘솔을 허브+하위라우트로 재편

AdminGate로 가드 추출, 신고 화면을 /admin/reports로 이동, /admin은 허브.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 가입자 API 라우트 + 클라 데이터 계층

**Files:**
- Create: `ai-program-generator/lib/admin/members.ts`
- Create: `ai-program-generator/app/api/admin/users/route.ts`

- [ ] **Step 1: `lib/admin/members.ts` 작성**

`ai-program-generator/lib/admin/members.ts`:
```ts
import { auth } from '@/lib/firebase/client';

export interface Member {
  uid: string;
  email: string | null;
  nickname: string | null;
  createdAt: number; // ms
  lastSignInAt: number | null;
  isAdmin: boolean;
  disabled: boolean;
  postCount: number;
  usageToday: number;
  usage7d: number[]; // days 순서(오래된→오늘)에 맞춘 7개
}

export interface MembersResponse {
  members: Member[];
  usageLimit: number;
  days: string[];
}

/** 관리자 ID 토큰을 Bearer로 붙여 /api/admin/users 호출. */
export async function fetchMembers(): Promise<MembersResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as MembersResponse;
}
```

- [ ] **Step 2: `app/api/admin/users/route.ts` 작성**

`ai-program-generator/app/api/admin/users/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST, lastDayKeysKST } from '@/lib/usageDay';

export const runtime = 'nodejs';

const parsedLimit = Number(process.env.GEN_DAILY_LIMIT);
const DAILY_LIMIT = Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 30;

const toMs = (s?: string): number | null => (s ? new Date(s).getTime() : null);

export async function GET(req: NextRequest) {
  // 1) admin 게이트 (/api/generate와 동일 패턴)
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.admin !== true) {
      return NextResponse.json({ error: '관리자만 볼 수 있어요.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  // 2) 핵심: 가입자 명단 (실패 시 500 — 명단 없으면 표 자체가 불가)
  let users: UserRecord[];
  try {
    users = (await adminAuth.listUsers(1000)).users;
  } catch (e) {
    console.error('listUsers 실패:', e);
    return NextResponse.json({ error: '가입자 목록을 불러오지 못했어요.' }, { status: 500 });
  }

  // 3) 부가: 닉네임·사용량·작품 수 (병렬 + 개별 폴백)
  const days = lastDayKeysKST(7);
  const today = todayKeyKST();
  const [nickRes, usageRes, postRes] = await Promise.allSettled([
    adminDb.collection('users').get(),
    adminDb.collection('usage').where('day', 'in', days).get(),
    adminDb.collection('posts').select('ownerUid').get(),
  ]);

  const nickById = new Map<string, string>();
  if (nickRes.status === 'fulfilled') {
    nickRes.value.forEach((d) => {
      const n = (d.data() as { nickname?: string }).nickname;
      if (n) nickById.set(d.id, n);
    });
  } else {
    console.error('users(nickname) 조회 실패:', nickRes.reason);
  }

  const usageByUid = new Map<string, Map<string, number>>();
  if (usageRes.status === 'fulfilled') {
    usageRes.value.forEach((d) => {
      const v = d.data() as { uid?: string; day?: string; count?: number };
      if (!v.uid || !v.day) return;
      if (!usageByUid.has(v.uid)) usageByUid.set(v.uid, new Map());
      usageByUid.get(v.uid)!.set(v.day, v.count ?? 0);
    });
  } else {
    console.error('usage 조회 실패:', usageRes.reason);
  }

  const postCountByUid = new Map<string, number>();
  if (postRes.status === 'fulfilled') {
    postRes.value.forEach((d) => {
      const owner = (d.data() as { ownerUid?: string }).ownerUid;
      if (owner) postCountByUid.set(owner, (postCountByUid.get(owner) ?? 0) + 1);
    });
  } else {
    console.error('posts 조회 실패:', postRes.reason);
  }

  // 4) 조립
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
    };
  });

  return NextResponse.json({ members, usageLimit: DAILY_LIMIT, days });
}
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음(`UserRecord` import, `Member` 형태 일치).

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/members.ts ai-program-generator/app/api/admin/users/route.ts
git commit -m "feat(admin): 가입자 목록 API(/api/admin/users) + 클라 데이터 계층

admin 게이트 + listUsers(핵심) + 닉네임/usage(7일)/posts(작품수) allSettled 폴백.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Sparkline + `/admin/users` 화면

**Files:**
- Create: `ai-program-generator/components/admin/Sparkline.tsx`
- Create: `ai-program-generator/app/admin/users/page.tsx`

- [ ] **Step 1: `Sparkline.tsx` 작성**

`ai-program-generator/components/admin/Sparkline.tsx`:
```tsx
/** 작은 막대 추이(순수 CSS). 높이 = value / 최댓값. 0이어도 최소 높이로 보이게. */
export default function Sparkline({ values, max }: { values: number[]; max?: number }) {
  const peak = Math.max(max ?? 0, ...values, 1);
  return (
    <span className="inline-flex h-6 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-sm bg-brand/70"
          style={{ height: `${Math.max((v / peak) * 100, 8)}%` }}
          title={String(v)}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 2: `/admin/users` 화면 작성**

`ai-program-generator/app/admin/users/page.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudOff, RotateCcw, Search } from 'lucide-react';
import { fetchMembers, type Member } from '@/lib/admin/members';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Sparkline from '@/components/admin/Sparkline';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';

type SortKey = 'usage' | 'created';

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <UsersContent />
      </AdminGate>
    </main>
  );
}

function UsersContent() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [usageLimit, setUsageLimit] = useState(30);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('usage');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    setMembers(null);
    fetchMembers()
      .then((r) => {
        if (!alive) return;
        setMembers(r.members);
        setUsageLimit(r.usageLimit);
      })
      .catch((e) => {
        console.error('가입자 불러오기 실패:', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    if (!members) return [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? members.filter(
          (m) =>
            (m.nickname ?? '').toLowerCase().includes(term) ||
            (m.email ?? '').toLowerCase().includes(term),
        )
      : members;
    return [...filtered].sort((a, b) =>
      sort === 'usage' ? b.usageToday - a.usageToday : b.createdAt - a.createdAt,
    );
  }, [members, q, sort]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">가입자</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="닉네임·이메일 검색"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <Button variant={sort === 'usage' ? 'soft' : 'ghost'} onClick={() => setSort('usage')}>
            사용량순
          </Button>
          <Button variant={sort === 'created' ? 'soft' : 'ghost'} onClick={() => setSort('created')}>
            가입순
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-coral-soft text-coral-ink">
            <CloudOff size={26} aria-hidden />
          </span>
          <p className="text-[15px] text-muted">가입자를 불러오지 못했어요.</p>
          <Button variant="soft" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw size={16} aria-hidden /> 다시 시도
          </Button>
        </div>
      ) : members === null ? (
        <div className="py-12">
          <LoadingDots label="불러오는 중…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-muted">
          {members.length === 0 ? '가입자가 없어요.' : '검색 결과가 없어요.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-lg)] border-2 border-line">
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] text-muted">
              <tr>
                <th className="p-3 font-medium">닉네임</th>
                <th className="p-3 font-medium">이메일</th>
                <th className="p-3 font-medium">가입일</th>
                <th className="p-3 font-medium">마지막 접속</th>
                <th className="p-3 font-medium">작품</th>
                <th className="p-3 font-medium">오늘 사용</th>
                <th className="p-3 font-medium">최근 7일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.uid} className={`border-t border-line ${m.disabled ? 'opacity-50' : ''}`}>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      {m.nickname ?? <span className="text-muted">(없음)</span>}
                      {m.isAdmin && (
                        <span className="rounded-full bg-sunshine-soft px-1.5 py-0.5 text-[11px] text-sunshine-ink">
                          관리자
                        </span>
                      )}
                      {m.disabled && (
                        <span className="rounded-full bg-coral-soft px-1.5 py-0.5 text-[11px] text-coral-ink">
                          정지
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-muted">{m.email ?? '—'}</td>
                  <td className="p-3 text-muted">{m.createdAt ? formatDate(m.createdAt) : '—'}</td>
                  <td className="p-3 text-muted">
                    {m.lastSignInAt ? formatDate(m.lastSignInAt) : '—'}
                  </td>
                  <td className="p-3">{m.postCount}</td>
                  <td className="p-3">{m.isAdmin ? '무제한' : `${m.usageToday}/${usageLimit}`}</td>
                  <td className="p-3">
                    <Sparkline values={m.usage7d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 브라우저 확인**

admin 로그인 → `/admin/users` → 가입자 표(닉네임·이메일·가입일·마지막접속·작품수·오늘 사용량·7일 막대). 검색(닉/이메일)·정렬(사용량/가입순) 동작. admin 행은 "관리자" 배지+무제한, 비활성 계정 있으면 흐리게+"정지". 비admin → 홈 리다이렉트.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/admin/Sparkline.tsx ai-program-generator/app/admin/users/page.tsx
git commit -m "feat(admin): 가입자 목록 화면 /admin/users

표(닉네임·이메일·가입일·마지막접속·작품수·오늘사용량·7일막대) + 검색·정렬
+ 비활성 표시. Sparkline은 순수 CSS.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 통합 self-test + 빌드 + 푸시

**Files:**
- Create: `ai-program-generator/scripts/selftest-admin-users.mjs` (일회성, 커밋 안 함)

- [ ] **Step 1: dev 서버 실행 확인**

self-test는 실행 중인 dev 서버의 `/api/admin/users`를 HTTP로 친다. dev 서버가 `localhost:3000`에 떠 있어야 함(없으면 `npm run dev`로 기동).

- [ ] **Step 2: self-test 스크립트 작성**

`ai-program-generator/scripts/selftest-admin-users.mjs` (기존 `selftest-reports.mjs`와 같은 custom-token 방식):
```javascript
// 가입자 API 통합 self-test — 실행 중인 dev 서버(localhost:3000) 대상.
// 실행: node scripts/selftest-admin-users.mjs
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
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
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const BASE = 'http://localhost:3000';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK ', m); } else { fail++; console.log('  XX ', m); } };

async function idTokenFor(uid, claims) {
  const t = await getAdminAuth().createCustomToken(uid, claims);
  await signInWithCustomToken(auth, t);
  return auth.currentUser.getIdToken();
}

try {
  // 1) admin → 200 + 형태
  const adminTok = await idTokenFor('selftest-admin', { admin: true });
  const r1 = await fetch(`${BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${adminTok}` } });
  const d1 = await r1.json().catch(() => ({}));
  ok(r1.status === 200, `admin 200 (got ${r1.status})`);
  ok(Array.isArray(d1.members), 'members 배열');
  ok(typeof d1.usageLimit === 'number', 'usageLimit 숫자');
  ok(Array.isArray(d1.days) && d1.days.length === 7, 'days 7개');
  if (Array.isArray(d1.members) && d1.members[0]) {
    const m = d1.members[0];
    ok(
      'uid' in m && 'email' in m && 'disabled' in m && Array.isArray(m.usage7d) && m.usage7d.length === 7,
      'member 필드 형태(uid/email/disabled/usage7d[7])',
    );
  } else {
    console.log('  (가입자 0명 — member 형태 검사 건너뜀)');
  }

  // 2) 비admin → 403
  await signOut(auth);
  const userTok = await idTokenFor('selftest-plainuser', {});
  const r2 = await fetch(`${BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${userTok}` } });
  ok(r2.status === 403, `비admin 403 (got ${r2.status})`);

  // 3) 토큰 없음 → 401
  const r3 = await fetch(`${BASE}/api/admin/users`);
  ok(r3.status === 401, `토큰없음 401 (got ${r3.status})`);
} catch (e) {
  fail++; console.error('스크립트 예외:', e);
} finally {
  await signOut(auth).catch(() => {});
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
```

- [ ] **Step 3: self-test 실행**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && node scripts/selftest-admin-users.mjs`
Expected: `결과: 6 pass / 0 fail` (admin 200·members 배열·usageLimit·days7·member형태 / 비admin 403 / 토큰없음 401). 실패 시 라우트 수정 후 재실행.
(부분 실패 폴백은 `Promise.allSettled` 구조로 보장 — fault 주입은 생략하고 코드로 확인.)

- [ ] **Step 4: dev 정지 후 프로덕션 빌드**

dev 서버를 끄고(.next 공유 충돌 방지):
Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공. 라우트 목록에 `/admin`, `/admin/reports`, `/admin/users`, `/api/admin/users`가 보임(각 코드 스플릿).

- [ ] **Step 5: 푸시 전 점검 + 푸시**(pre-push 프로세스)

```bash
cd /c/Users/amh47/Documents/test
git status            # selftest-admin-users.mjs 등 일회성 스크립트는 미커밋 확인
git log origin/main..HEAD --oneline
git diff origin/main --stat
```
diff 검토 + `tsc --noEmit` + `npm run build` 모두 clean이면:
```bash
git push origin main
```
Expected: Task 1~4 커밋이 origin/main에 반영.

---

## Self-Review

**1. Spec coverage** (스펙 §대조):
- 콘솔 허브+하위라우트(/admin 허브, /admin/reports 이동, /admin/users) → Task 2 ✓
- `GET /api/admin/users` admin 게이트 + listUsers(핵심·500) + allSettled 부가 폴백 → Task 3 ✓
- KST 헬퍼 추출 + generate DRY → Task 1 ✓
- `Member`(disabled 포함) + `fetchMembers` → Task 3 ✓
- AdminGate(가드 공유) + Sparkline(CSS) → Task 2/Task 4 ✓
- 화면 컬럼·검색·정렬·비활성 흐리게+정지배지·상태 → Task 4 ✓
- 검증: tsc+빌드+통합 self-test(200·형태·403·401) → Task 5 ✓
- 성능/배포 주의 = 설계 문서 기재(코드 변경 없음) ✓

**2. Placeholder scan:** TBD/TODO/"적절히" 없음. 모든 코드 단계 완전.

**3. Type consistency:**
- `Member` 필드(uid/email/nickname/createdAt/lastSignInAt/isAdmin/disabled/postCount/usageToday/usage7d) — Task 3 정의 ↔ Task 4 표 사용 ↔ Task 5 형태검사 일치 ✓
- `MembersResponse`(members/usageLimit/days) — API 반환 ↔ `fetchMembers` ↔ users 화면 사용 일치 ✓
- `todayKeyKST`/`lastDayKeysKST(7)` — Task 1 정의 ↔ Task 3 사용 일치 ✓
- `AdminGate` props `{ children }` — Task 2 정의 ↔ Task 2/4 페이지 사용 일치 ✓
- `Sparkline` props `{ values, max? }` — Task 4 정의 ↔ 사용 일치 ✓
- `formatDate(ms: number)` — `createdAt`/`lastSignInAt`(number) 일치 ✓
- API 게이트는 `/api/generate`와 동일 토큰/claim 패턴 재사용(검증됨) ✓
