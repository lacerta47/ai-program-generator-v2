# few-shot exemplar 라이브러리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판 인기글을 관리자 승인으로 동결해 generate 프롬프트에 참고 예시 1개를 주입, 생성 완성도 floor를 끌어올린다.

**Architecture:** variant(default/survey)별 포인터 문서(`exemplars/active_default`·`active_survey`)에 압축·동결된 예시를 저장한다(서버 Admin SDK 전용). 생성 라우트는 generate 모드에서 해당 슬롯을 읽어 순수 함수로 만든 참고 예시 블록을 사용자 프롬프트 앞에 붙인다. 승인·조회·삭제는 admin 전용 API + 어드민 콘솔 페이지로 한다.

**Tech Stack:** Next.js 15(App Router, route handlers), Firebase Admin SDK(Firestore), TypeScript, Tailwind v4, 기존 `components/ui` 프리미티브.

**검증 방식 (이 프로젝트 특이사항):** 테스트 프레임워크 없음(CLAUDE.md). 순수 함수는 `.selftest-build` 컴파일 후 `node:assert` 스크립트로 단위 검증(기존 `scripts/selftest-survey.mjs`와 동일 패턴). 그 외는 `./node_modules/.bin/tsc --noEmit` + `npm run build` + 브라우저 확인. `npm run build`는 dev 서버와 `.next`를 공유하므로 dev 서버를 끈 상태에서 실행.

**브랜치:** 작업은 이미 `feature/ai-generation-quality`에서 진행 중(2번 modify 지시 + 설계 문서 커밋 완료). 이 계획의 커밋도 같은 브랜치에 쌓는다.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/ai/exemplars.ts` | 순수 모듈: `Exemplar` 타입, `EXEMPLAR_CODE_CAP`, `truncateField`/`truncateCode`(코드 축약), `buildExemplarBlock`(프롬프트 블록 조립) | 신규 |
| `lib/admin/exemplars.ts` | 서버 데이터 함수(adminDb): `getExemplar`/`setExemplarFromPost`/`clearExemplar`/`listExemplarCandidates` | 신규 |
| `app/api/admin/exemplars/route.ts` | admin 전용 API: GET(슬롯+후보)/POST(지정)/DELETE(비우기) | 신규 |
| `app/api/generate/route.ts` | generate 모드에서 슬롯 읽어 블록 prepend (기존 modify 지시와 통합) | 수정 |
| `firestore.rules` | `exemplars` 클라이언트 접근 전면 차단 | 수정 |
| `app/admin/exemplars/page.tsx` | 어드민 콘솔 "생성 예시" 페이지(슬롯 관리 + 후보 지정) | 신규 |
| `app/admin/page.tsx` | 허브에 "생성 예시" 카드 추가 | 수정 |
| `scripts/selftest-exemplars.mjs` | 순수 함수 단위 검증(미커밋 dev 스크립트) | 신규(미커밋) |

---

## Task 1: 순수 exemplar 모듈 + 단위 테스트

**Files:**
- Create: `lib/ai/exemplars.ts`
- Create(미커밋): `scripts/selftest-exemplars.mjs`
- Create(임시): `.selftest-tsconfig.json`

- [ ] **Step 1: 실패하는 단위 테스트 작성** — `scripts/selftest-exemplars.mjs`

```js
import assert from 'node:assert';
import {
  EXEMPLAR_CODE_CAP,
  truncateField,
  truncateCode,
  buildExemplarBlock,
} from '../.selftest-build/lib/ai/exemplars.js';

// truncateField: 상한 이하면 그대로
assert.equal(truncateField('abc', 10), 'abc', '짧으면 그대로');

// 초과 시 앞부분 보존 + 생략 마커
const long = 'x'.repeat(EXEMPLAR_CODE_CAP + 50);
const t = truncateField(long);
assert.ok(t.length < long.length, '초과분 잘림');
assert.ok(t.endsWith('/* …생략… */'), '생략 마커 부착');
assert.ok(t.startsWith('x'.repeat(EXEMPLAR_CODE_CAP)), '앞부분 보존');

// 빈/비문자 방어
assert.equal(truncateField(undefined), '', 'undefined → 빈 문자열');

// truncateCode: 세 필드 각각 적용
const tc = truncateCode({ html: 'h'.repeat(EXEMPLAR_CODE_CAP + 1), css: 'c', javascript: 'j' });
assert.ok(tc.html.endsWith('/* …생략… */'), 'html 축약됨');
assert.equal(tc.css, 'c', 'css 그대로');
assert.equal(tc.javascript, 'j', 'js 그대로');

// buildExemplarBlock: 계획서 5필드 + 코드 + 프레이밍 문구 모두 포함
const block = buildExemplarBlock({
  variant: 'default',
  plan: { name: '퀴즈', look: '밝게', usage: '클릭', how: '점수계산', etc: '딴거없음' },
  code: { html: '<div>HI</div>', css: 'body{}', javascript: 'console.log(1)' },
  sourcePostId: 'p1',
  sourceTitle: '제목',
  approvedBy: 'admin',
  approvedAt: 0,
});
for (const frag of [
  '참고 예시', '베끼지', '새 계획서',
  '퀴즈', '밝게', '클릭', '점수계산', '딴거없음',
  '<div>HI</div>', 'body{}', 'console.log(1)',
]) {
  assert.ok(block.includes(frag), `블록에 포함되어야 함: ${frag}`);
}

console.log('SELFTEST_EXEMPLARS_OK');
```

- [ ] **Step 2: 임시 tsconfig 작성 후 컴파일 → 실패 확인** — `.selftest-tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es2020", "module": "es2020", "moduleResolution": "node",
    "baseUrl": ".", "paths": { "@/*": ["./*"] },
    "skipLibCheck": true, "rootDir": ".", "outDir": ".selftest-build"
  },
  "files": ["lib/ai/exemplars.ts"]
}
```

Run (`ai-program-generator/`에서):
```bash
./node_modules/.bin/tsc -p .selftest-tsconfig.json && node scripts/selftest-exemplars.mjs
```
Expected: FAIL — `lib/ai/exemplars.ts`가 없어 컴파일 에러(또는 import 실패).

- [ ] **Step 3: 최소 구현** — `lib/ai/exemplars.ts`

```ts
import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

// 동결된 few-shot 참고 예시 1개(variant별). 모든 import가 type-only라
// 컴파일 후 .js에는 런타임 import가 없어 단독 실행이 가능하다.
export interface Exemplar {
  variant: 'default' | 'survey';
  plan: PlanFields;
  code: GeneratedCode;
  sourcePostId: string;
  sourceTitle: string;
  approvedBy: string;
  approvedAt: number;
}

/** 참고 예시 코드 각 필드의 최대 길이(자). 초과분은 잘라 생략 마커를 붙인다. */
export const EXEMPLAR_CODE_CAP = 4000;

/** 한 필드를 상한으로 축약. 잘렸으면 끝에 생략 마커를 붙인다. */
export function truncateField(s: unknown, cap: number = EXEMPLAR_CODE_CAP): string {
  if (typeof s !== 'string') return '';
  if (s.length <= cap) return s;
  return s.slice(0, cap) + '\n/* …생략… */';
}

/** code 3필드를 모두 축약. */
export function truncateCode(code: GeneratedCode, cap: number = EXEMPLAR_CODE_CAP): GeneratedCode {
  return {
    html: truncateField(code.html, cap),
    css: truncateField(code.css, cap),
    javascript: truncateField(code.javascript, cap),
  };
}

/**
 * 생성 프롬프트 앞에 붙일 참고 예시 블록(순수 함수).
 * 모델이 그대로 베끼지 않고 '완성도 기준'으로만 참고하도록 프레이밍한다.
 * code는 이미 축약된 상태로 들어온다고 가정한다(저장 시점에 truncateCode 적용).
 */
export function buildExemplarBlock(ex: Exemplar): string {
  const { plan, code } = ex;
  return `아래는 완성도 높은 "참고 예시"입니다. 그대로 베끼지 말고, 이 정도의 완성도·짜임새를 기준으로 삼으세요. (예시 코드는 축약·생략되어 있을 수 있습니다.)

[참고 예시 — 계획서]
- 이름: ${plan.name}
- 모습: ${plan.look}
- 사용법: ${plan.usage}
- 동작: ${plan.how}
- 기타: ${plan.etc}

[참고 예시 — 결과 코드(축약)]
HTML:
${code.html}
CSS:
${code.css}
JavaScript:
${code.javascript}

위 예시는 참고용일 뿐입니다. 이제 아래 '새 계획서'에 맞는 완성형 프로그램을 새로 만드세요.

`;
}
```

- [ ] **Step 4: 컴파일 + 테스트 통과 확인**

Run:
```bash
./node_modules/.bin/tsc -p .selftest-tsconfig.json && node scripts/selftest-exemplars.mjs
```
Expected: `SELFTEST_EXEMPLARS_OK`

- [ ] **Step 5: 임시 산출물 정리 + 타입체크**

Run:
```bash
rm -rf .selftest-build .selftest-tsconfig.json
./node_modules/.bin/tsc --noEmit
```
Expected: 타입 에러 0. (`.selftest-build`/`.selftest-tsconfig.json`은 커밋하지 않는다. `scripts/selftest-exemplars.mjs`도 미커밋 dev 스크립트.)

- [ ] **Step 6: 커밋**

```bash
git add ai-program-generator/lib/ai/exemplars.ts
git commit -m "feat(exemplars): 참고 예시 축약·블록 조립 순수 모듈

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 어드민 서버 데이터 함수

**Files:**
- Create: `lib/admin/exemplars.ts`

- [ ] **Step 1: 구현** — `lib/admin/exemplars.ts`

```ts
import { adminDb } from '@/lib/firebase/admin';
import { truncateCode, type Exemplar } from '@/lib/ai/exemplars';
import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

export type ExemplarVariant = 'default' | 'survey';

const COL = 'exemplars';
const docId = (variant: ExemplarVariant) => `active_${variant}`;

export interface ExemplarCandidate {
  id: string;
  title: string;
  likeCount: number;
  forkCount: number;
  hasPlan: boolean;
}

/** variant 슬롯의 현재 exemplar. 없거나 읽기 실패면 null(생성을 막지 않는다). */
export async function getExemplar(variant: ExemplarVariant): Promise<Exemplar | null> {
  try {
    const snap = await adminDb.collection(COL).doc(docId(variant)).get();
    return snap.exists ? (snap.data() as Exemplar) : null;
  } catch (e) {
    console.error('exemplar 읽기 실패:', e);
    return null;
  }
}

/** 게시물을 압축·동결해 variant 슬롯에 지정. plan/code 없는 구버전 글이면 예외. */
export async function setExemplarFromPost(
  postId: string,
  variant: ExemplarVariant,
  approvedBy: string,
): Promise<Exemplar> {
  const postSnap = await adminDb.collection('posts').doc(postId).get();
  if (!postSnap.exists) throw new Error('POST_NOT_FOUND');
  const post = postSnap.data() as { title?: string; plan?: PlanFields; code?: GeneratedCode };
  if (!post.plan) throw new Error('POST_HAS_NO_PLAN');
  if (!post.code) throw new Error('POST_HAS_NO_CODE');

  const exemplar: Exemplar = {
    variant,
    plan: post.plan,
    code: truncateCode(post.code),
    sourcePostId: postId,
    sourceTitle: post.title ?? '(제목 없음)',
    approvedBy,
    approvedAt: Date.now(),
  };
  await adminDb.collection(COL).doc(docId(variant)).set(exemplar);
  return exemplar;
}

/** variant 슬롯 비우기. */
export async function clearExemplar(variant: ExemplarVariant): Promise<void> {
  await adminDb.collection(COL).doc(docId(variant)).delete();
}

/**
 * 좋아요 상위 후보 글(자동 추림). likeCount 내림차순 상위 limitN개.
 * likeCount 필드가 없는 구버전 글은 정렬에서 자연히 제외된다(인기글만 후보).
 */
export async function listExemplarCandidates(limitN = 20): Promise<ExemplarCandidate[]> {
  const snap = await adminDb.collection('posts').orderBy('likeCount', 'desc').limit(limitN).get();
  return snap.docs.map((d) => {
    const data = d.data() as { title?: string; likeCount?: number; forkCount?: number; plan?: PlanFields };
    return {
      id: d.id,
      title: data.title ?? '(제목 없음)',
      likeCount: data.likeCount ?? 0,
      forkCount: data.forkCount ?? 0,
      hasPlan: !!data.plan,
    };
  });
}
```

- [ ] **Step 2: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 타입 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add ai-program-generator/lib/admin/exemplars.ts
git commit -m "feat(exemplars): 어드민 서버 데이터 함수(지정·조회·삭제·후보추림)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 어드민 API 라우트

**Files:**
- Create: `app/api/admin/exemplars/route.ts`

- [ ] **Step 1: 구현** — `app/api/admin/exemplars/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { adminAuth } from '@/lib/firebase/admin';
import {
  getExemplar,
  setExemplarFromPost,
  clearExemplar,
  listExemplarCandidates,
  type ExemplarVariant,
} from '@/lib/admin/exemplars';

export const runtime = 'nodejs';

function isVariant(v: unknown): v is ExemplarVariant {
  return v === 'default' || v === 'survey';
}

/** requireAdmin 통과 후 호출 — Bearer 토큰에서 관리자 uid 추출(approvedBy 기록용). */
async function adminUid(req: NextRequest): Promise<string> {
  const idToken = (req.headers.get('authorization') ?? '').slice(7);
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const [def, survey, candidates] = await Promise.all([
    getExemplar('default'),
    getExemplar('survey'),
    listExemplarCandidates(),
  ]);
  return NextResponse.json({ slots: { default: def, survey }, candidates });
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
  const { sourcePostId, variant } = (body ?? {}) as { sourcePostId?: unknown; variant?: unknown };
  if (typeof sourcePostId !== 'string' || !sourcePostId) {
    return NextResponse.json({ error: 'sourcePostId가 필요해요.' }, { status: 400 });
  }
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  try {
    const uid = await adminUid(req);
    const exemplar = await setExemplarFromPost(sourcePostId, variant, uid);
    return NextResponse.json({ ok: true, exemplar });
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    if (code === 'POST_NOT_FOUND')
      return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    if (code === 'POST_HAS_NO_PLAN')
      return NextResponse.json({ error: '이 글에는 계획서가 없어 예시로 쓸 수 없어요.' }, { status: 400 });
    if (code === 'POST_HAS_NO_CODE')
      return NextResponse.json({ error: '이 글에는 코드가 없어요.' }, { status: 400 });
    console.error('exemplar 지정 실패:', e);
    return NextResponse.json({ error: '예시 지정에 실패했어요.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate) return gate;
  const variant = new URL(req.url).searchParams.get('variant');
  if (!isVariant(variant)) {
    return NextResponse.json({ error: "variant는 'default' 또는 'survey'여야 해요." }, { status: 400 });
  }
  await clearExemplar(variant);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 타입 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add ai-program-generator/app/api/admin/exemplars/route.ts
git commit -m "feat(exemplars): admin 전용 예시 지정/조회/삭제 API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 생성 라우트에 예시 주입

**Files:**
- Modify: `app/api/generate/route.ts` (import 추가 + 생성 직전 system/prompt 조립부)

- [ ] **Step 1: import 추가** — `app/api/generate/route.ts` 상단 import 블록에 두 줄 추가

기존:
```ts
import { SYSTEM_PROMPTS, MODIFY_SYSTEM_SUFFIX, type SystemPromptVariant } from '@/lib/ai/prompts';
```
바로 아래에 추가:
```ts
import { getExemplar } from '@/lib/admin/exemplars';
import { buildExemplarBlock } from '@/lib/ai/exemplars';
```

- [ ] **Step 2: 조립부 교체** — Task 2(modify 지시)에서 만든 블록을 generate 주입까지 포함하도록 교체

기존:
```ts
    const provider = getAIProvider();
    // 수정 모드에서는 "요청한 부분만 바꾸고 나머지는 보존하라"는 지시를 시스템 프롬프트에 덧붙인다.
    const system =
      mode === 'modify'
        ? SYSTEM_PROMPTS[promptVariant] + MODIFY_SYSTEM_SUFFIX
        : SYSTEM_PROMPTS[promptVariant];
    const code = await provider.generate({ prompt, system, mode });
```
교체:
```ts
    const provider = getAIProvider();
    let system = SYSTEM_PROMPTS[promptVariant];
    let finalPrompt = prompt;
    if (mode === 'modify') {
      // 수정 모드: 요청한 부분만 바꾸고 나머지 코드·제약을 보존하라는 지시를 덧붙인다.
      system = SYSTEM_PROMPTS[promptVariant] + MODIFY_SYSTEM_SUFFIX;
    } else {
      // 생성 모드: 해당 variant에 승인된 참고 예시가 있으면 프롬프트 앞에 붙여 완성도 floor를 올린다.
      const exemplar = await getExemplar(promptVariant);
      if (exemplar) finalPrompt = buildExemplarBlock(exemplar) + prompt;
    }
    const code = await provider.generate({ prompt: finalPrompt, system, mode });
```

(`promptVariant`는 `'default' | 'survey'`로 `ExemplarVariant`와 동일하므로 `getExemplar(promptVariant)`가 타입상 안전하다.)

- [ ] **Step 3: 타입체크 + 빌드**

Run (dev 서버 끈 상태에서):
```bash
./node_modules/.bin/tsc --noEmit && npm run build
```
Expected: 타입 에러 0, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add ai-program-generator/app/api/generate/route.ts
git commit -m "feat(generate): generate 모드에 승인된 참고 예시 1개 주입

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: firestore.rules — exemplars 클라이언트 차단

**Files:**
- Modify: `firestore.rules` (reports match 블록 뒤, 닫는 중괄호 앞)

- [ ] **Step 1: 차단 규칙 추가** — `firestore.rules`의 `match /reports/{reportId} { … }` 블록이 끝나는 줄 다음에 삽입

```
    // few-shot 참고 예시(생성 품질용) — 서버 Admin SDK 전용. 클라이언트 접근 전면 차단(usage와 동일 정책).
    match /exemplars/{docId} {
      allow read, write: if false;
    }
```

- [ ] **Step 2: 커밋**

```bash
git add ai-program-generator/firestore.rules
git commit -m "chore(rules): exemplars 컬렉션 클라이언트 접근 차단(서버 전용)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: 배포(운영 단계 — 사람이 수행)**

`exemplars`는 기본 거부라 미배포 상태에서도 클라이언트 접근은 막혀 있다(서버는 Admin SDK라 규칙 무관). 명시 규칙 반영은 다음 배포 때:
```bash
firebase deploy --only firestore:rules
```
(이 단계는 자동 실행하지 말고 사용자에게 알린다.)

---

## Task 6: 어드민 콘솔 "생성 예시" 페이지 + 허브 카드

**Files:**
- Create: `app/admin/exemplars/page.tsx`
- Modify: `app/admin/page.tsx` (허브 카드 + 아이콘 import)

- [ ] **Step 1: 페이지 구현** — `app/admin/exemplars/page.tsx`

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

type Variant = 'default' | 'survey';

interface SlotExemplar {
  variant: Variant;
  sourceTitle: string;
  sourcePostId: string;
  approvedAt: number;
}
interface Candidate {
  id: string;
  title: string;
  likeCount: number;
  forkCount: number;
  hasPlan: boolean;
}
interface ExemplarsData {
  slots: { default: SlotExemplar | null; survey: SlotExemplar | null };
  candidates: Candidate[];
}

const VARIANT_LABEL: Record<Variant, string> = {
  default: '기본(계획서)',
  survey: '선택지(저학년)',
};

async function authedFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export default function AdminExemplarsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <ExemplarsContent />
      </AdminGate>
    </main>
  );
}

function ExemplarsContent() {
  const { toast } = useToast();
  const [data, setData] = useState<ExemplarsData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    authedFetch('/api/admin/exemplars')
      .then((d) => setData(d as ExemplarsData))
      .catch((e) => toast(e instanceof Error ? e.message : '불러오기 실패'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function designate(sourcePostId: string, variant: Variant) {
    setBusy(true);
    try {
      await authedFetch('/api/admin/exemplars', {
        method: 'POST',
        body: JSON.stringify({ sourcePostId, variant }),
      });
      toast(`${VARIANT_LABEL[variant]} 예시로 지정했어요.`, 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '지정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function clearSlot(variant: Variant) {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/exemplars?variant=${variant}`, { method: 'DELETE' });
      toast(`${VARIANT_LABEL[variant]} 예시를 비웠어요.`, 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '비우기 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-1 text-[24px]">생성 예시</h1>
      <p className="mb-4 text-[14px] text-muted">
        승인한 글을 생성 프롬프트에 참고 예시로 1개 넣어 완성도를 높여요. (생성 모드에만 적용)
      </p>

      {/* 현재 슬롯 */}
      <div className="mb-6 flex flex-col gap-3">
        {(['default', 'survey'] as Variant[]).map((v) => {
          const slot = data?.slots[v] ?? null;
          return (
            <div key={v} className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={18} aria-hidden />
                <span className="text-[16px]">{VARIANT_LABEL[v]}</span>
              </div>
              {slot ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-muted">
                    현재: {slot.sourceTitle}
                  </span>
                  <Button variant="ghost" onClick={() => clearSlot(v)} disabled={busy}>
                    <Trash2 size={16} aria-hidden /> 비우기
                  </Button>
                </div>
              ) : (
                <span className="text-[14px] text-muted">아직 지정된 예시가 없어요.</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 후보 글 */}
      <h2 className="mb-2 text-[18px]">인기 글 후보</h2>
      <div className="flex flex-col gap-2">
        {(data?.candidates ?? []).map((c) => (
          <div key={c.id} className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px]">{c.title}</span>
              <span className="shrink-0 text-[13px] text-muted">
                좋아요 {c.likeCount} · 이어만들기 {c.forkCount}
              </span>
            </div>
            {c.hasPlan ? (
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => designate(c.id, 'default')} disabled={busy}>
                  기본 예시로
                </Button>
                <Button variant="soft" onClick={() => designate(c.id, 'survey')} disabled={busy}>
                  선택지 예시로
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-muted">계획서가 없어 예시로 쓸 수 없어요.</span>
            )}
          </div>
        ))}
        {data && data.candidates.length === 0 && (
          <p className="text-[14px] text-muted">아직 후보가 될 인기 글이 없어요.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 허브 카드 추가** — `app/admin/page.tsx`

import 줄의 아이콘 목록에 `Sparkles` 추가:
```tsx
import { Flag, Users, ChevronRight, UserPlus, FolderTree, Sparkles } from 'lucide-react';
```
`게시판 관리` HubCard 다음에 카드 추가:
```tsx
        <HubCard
          href="/admin/exemplars"
          icon={<Sparkles size={22} aria-hidden />}
          title="생성 예시"
          desc="생성 품질용 참고 예시 지정"
        />
```

- [ ] **Step 3: 타입체크 + 빌드**

Run (dev 서버 끈 상태에서):
```bash
./node_modules/.bin/tsc --noEmit && npm run build
```
Expected: 타입 에러 0, 빌드 성공.

- [ ] **Step 4: 브라우저 확인**

dev 서버를 띄우고 admin 계정으로:
1. `/admin` 에 "생성 예시" 카드가 보이고 클릭되는지.
2. `/admin/exemplars` 에서 인기 글 후보 목록이 뜨고, "기본 예시로" 클릭 시 성공 토스트 + 상단 슬롯에 제목이 표시되는지.
3. "비우기" 시 슬롯이 비워지는지.
4. 계획서 없는 후보는 버튼 대신 안내문이 보이는지.

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/app/admin/exemplars/page.tsx ai-program-generator/app/admin/page.tsx
git commit -m "feat(exemplars): 어드민 콘솔 생성 예시 관리 페이지

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 통합 확인 (수동) + 마무리

**Files:** 없음(검증만)

- [ ] **Step 1: 엔드투엔드 확인** — dev 서버 + admin 계정

1. `/admin/exemplars`에서 완성도 좋은 글을 "기본 예시로" 지정.
2. 생성기에서 **일부러 빈약한 계획서**(예: 이름만 채우고 나머지 비움)로 "프로그램 만들기".
3. 결과가 예시 지정 전 대비 더 완성형으로 나오는지(정성 비교). 비교를 위해 슬롯 비우고 같은 계획서로 한 번 더 생성해 대조.
4. 수정(modify) 요청 시에는 예시가 끼어들지 않고 기존 코드 기반으로만 고쳐지는지(주입은 generate 전용).

- [ ] **Step 2: 비admin 거부 확인(선택)**

비admin(또는 비로그인) 상태에서 브라우저 콘솔로 `/api/admin/exemplars` 호출 시 401/403이 오는지 확인.

- [ ] **Step 3: 최종 타입체크 + 빌드**

Run (dev 서버 끈 상태에서):
```bash
./node_modules/.bin/tsc --noEmit && npm run build
```
Expected: 타입 에러 0, 빌드 성공.

- [ ] **Step 4: rules 배포 안내**

사용자에게 `firebase deploy --only firestore:rules` 실행을 안내(자동 실행 금지).

---

## 미해결/후속 (이 계획 범위 밖)
- exemplar 효과 정량 측정(A/B) — 추후.
- 후보 정렬을 likeCount+forkCount 복합 가중치로 — 현재는 likeCount 단일.
- generate 시점 카테고리 도입 시 카테고리별 매칭으로 확장 가능(현재는 variant 매칭).
