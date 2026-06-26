# 게시판 리뉴얼 — Plan 2: 공유링크 + 관람 PIN (구현 플랜)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교실 게시물을 외부(부모 등)가 **공유 링크 + 반 공용 관람 PIN으로 보기 전용** 열람하게 한다. 좋아요·포크·신고·수정은 불가.

**Architecture:** 관람 PIN은 `teachers/{uid}.viewPinHash`(scrypt 해시, **Admin SDK 서버 전용 쓰기**). 익명 열람은 `POST /api/share/[postId]` 가 PIN 검증·레이트리밋 후 **단기 previews 문서**(기존 `putPreview` 재사용)를 만들어 교차사이트 미리보기 URL을 돌려준다. 링크는 그 작품 1개만 연다.

**Tech Stack:** Next.js 15(App Router)·TypeScript·Firebase Admin SDK·Node `crypto`(scrypt)·기존 preview-store/교차사이트 iframe.

**선행:** Plan 1(교실 보드 비공개화) 머지 — 게시물에 `boardTeacherUid` 존재 전제.
**중요:** 이 플랜은 **firestore.rules·indexes 배포가 없다**(전부 서버 Admin SDK 경유, `shareAttempts`는 클라 match 없음=기본 거부). 검증 = `tsc`+`build`+서버 self-test+브라우저.

## 파일 맵

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/server/sharePin.ts` | PIN 해시/검증 + 레이트리밋 | 신규 |
| `app/api/teacher/view-pin/route.ts` | 교사가 관람 PIN 설정/조회 | 신규 |
| `app/teacher/page.tsx` | 관람 PIN 설정 UI | 수정 |
| `app/api/share/[postId]/route.ts` | PIN 검증→단기 미리보기 발급 | 신규 |
| `app/share/[postId]/page.tsx` | PIN 입력 + 보기 전용 렌더 | 신규 |
| `components/board/BoardView.tsx` | 교실 글 "공유 링크 복사" 버튼 | 수정 |
| `lib/client/teacher.ts` (또는 기존 teacher 클라 모듈) | view-pin authedJson 래퍼 | 수정/신규 |
| `scripts/selftest-share-pin.mjs` | 서버 self-test(미커밋) | 신규 |

**기반(재사용):** `lib/preview-store.ts`의 `putPreview(doc)`/`getPreview(id)`, `lib/program.ts`의 `buildPreviewDoc(code)`, `lib/admin/requireTeacher.ts`, `lib/client/authedFetch.ts`의 `authedJson`, 교차사이트 미리보기 GET `app/api/preview/[id]/route.ts`.

---

## Task 1: 관람 PIN 해시·검증 유틸 + 교사 설정 API

**Files:**
- Create: `lib/server/sharePin.ts`
- Create: `app/api/teacher/view-pin/route.ts`
- Test: `scripts/selftest-share-pin.mjs`

- [ ] **Step 1: 실패하는 self-test** — `scripts/selftest-share-pin.mjs`. 기존 `scripts/selftest-teacher.mjs`의 Admin SDK 초기화·교사 시드·custom token→ID token 패턴을 본떠:

```js
// 교사 T 시드 → ID 토큰 → POST /api/teacher/view-pin {pin:'4827'} → 200
// teachers/{T}.viewPinHash 가 저장됐는지 Admin SDK로 확인(평문 '4827'이 아니어야)
// GET /api/teacher/view-pin → { hasPin: true }
const res = await fetch(`${BASE}/api/teacher/view-pin`, { method:'POST', headers:authH(idToken), body: JSON.stringify({ pin:'4827' }) });
assert(res.status === 200, 'set pin 200');
const t = (await admin.firestore().doc(`teachers/${T}`).get()).data();
assert(t.viewPinHash && !t.viewPinHash.includes('4827'), 'hash stored, not plaintext');
```

- [ ] **Step 2: 실패 확인** — Run(dev 서버 필요): `npm run dev` 후 `node scripts/selftest-share-pin.mjs`. Expected: 404(라우트 없음)로 FAIL.

- [ ] **Step 3: PIN 유틸 구현** — `lib/server/sharePin.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PIN_RE = /^[0-9]{4,8}$/; // 4~8자리 숫자

export function isValidPinFormat(pin: string): boolean {
  return PIN_RE.test(pin);
}

/** 'saltHex:hashHex' 형태로 직렬화. scrypt(저비용 PIN이라 레이트리밋이 실질 방어). */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string | undefined): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, hashHex] = stored.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

- [ ] **Step 4: 교사 설정 API** — `app/api/teacher/view-pin/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { adminDb } from '@/lib/firebase/admin';
import { hashPin, isValidPinFormat } from '@/lib/server/sharePin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const snap = await adminDb.doc(`teachers/${gate.uid}`).get();
  return NextResponse.json({ hasPin: !!snap.data()?.viewPinHash });
}

export async function POST(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '요청이 올바르지 않아요.' }, { status: 400 }); }
  const pin = String((body as { pin?: unknown })?.pin ?? '');
  if (!isValidPinFormat(pin)) return NextResponse.json({ error: '관람 PIN은 숫자 4~8자리예요.' }, { status: 400 });
  await adminDb.doc(`teachers/${gate.uid}`).set({ viewPinHash: hashPin(pin) }, { merge: true });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: 통과 확인** — Run: `node scripts/selftest-share-pin.mjs`(Task1 케이스) + `./node_modules/.bin/tsc --noEmit`. Expected: PASS.

- [ ] **Step 6: 커밋**
```
git add ai-program-generator/lib/server/sharePin.ts ai-program-generator/app/api/teacher/view-pin/route.ts
git commit -m "feat(share): 관람 PIN 해시 유틸 + 교사 설정 API(viewPinHash)"
```

---

## Task 2: 교사 콘솔 관람 PIN 설정 UI

**Files:**
- Modify: `app/teacher/page.tsx` (관람 PIN 섹션/모달 — 기존 학생한도 모달 패턴 재사용)
- Modify/Create: `lib/teacher/students.ts`(또는 새 `lib/teacher/viewPin.ts`) — authedJson 래퍼

- [ ] **Step 1: 클라 래퍼** — `lib/teacher/viewPin.ts`(신규):

```ts
import { authedJson } from '@/lib/client/authedFetch';
export const getViewPinStatus = (): Promise<{ hasPin: boolean }> => authedJson('/api/teacher/view-pin');
export const setViewPin = (pin: string): Promise<{ ok: true }> =>
  authedJson('/api/teacher/view-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
```

- [ ] **Step 2: 교사 페이지에 섹션 추가** — `app/teacher/page.tsx`. 기존 모달 상태 패턴(editTarget/editVal)과 동일하게 관람 PIN 입력 모달 + "관람 PIN 정하기/바꾸기" 버튼. 표시: `hasPin`이면 "설정됨(●●●●)", 아니면 "아직 없음 — 공유가 비활성이에요". 저장은 `setViewPin(pin)`; 성공 토스트 "관람 PIN을 정했어요". 카피는 교사 대상(저학년 아님).

```tsx
// 상태
const [pinModal, setPinModal] = useState(false);
const [pinVal, setPinVal] = useState('');
const [hasPin, setHasPin] = useState(false);
useEffect(() => { getViewPinStatus().then((r) => setHasPin(r.hasPin)).catch(() => {}); }, []);
async function savePin() {
  try { await setViewPin(pinVal); setHasPin(true); setPinModal(false); setPinVal(''); toast('관람 PIN을 정했어요'); }
  catch (e) { toast(e instanceof Error ? e.message : '저장 실패'); }
}
// 렌더: 섹션 + Modal(숫자 input + 저장/취소). 기존 Button/Modal/Field 프리미티브 사용.
```

- [ ] **Step 3: 검증(브라우저)** — `npm run dev`, 교사 로그인 → 관람 PIN 정하기 → 새로고침 후 "설정됨" 유지. `./node_modules/.bin/tsc --noEmit && npm run build` PASS.

- [ ] **Step 4: 커밋**
```
git add ai-program-generator/lib/teacher/viewPin.ts ai-program-generator/app/teacher/page.tsx
git commit -m "feat(share): 교사 콘솔 관람 PIN 설정 UI"
```

---

## Task 3: 공유 API (PIN 검증 + 레이트리밋 + 단기 미리보기 발급)

**Files:**
- Modify: `lib/server/sharePin.ts` (레이트리밋 추가)
- Create: `app/api/share/[postId]/route.ts`
- Test: `scripts/selftest-share-pin.mjs` (정답/오답/레이트리밋 케이스)

- [ ] **Step 1: 실패 케이스 추가** — `scripts/selftest-share-pin.mjs`:

```js
// 교사 T(viewPinHash 설정됨) + 교실글 P(boardTeacherUid=T) 시드. 익명 fetch(토큰 없음):
// (1) 올바른 PIN → 200 + { previewId, title }
// (2) 틀린 PIN → 403
// (3) 같은 postId로 11회 연속 시도 → 11번째 429(레이트리밋, MAX=10/창)
// (4) 공개글(boardTeacherUid 없음) → 400/404(공유 대상 아님)
```

- [ ] **Step 2: 레이트리밋 유틸** — `lib/server/sharePin.ts`에 추가(Firestore 카운터, Admin SDK):

```ts
import { adminDb } from '@/lib/firebase/admin';
import { createHash } from 'node:crypto';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** postId+ip 별 슬라이딩 카운터. 초과면 false(차단). */
export async function allowShareAttempt(postId: string, ip: string): Promise<boolean> {
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  const ref = adminDb.doc(`shareAttempts/${postId}_${ipHash}`);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const d = snap.data();
    if (!d || now - (d.windowStart as number) > WINDOW_MS) {
      tx.set(ref, { windowStart: now, count: 1 });
      return true;
    }
    if ((d.count as number) >= MAX_ATTEMPTS) return false;
    tx.update(ref, { count: (d.count as number) + 1 });
    return true;
  });
}
```
> `shareAttempts`는 클라 match가 없어 기본 거부 — 규칙 변경 불필요(Admin SDK 전용).

- [ ] **Step 3: 공유 API** — `app/api/share/[postId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { buildPreviewDoc } from '@/lib/program';
import { putPreview } from '@/lib/preview-store';
import { verifyPin, allowShareAttempt } from '@/lib/server/sharePin';
import type { GeneratedCode } from '@/lib/ai/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (!(await allowShareAttempt(postId, ip))) {
    return NextResponse.json({ error: '너무 여러 번 시도했어요. 잠시 후 다시 해주세요.' }, { status: 429 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '요청이 올바르지 않아요.' }, { status: 400 }); }
  const pin = String((body as { pin?: unknown })?.pin ?? '');

  const postSnap = await adminDb.collection('posts').doc(postId).get();
  const post = postSnap.data();
  const boardTeacherUid = post?.boardTeacherUid as string | undefined;
  if (!postSnap.exists || !boardTeacherUid) {
    return NextResponse.json({ error: '공유할 수 없는 작품이에요.' }, { status: 404 }); // 공개글/없는글
  }
  const tSnap = await adminDb.doc(`teachers/${boardTeacherUid}`).get();
  if (!verifyPin(pin, tSnap.data()?.viewPinHash as string | undefined)) {
    return NextResponse.json({ error: '관람 PIN이 맞지 않아요.' }, { status: 403 });
  }
  const code = post.code as GeneratedCode;
  const previewId = await putPreview(buildPreviewDoc(code));
  return NextResponse.json({ previewId, title: (post.title as string) ?? '작품', authorName: (post.authorName as string) ?? '' });
}
```

- [ ] **Step 4: 통과 확인** — Run: `node scripts/selftest-share-pin.mjs`. Expected: (1)200·(2)403·(3)429·(4)404 모두 기대대로. `tsc --noEmit` PASS.

- [ ] **Step 5: 커밋**
```
git add ai-program-generator/lib/server/sharePin.ts ai-program-generator/app/api/share/[postId]/route.ts
git commit -m "feat(share): 공유 API — PIN 검증·레이트리밋·단기 미리보기 발급"
```

---

## Task 4: 공유 페이지 (보기 전용)

**Files:**
- Create: `app/share/[postId]/page.tsx`

- [ ] **Step 1: 공유 페이지** — `app/share/[postId]/page.tsx`. PIN 입력 폼 → `POST /api/share/[postId]` → 성공 시 교차사이트 미리보기 iframe(보기 전용, 좋아요/포크/신고/다운로드 없음):

```tsx
'use client';
import { use, useState } from 'react';

// FullscreenFrame의 previewOrigin 로직과 동일(로컬 localhost↔127 스왑 / 배포 NEXT_PUBLIC_PREVIEW_ORIGIN)
function previewOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  return process.env.NEXT_PUBLIC_PREVIEW_ORIGIN ?? `${protocol}//${hostname}${p}`;
}

export default function SharePage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const [pin, setPin] = useState('');
  const [view, setView] = useState<{ src: string; title: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/share/${postId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? '열 수 없어요.'); return; }
      setView({ src: `${previewOrigin()}/api/preview/${data.previewId}`, title: data.title });
    } catch { setError('연결에 실패했어요.'); }
    finally { setBusy(false); }
  }

  if (view) {
    return (
      <main className="min-h-screen p-4">
        <h1 className="mb-3 text-center text-[20px]">{view.title}</h1>
        <iframe src={view.src} title={view.title} sandbox="allow-scripts" className="mx-auto h-[80vh] w-full max-w-3xl rounded-[var(--r-lg)] border-2 border-line bg-white" />
        <p className="mt-3 text-center text-[13px] text-muted">보기 전용이에요.</p>
      </main>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3 text-center">
        <h1 className="text-[22px]">작품 보기</h1>
        <p className="text-[14px] text-muted">선생님이 알려준 관람 PIN을 넣어 주세요.</p>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={8}
          className="rounded-[var(--r-md)] border-2 border-line px-4 py-3 text-center text-[18px]" placeholder="관람 PIN" />
        {error && <p className="rounded-[var(--r-md)] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">{error}</p>}
        <button type="submit" disabled={busy} className="press rounded-[var(--r-md)] bg-brand px-4 py-3 text-white">{busy ? '여는 중…' : '작품 보기'}</button>
      </form>
    </main>
  );
}
```
> 보기 전용이라 `components/ui` 프리미티브 일부만 차용(공유 페이지는 비로그인·외부용 최소 화면). KID_CONTRACT가 아니라 부모 대상이라 톤은 평이하게.

- [ ] **Step 2: 검증(브라우저)** — `/share/<교실글id>` 접속 → 틀린 PIN 거부, 맞는 PIN → 미리보기 표시(보기 전용). `tsc --noEmit && npm run build` PASS.

- [ ] **Step 3: 커밋**
```
git add ai-program-generator/app/share/[postId]/page.tsx
git commit -m "feat(share): 공유 페이지(관람 PIN 입력 + 보기 전용 미리보기)"
```

---

## Task 5: 교실 글 "공유 링크 복사" 버튼

**Files:**
- Modify: `components/board/BoardView.tsx`

- [ ] **Step 1: 공유 버튼** — `components/board/BoardView.tsx`의 게시물 상세/카드에서 `post.boardTeacherUid`가 있을 때만 "공유 링크 복사" 버튼 노출. 클릭 시 `${location.origin}/share/${post.id}` 복사 + 토스트 "링크를 복사했어요. 관람 PIN과 함께 알려주세요.":

```tsx
{post.boardTeacherUid && (
  <Button variant="ghost" onClick={() => {
    navigator.clipboard.writeText(`${location.origin}/share/${post.id}`);
    toast('링크를 복사했어요. 관람 PIN과 함께 알려주세요.');
  }}>공유 링크 복사</Button>
)}
```
> 공개 글은 이미 일반 URL로 공개라 공유 버튼 불필요. 교실 글에만 노출.

- [ ] **Step 2: 검증 + 커밋** — `tsc --noEmit && npm run build` PASS, 브라우저에서 교실 글에만 버튼 보임·복사 동작.
```
git add ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(share): 교실 글 공유 링크 복사 버튼"
```

---

## Task 6: 마무리 + 회귀 점검

- [ ] **Step 1: 전체 self-test** — Run: `node scripts/selftest-share-pin.mjs`(PIN 설정·정답·오답·레이트리밋·공개글 거부 전 케이스). Expected: 모두 PASS.
- [ ] **Step 2: 빌드 + 수동 회귀** — `./node_modules/.bin/tsc --noEmit && npm run build`. 브라우저: 관람 PIN 미설정 교사의 글 공유 → 403(verifyPin이 빈 해시에 false), 설정 후 정상. 보기 전용 화면에 쓰기 UI 전무 확인.
- [ ] **Step 3: 마무리** — self-test 미커밋 유지. PR(`feat/share-pin`). `firebase deploy` **불필요**(규칙·인덱스 변경 없음) — 릴리스 노트에 명시. 배포 시 `NEXT_PUBLIC_PREVIEW_ORIGIN` 필요(기존과 동일).

---

## Self-Review (작성자 점검)

**Spec coverage:** 스펙 §4.5 전부 — 관람 PIN(별도·해시·`teachers.viewPinHash`)=Task1·2, 서버 검증+레이트리밋+단기 미리보기=Task3, 작품 1개만 보기 전용=Task4, 공유 링크=Task5. ✅
**보안:** PIN 해시(scrypt+salt) 저장·평문 미노출, 레이트리밋(postId+ip, 10회/10분), 공개글 공유 거부, 미리보기는 단기 previews(영구 URL 아님), 보기 전용(쓰기 UI 없음). ✅
**타입/이름 일관성:** `viewPinHash`(API·verify·self-test 동일), `hashPin`/`verifyPin`/`allowShareAttempt`(sharePin.ts 정의→share route 사용), `previewId`(share route 반환→share page 사용). ✅
**규칙 변경 없음:** teachers 쓰기=Admin SDK, shareAttempts=기본 거부, previews=기존. firebase 배포 불필요(Plan 1과 달리 운영 데이터·규칙 무변경). ✅
**의존:** Plan 1의 `boardTeacherUid` 전제 — Plan 1 머지 후 실행.
**한계:** 관람 PIN 반 공용(링크 가진 작품만 열림, 보드 브라우징 불가 — 의도). 레이트리밋 임계값(10/10분)은 운영 보며 조정 가능.
