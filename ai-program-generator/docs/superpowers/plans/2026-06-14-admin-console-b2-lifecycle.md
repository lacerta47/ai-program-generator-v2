# 관리자 콘솔 B-2 (계정 라이프사이클 + 학생별 한도) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 `/admin/users` 행에서 학생 계정을 정지/해제하고, 영구 삭제(계정+작품)하고, 학생별 일일 한도를 조절한다(파괴적 부분).

**Architecture:** 학생별 한도는 admin 전용 `limits/{uid}` 문서. `/api/generate`는 `readEffectiveLimit(uid)`(override ?? config ?? env)로 회귀 보존. 계정 액션은 `PATCH/DELETE /api/admin/users/[uid]`(admin 게이트 + 관리자-대상 보호 가드). 하드삭제는 Firestore writeBatch(posts·nicknames·users·limits) 먼저 → `deleteUser` 마지막(고아 닉네임 방지). 화면은 `/admin/users` 행의 "관리" 버튼 → `UserActionModal`.

**Tech Stack:** Next.js 15.5 App Router(동적 라우트 params는 Promise → `await params`), TS, firebase-admin(Auth/Firestore: updateUser/deleteUser/batch), firebase client SDK, Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + custom-token 통합 self-test.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/admin/usageConfig.ts` | 학생별 한도 read/effective/set/clear 추가 | 수정 |
| `app/api/generate/route.ts` | 비admin 한도를 `readEffectiveLimit(uid)`로 | 수정(회귀 보존) |
| `app/api/admin/users/route.ts` | limits 조인 → Member에 `limitOverride` | 수정 |
| `lib/admin/members.ts` | `Member.limitOverride: number\|null` | 수정 |
| `app/api/admin/users/[uid]/route.ts` | PATCH(정지·한도) + DELETE(하드삭제) + admin 가드 | 신규 |
| `lib/admin/accounts.ts` | `patchUser`, `deleteUserAccount` 추가 | 수정 |
| `app/admin/users/page.tsx` | "관리" 열 + UserActionModal + 실효한도 표시 | 수정 |

**계약:**
- `readUserOverride(uid): Promise<number|null>` / `readEffectiveLimit(uid): Promise<number>` / `setUserLimit(uid,n)` / `clearUserLimit(uid)`
- `PATCH /api/admin/users/[uid]` body `{disabled?:boolean, dailyLimit?:number|null}` → `{ok:true}`; `DELETE` → `{ok:true}`; admin 대상 정지·삭제 → 403
- 클라: `patchUser(uid, {disabled?,dailyLimit?})`, `deleteUserAccount(uid)`
- `Member.limitOverride: number|null`

---

## Task 1: 학생별 한도 데이터 계층 + generate/users 반영

**Files:**
- Modify: `ai-program-generator/lib/admin/usageConfig.ts` (4개 함수 추가)
- Modify: `ai-program-generator/app/api/generate/route.ts` (readEffectiveLimit)
- Modify: `ai-program-generator/app/api/admin/users/route.ts` (limits 조인)
- Modify: `ai-program-generator/lib/admin/members.ts` (limitOverride)

- [ ] **Step 1: `usageConfig.ts`에 학생별 한도 함수 추가**

`lib/admin/usageConfig.ts` 끝에 추가:
```ts
/** 학생별 한도 오버라이드(limits/{uid}.dailyLimit). 없으면 null. */
export async function readUserOverride(uid: string): Promise<number | null> {
  try {
    const snap = await adminDb.doc(`limits/${uid}`).get();
    const v = snap.exists ? (snap.data()?.dailyLimit as number | undefined) : undefined;
    return typeof v === 'number' && v >= 0 ? v : null;
  } catch (e) {
    console.error('limits 읽기 실패:', e);
    return null;
  }
}

/** 사용자의 실효 일일 한도: 오버라이드 ?? 전역(config ?? env). */
export async function readEffectiveLimit(uid: string): Promise<number> {
  const override = await readUserOverride(uid);
  return override !== null ? override : await readDailyLimit();
}

/** 학생별 한도 오버라이드 저장. */
export async function setUserLimit(uid: string, dailyLimit: number): Promise<void> {
  await adminDb.doc(`limits/${uid}`).set({ dailyLimit, updatedAt: Date.now() }, { merge: true });
}

/** 학생별 한도 오버라이드 해제(전역으로 복귀). */
export async function clearUserLimit(uid: string): Promise<void> {
  await adminDb.doc(`limits/${uid}`).delete();
}
```

- [ ] **Step 2: generate 라우트 — readEffectiveLimit로 교체**

`app/api/generate/route.ts`의 import 교체:
```ts
import { readDailyLimit } from '@/lib/admin/usageConfig';
```
를
```ts
import { readEffectiveLimit } from '@/lib/admin/usageConfig';
```
로. 그리고 비admin 블록의 호출 교체:
```ts
    const dailyLimit = await readDailyLimit();
```
을
```ts
    const dailyLimit = await readEffectiveLimit(uid);
```
로. (회귀 보존: limits/{uid} 없으면 readEffectiveLimit이 readDailyLimit(=config ?? env)로 폴백 → B-1과 동일.)

- [ ] **Step 3: users 라우트 — limits 조인 + limitOverride**

`app/api/admin/users/route.ts`의 allSettled 4개로 확장. FROM:
```ts
  const [nickRes, usageRes, postRes] = await Promise.allSettled([
    adminDb.collection('users').get(),
    adminDb.collection('usage').where('day', 'in', days).get(),
    adminDb.collection('posts').select('ownerUid').get(),
  ]);
```
TO:
```ts
  const [nickRes, usageRes, postRes, limitRes] = await Promise.allSettled([
    adminDb.collection('users').get(),
    adminDb.collection('usage').where('day', 'in', days).get(),
    adminDb.collection('posts').select('ownerUid').get(),
    adminDb.collection('limits').get(),
  ]);
```
그리고 `postCountByUid` 블록 다음(조립 직전)에 추가:
```ts
  const overrideByUid = new Map<string, number>();
  if (limitRes.status === 'fulfilled') {
    limitRes.value.forEach((d) => {
      const v = (d.data() as { dailyLimit?: number }).dailyLimit;
      if (typeof v === 'number' && v >= 0) overrideByUid.set(d.id, v);
    });
  } else {
    console.error('limits 조회 실패:', limitRes.reason);
  }
```
그리고 member 객체에 필드 추가(`usage7d` 다음):
```ts
      usage7d: days.map((d) => perDay?.get(d) ?? 0),
      limitOverride: overrideByUid.get(u.uid) ?? null,
```

- [ ] **Step 4: `members.ts`에 limitOverride 추가**

`lib/admin/members.ts`의 `Member` 인터페이스에서 `usage7d` 다음에 추가:
```ts
  usage7d: number[]; // days 순서(오래된→오늘)에 맞춘 7개
  limitOverride: number | null; // 학생별 한도(없으면 null=전역)
```

- [ ] **Step 5: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/usageConfig.ts ai-program-generator/app/api/generate/route.ts ai-program-generator/app/api/admin/users/route.ts ai-program-generator/lib/admin/members.ts
git commit -m "feat(admin-B2): 학생별 한도 데이터 계층 + generate/users 반영

readUserOverride/readEffectiveLimit/setUserLimit/clearUserLimit. generate는
override ?? config ?? env(회귀 보존), users는 limitOverride 반환.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 계정 액션 API `/api/admin/users/[uid]` (PATCH·DELETE)

**Files:**
- Create: `ai-program-generator/app/api/admin/users/[uid]/route.ts`

- [ ] **Step 1: 동적 라우트 작성**

`ai-program-generator/app/api/admin/users/[uid]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { setUserLimit, clearUserLimit } from '@/lib/admin/usageConfig';

export const runtime = 'nodejs';

/** 대상이 관리자면 정지·삭제 거부(403). 일반 계정이면 null. */
async function blockIfAdminTarget(uid: string): Promise<NextResponse | null> {
  const target = await adminAuth.getUser(uid);
  if (target.customClaims?.admin === true) {
    return NextResponse.json({ error: '관리자 계정은 정지·삭제할 수 없어요.' }, { status: 403 });
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
  const b = body as { disabled?: unknown; dailyLimit?: unknown };

  try {
    if (typeof b.disabled === 'boolean') {
      const blocked = await blockIfAdminTarget(uid);
      if (blocked) return blocked;
      await adminAuth.updateUser(uid, { disabled: b.disabled });
    }
    if ('dailyLimit' in b) {
      if (b.dailyLimit === null) {
        await clearUserLimit(uid);
      } else if (typeof b.dailyLimit === 'number' && Number.isInteger(b.dailyLimit) && b.dailyLimit >= 0) {
        await setUserLimit(uid, b.dailyLimit);
      } else {
        return NextResponse.json({ error: '한도는 0 이상의 정수 또는 null이어야 해요.' }, { status: 400 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('사용자 수정 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const { uid } = await params;

  try {
    const blocked = await blockIfAdminTarget(uid);
    if (blocked) return blocked;

    // 1) Firestore 먼저 (중간 실패 시 고아 닉네임 방지 — Auth는 마지막)
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

    // 2) Auth 마지막
    await adminAuth.deleteUser(uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('계정 삭제 실패:', e);
    return NextResponse.json({ error: '계정을 삭제하지 못했어요.' }, { status: 500 });
  }
}
```
(`FirebaseFirestore.DocumentReference`는 이 프로젝트에서 이미 쓰이는 전역 admin SDK 타입 — `app/api/generate/route.ts`의 `refundQuota` 시그니처 참고.)

- [ ] **Step 2: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. (`await params` — Next 15.5 동적 라우트.)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/app/api/admin/users/[uid]/route.ts
git commit -m "feat(admin-B2): 계정 액션 API (PATCH 정지·한도 / DELETE 하드삭제)

admin 게이트 + 관리자-대상 보호. 하드삭제는 Firestore writeBatch 먼저, Auth 마지막.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 클라이언트 액션 헬퍼

**Files:**
- Modify: `ai-program-generator/lib/admin/accounts.ts` (2개 함수 추가)

- [ ] **Step 1: `accounts.ts`에 patchUser/deleteUserAccount 추가**

`lib/admin/accounts.ts` 끝(setConfig 다음)에 추가:
```ts
export function patchUser(
  uid: string,
  body: { disabled?: boolean; dailyLimit?: number | null },
): Promise<{ ok: true }> {
  return authedFetch(`/api/admin/users/${uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function deleteUserAccount(uid: string): Promise<{ ok: true }> {
  return authedFetch(`/api/admin/users/${uid}`, { method: 'DELETE' });
}
```
(`authedFetch`는 같은 파일의 비공개 함수 — 그대로 재사용.)

- [ ] **Step 2: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/admin/accounts.ts
git commit -m "feat(admin-B2): 계정 액션 클라이언트 헬퍼(patchUser/deleteUserAccount)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `/admin/users` "관리" 열 + UserActionModal

**Files:**
- Modify: `ai-program-generator/app/admin/users/page.tsx`

- [ ] **Step 1: import 추가**

`app/admin/users/page.tsx`의 lucide import에 `Settings2, Ban, Trash2` 추가(기존: `CloudOff, RotateCcw, Search, ArrowUpRight, ArrowDownRight, Minus, ArrowUp, ArrowDown`):
```tsx
import {
  CloudOff,
  RotateCcw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ArrowUp,
  ArrowDown,
  Settings2,
  Ban,
  Trash2,
} from 'lucide-react';
```
그리고 다른 import에 추가:
```tsx
import Modal from '@/components/ui/Modal';
import { patchUser, deleteUserAccount } from '@/lib/admin/accounts';
```

- [ ] **Step 2: 액션 모달 state + reload 추가**

`UsersContent`의 state에 추가(`const [reloadKey, setReloadKey] = useState(0);` 다음):
```tsx
  const [actionMember, setActionMember] = useState<Member | null>(null);
```

- [ ] **Step 3: 헤더에 "관리" 열, 행에 실효 한도 + 관리 버튼**

`<thead>`의 `{sortHead('최근 7일', 'week')}` 다음에 추가:
```tsx
                <th className="p-3 font-medium">관리</th>
```
그리고 "오늘 사용" td를 교체. FROM:
```tsx
                  <td className="p-3">{m.isAdmin ? '무제한' : `${m.usageToday}/${usageLimit}`}</td>
```
TO:
```tsx
                  <td className="p-3">
                    {m.isAdmin ? (
                      '무제한'
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {m.usageToday}/{m.limitOverride ?? usageLimit}
                        {m.limitOverride !== null && (
                          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand-ink">맞춤</span>
                        )}
                      </span>
                    )}
                  </td>
```
그리고 "최근 7일" td(`<Sparkline>`은 이미 제거됨 — `<WeekUsage>`) 다음, `</tr>` 앞에 관리 td 추가:
```tsx
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setActionMember(m)}
                      aria-label="관리"
                      className="press rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <Settings2 size={16} aria-hidden />
                    </button>
                  </td>
```

- [ ] **Step 4: 모달 마운트**

`UsersContent`의 최상위 `</div>`(반환 JSX 끝) 직전에 추가:
```tsx
      {actionMember && (
        <UserActionModal
          member={actionMember}
          globalLimit={usageLimit}
          onClose={() => setActionMember(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
```

- [ ] **Step 5: `UserActionModal` 컴포넌트 추가**

파일 끝(`WeekUsage` 등과 같은 모듈 스코프)에 추가:
```tsx
function UserActionModal({
  member,
  globalLimit,
  onClose,
  onChanged,
}: {
  member: Member;
  globalLimit: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [limitInput, setLimitInput] = useState(
    member.limitOverride !== null ? String(member.limitOverride) : '',
  );

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast(okMsg, 'success');
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : '처리하지 못했어요.');
      setBusy(false);
    }
  }

  if (member.isAdmin) {
    return (
      <Modal open onClose={onClose} label="계정 관리" className="max-w-sm p-6">
        <h2 className="mb-2 text-[20px]">{member.nickname ?? member.email ?? '관리자'}</h2>
        <p className="text-[14px] text-muted">관리자 계정이라 정지·삭제할 수 없어요.</p>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label="계정 관리" className="max-w-sm p-6">
      <h2 className="text-[20px]">{member.nickname ?? '(별명 없음)'}</h2>
      <p className="mb-4 text-[13px] text-muted">{member.email ?? '—'}</p>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px]">{member.disabled ? '정지된 계정' : '사용 중'}</span>
          <Button
            variant="soft"
            disabled={busy}
            onClick={() =>
              act(
                () => patchUser(member.uid, { disabled: !member.disabled }),
                member.disabled ? '정지를 풀었어요.' : '계정을 정지했어요.',
              )
            }
          >
            {member.disabled ? <RotateCcw size={16} aria-hidden /> : <Ban size={16} aria-hidden />}
            {member.disabled ? ' 정지 풀기' : ' 정지'}
          </Button>
        </div>

        <div>
          <p className="mb-1 text-[14px]">하루 한도</p>
          <p className="mb-2 text-[12px] text-muted">
            지금: {member.limitOverride !== null ? `맞춤 ${member.limitOverride}회` : `기본 ${globalLimit}회`}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <TextInput
              type="number"
              min={0}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder={String(globalLimit)}
              className="w-24"
            />
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => {
                const n = Number(limitInput);
                if (!Number.isInteger(n) || n < 0) {
                  toast('한도는 0 이상의 정수여야 해요.');
                  return;
                }
                act(() => patchUser(member.uid, { dailyLimit: n }), '한도를 바꿨어요.');
              }}
            >
              적용
            </Button>
            {member.limitOverride !== null && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => act(() => patchUser(member.uid, { dailyLimit: null }), '기본 한도로 되돌렸어요.')}
              >
                기본값으로
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <Button
            variant="primary"
            disabled={busy}
            className="!bg-coral !text-white hover:!brightness-95"
            onClick={() => {
              if (!confirm(`'${member.nickname ?? member.email}' 계정과 그 작품을 영구 삭제할까요? 되돌릴 수 없어요.`)) return;
              act(() => deleteUserAccount(member.uid), '계정을 삭제했어요.');
            }}
          >
            <Trash2 size={16} aria-hidden /> 계정·작품 영구 삭제
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose} disabled={busy}>닫기</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 6: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 7: 브라우저 확인(가드)**

비로그인 `/admin/users` → 홈 리다이렉트. 콘솔 에러 0. (실제 액션은 admin 로그인 + Task 5 self-test로.)

- [ ] **Step 8: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/app/admin/users/page.tsx
git commit -m "feat(admin-B2): /admin/users 관리 열 + UserActionModal

정지/해제·학생별 한도(맞춤/기본)·계정 영구삭제(강한 확인). admin 행은 보호.
오늘 사용은 실효 한도(맞춤 우선) 표시.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 통합 self-test + 빌드 + 푸시

**Files:**
- Create: `ai-program-generator/scripts/selftest-lifecycle.mjs` (일회성, 커밋 안 함, 생성물 자동 정리)

- [ ] **Step 1: dev 서버 실행 확인** (`localhost:3000`).

- [ ] **Step 2: self-test 스크립트 작성**

`ai-program-generator/scripts/selftest-lifecycle.mjs`:
```javascript
// 계정 라이프사이클 API 통합 self-test — 실행 중인 dev 서버(localhost:3000) 대상.
// 생성한 테스트 계정/문서는 끝에서 전부 정리. 실행: node scripts/selftest-lifecycle.mjs
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
const aAuth = getAdminAuth();
const aDb = getAdminDb();
const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const BASE = 'http://localhost:3000';
const STAMP = Date.now();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK ', m); } else { fail++; console.log('  XX ', m); } };
async function idTokenFor(uid, claims) {
  const t = await aAuth.createCustomToken(uid, claims);
  await signInWithCustomToken(auth, t);
  return auth.currentUser.getIdToken();
}
const req = (tok, method, path, body) => fetch(`${BASE}${path}`, {
  method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const student = await aAuth.createUser({ email: `b2-${STAMP}@class.kr`, password: 'pw123456' });
const adminStudent = await aAuth.createUser({ email: `b2admin-${STAMP}@class.kr`, password: 'pw123456' });
await aAuth.setCustomUserClaims(adminStudent.uid, { admin: true });
const postRef = aDb.collection('posts').doc();
const nickKey = `b2nick-${STAMP}`;

try {
  const adminTok = await idTokenFor('selftest-admin', { admin: true });

  // 1) 한도 오버라이드 set → limits 문서 확인
  const r1 = await req(adminTok, 'PATCH', `/api/admin/users/${student.uid}`, { dailyLimit: 7 });
  ok(r1.status === 200, `한도 set 200 (got ${r1.status})`);
  const lim = await aDb.doc(`limits/${student.uid}`).get();
  ok(lim.exists && lim.data().dailyLimit === 7, 'limits 문서 7');

  // 2) 오버라이드 0 → 그 학생이 generate 호출 시 429(한도 0, Gemini 호출 전 차단)
  await req(adminTok, 'PATCH', `/api/admin/users/${student.uid}`, { dailyLimit: 0 });
  await signOut(auth);
  const stuTok = await idTokenFor(student.uid, {});
  const gen = await fetch(`${BASE}/api/generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${stuTok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '테스트', mode: 'generate' }),
  });
  ok(gen.status === 429, `override 0 → generate 429 (got ${gen.status})`);

  // 3) 한도 해제 → limits 문서 삭제됨
  const adminTok2 = await (async () => { await signOut(auth); return idTokenFor('selftest-admin', { admin: true }); })();
  await req(adminTok2, 'PATCH', `/api/admin/users/${student.uid}`, { dailyLimit: null });
  ok(!(await aDb.doc(`limits/${student.uid}`).get()).exists, '한도 해제 → limits 삭제');

  // 4) 정지 → getUser.disabled true, 해제 → false
  await req(adminTok2, 'PATCH', `/api/admin/users/${student.uid}`, { disabled: true });
  ok((await aAuth.getUser(student.uid)).disabled === true, '정지 → disabled true');
  await req(adminTok2, 'PATCH', `/api/admin/users/${student.uid}`, { disabled: false });
  ok((await aAuth.getUser(student.uid)).disabled === false, '해제 → disabled false');

  // 5) admin 대상 정지/삭제 → 403
  const ra = await req(adminTok2, 'PATCH', `/api/admin/users/${adminStudent.uid}`, { disabled: true });
  ok(ra.status === 403, `admin 대상 정지 403 (got ${ra.status})`);
  const rad = await req(adminTok2, 'DELETE', `/api/admin/users/${adminStudent.uid}`);
  ok(rad.status === 403, `admin 대상 삭제 403 (got ${rad.status})`);

  // 6) 하드삭제 → Auth·posts·nicknames·limits 제거
  await postRef.set({ ownerUid: student.uid, title: 'b2 test', createdAt: Date.now() });
  await aDb.doc(`nicknames/${nickKey}`).set({ uid: student.uid });
  await aDb.doc(`limits/${student.uid}`).set({ dailyLimit: 3, updatedAt: Date.now() });
  const del = await req(adminTok2, 'DELETE', `/api/admin/users/${student.uid}`);
  ok(del.status === 200, `하드삭제 200 (got ${del.status})`);
  let gone = false;
  try { await aAuth.getUser(student.uid); } catch { gone = true; }
  ok(gone, '하드삭제 → Auth 계정 제거');
  ok(!(await postRef.get()).exists, '하드삭제 → posts 제거');
  ok(!(await aDb.doc(`nicknames/${nickKey}`).get()).exists, '하드삭제 → nicknames 제거(닉네임 반환)');
  ok(!(await aDb.doc(`limits/${student.uid}`).get()).exists, '하드삭제 → limits 제거');

  // 7) 비admin → 403
  await signOut(auth);
  const userTok = await idTokenFor('selftest-plainuser', {});
  const r7 = await req(userTok, 'PATCH', `/api/admin/users/${adminStudent.uid}`, { disabled: true });
  ok(r7.status === 403, `비admin PATCH 403 (got ${r7.status})`);
} catch (e) {
  fail++; console.error('스크립트 예외:', e);
} finally {
  // 정리
  for (const id of [student.uid, adminStudent.uid]) { try { await aAuth.deleteUser(id); } catch {} }
  try { await postRef.delete(); } catch {}
  try { await aDb.doc(`nicknames/${nickKey}`).delete(); } catch {}
  try { await aDb.doc(`limits/${student.uid}`).delete(); } catch {}
  await signOut(auth).catch(() => {});
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
```

- [ ] **Step 3: self-test 실행**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && node scripts/selftest-lifecycle.mjs`
Expected: `결과: 13 pass / 0 fail` (한도 set/0→429/해제, 정지/해제, admin 정지·삭제 403, 하드삭제 4종 제거, 비admin 403). 실패 시 수정 후 재실행.

- [ ] **Step 4: dev 정지 후 프로덕션 빌드**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공. 라우트에 `/api/admin/users/[uid]` 보임.

- [ ] **Step 5: 푸시 전 점검 + 푸시**

```bash
cd /c/Users/amh47/Documents/test
git status            # selftest-lifecycle.mjs 등 일회성 미커밋 확인
git log origin/main..HEAD --oneline
```
diff 검토 + `tsc` + `npm run build` clean이면:
```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage** (스펙 B-2 대조):
- 정지/해제(updateUser disabled) → Task 2 PATCH + Task 4 모달 ✓
- 하드삭제(Firestore 먼저: posts+nicknames+users+limits, Auth 마지막) → Task 2 DELETE ✓
- 학생별 한도 오버라이드(set/clear, limits/{uid}) → Task 1 + Task 2 PATCH + Task 4 ✓
- generate override 반영(override ?? config ?? env, 회귀) → Task 1 Step2 ✓
- users 라우트 limitOverride + 화면 실효한도 표시 → Task 1 Step3/4 + Task 4 Step3 ✓
- 관리자-대상 보호(정지·삭제 403) → Task 2 blockIfAdminTarget ✓
- limits admin전용·rules 변경 없음 → 코드상 client 미접근 ✓
- 파괴적 확인모달 → Task 4 confirm ✓
- 검증(set/0→429/해제·정지·admin403·하드삭제·비admin403) → Task 5 ✓

**2. Placeholder scan:** TBD/TODO 없음. 모든 코드 단계 완전.

**3. Type consistency:**
- `Member.limitOverride: number|null` — Task 1 정의(members.ts·users 라우트) ↔ Task 4 화면·모달 사용 일치 ✓
- `readEffectiveLimit(uid)`/`setUserLimit`/`clearUserLimit`/`readUserOverride` — Task 1 정의 ↔ Task 1(generate)·Task 2(route) 사용 일치 ✓
- `patchUser(uid,{disabled?,dailyLimit?})`/`deleteUserAccount(uid)` — Task 3 정의 ↔ Task 4 모달 호출 일치 ✓
- `PATCH/DELETE /api/admin/users/[uid]` body/응답 — Task 2 ↔ Task 3 클라 ↔ Task 5 self-test 일치 ✓
- Next 15.5 `params: Promise<{uid}>` + `await params` — Task 2 ✓
- `Modal {open,onClose,label,className,children}` / `TextInput type/min/className` / `Button variant` — 기존 시그니처 일치 ✓
