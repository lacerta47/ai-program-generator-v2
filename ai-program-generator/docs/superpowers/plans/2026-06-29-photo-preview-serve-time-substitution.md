# 사진 미리보기 서빙-시점 치환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `__PHOTO__`를 N회 참조하는 생성 코드의 미리보기가 `previews` 문서 1MB 한계를 넘겨 실패하던 문제를, 사진 펼치기(치환)를 저장 시점에서 서빙 시점으로 옮겨 결정적으로 해소한다.

**Architecture:** `putPreview`가 펼친 HTML doc 대신 **토큰 코드 + 사진(별도 필드)**을 저장하고, `getPreview`가 읽는 시점에 `substitutePhoto`+`buildPreviewDoc`으로 펼친다. 저장 문서는 N과 무관하게 캡(코드 ≤150k×3 + 사진 ≤400k)으로 바운드되고, N회 인라인은 무제한인 HTTP 응답에만 존재한다. 더해 시스템 프롬프트로 "사진 1회 로드·canvas 재사용"을 유도해 서빙 doc 크기·품질을 개선한다.

**Tech Stack:** Next.js 15 App Router(Node 런타임), Firebase Admin SDK(Firestore `previews` 컬렉션), TypeScript. 테스트 프레임워크 없음 — 검증은 `tsc --noEmit` + `npm run build` + 미커밋 `scripts/selftest-*.mjs`(Admin SDK 시드 → 서버 API 경유) + 브라우저.

**Spec:** `docs/superpowers/specs/2026-06-29-photo-preview-serve-time-substitution-design.md`

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/preview-store.ts` | 미리보기 임시 저장/서빙 | `putPreview(code, photo?)`로 토큰코드+사진 저장 / `getPreview`가 서빙 시점에 치환·빌드 (핵심) |
| `app/api/preview/route.ts` | 즉석 생성 코드 미리보기 저장 | `putPreview(code, photo)` 호출로 단순화, `substitutePhoto`/`buildPreviewDoc` 제거, 입력 캡 유지 |
| `app/api/share/[postId]/route.ts` | 공유 PIN 미리보기 저장 | `putPreview(post.code, post.photo)` 호출로 단순화, import 정리 |
| `lib/ai/prompts.ts` | 시스템 프롬프트 | `PHOTO_INSTRUCTION`에 "1회 로드·canvas 재사용" 권장 추가 |
| `scripts/selftest-preview-photo.mjs` | 회귀 검증(**미커밋**) | 9회 참조 오버플로 → 200·저장형태·서빙 doc 확인 |
| `app/api/preview/[id]/route.ts`, `.../post/[id]/route.ts` | 미리보기 서빙 | **변경 없음**(확인만) |

변경 없는 두 GET 라우트는 손대지 않는다: `[id]`는 `getPreview`가 이미 펼친 doc을 주므로 그대로 서빙하고, `post/[id]`는 교실 글을 404 처리하며 공개 글은 rules상 사진이 없다.

---

## Task 1: 오버플로 재현 self-test (RED)

미커밋 통합 self-test로 "현재 코드가 9회 참조에서 실패"함을 먼저 고정한다. 이 스크립트는 끝까지 유지되어 Task 4에서 GREEN 확인에 재사용된다(커밋하지 않음 — git status `??`).

**Files:**
- Create: `ai-program-generator/scripts/selftest-preview-photo.mjs` (미커밋)

**사전조건:** `npm run dev` 실행 중 + 루트에 `serviceAccountKey.json`·`.env.local` 존재.

- [ ] **Step 1: self-test 작성**

`ai-program-generator/scripts/selftest-preview-photo.mjs` 생성:

```js
// 미리보기 서빙-시점 치환 회귀 점검(개발용, 미커밋).
// Admin SDK로 ID token을 발급해 실행 중 dev 서버의 /api/preview(POST)·/api/preview/[id](GET)를
// 직접 호출하고, previews 문서의 저장 형태를 Admin SDK로 확인한다.
//
// 사전조건: `npm run dev` 실행 중 + 루트 serviceAccountKey.json, .env.local.
// 사용법:   node scripts/selftest-preview-photo.mjs [baseUrl]   (기본 http://localhost:3000)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:3000';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
} catch {
  console.error('❌ serviceAccountKey.json 을 프로젝트 루트에서 찾을 수 없습니다.');
  process.exit(1);
}
function readEnvLocal() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return out;
}
const API_KEY = readEnvLocal().NEXT_PUBLIC_FIREBASE_API_KEY;
if (!API_KEY) {
  console.error('❌ .env.local 에서 NEXT_PUBLIC_FIREBASE_API_KEY 를 찾지 못했습니다.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function mintIdToken() {
  const custom = await getAuth().createCustomToken('dev-test-admin', { dev: true, admin: true });
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }) },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('ID token 교환 실패: ' + JSON.stringify(data));
  return data.idToken;
}

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass++; console.log('  ✅', name); }
  else { fail++; console.log('  ❌', name, detail ? `— ${detail}` : ''); }
}

console.log(`미리보기 서빙-시점 치환 점검 @ ${BASE}\n`);
const idToken = await mintIdToken();

// 9회 참조 + 큰 사진 → 펼치면 ~1.44MB(>1MB). 저장은 토큰코드+사진 1장이라 안전해야 한다.
const photo = 'data:image/png;base64,' + 'A'.repeat(160000); // ~160k자(<400k 캡)
const html = `<div>${'<span style="background-image:url(__PHOTO__)"></span>'.repeat(9)}</div>`;
const createdIds = [];

async function postPreview(body) {
  const res = await fetch(`${BASE}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// 1) 9회 참조 + 사진 → 200 + id (기존엔 putPreview throw로 500)
let id = null;
{
  const r = await postPreview({ html, css: '', javascript: '', photo });
  const ok = r.status === 200 && typeof r.data.id === 'string';
  check('9회 참조+사진 POST → 200 + id', ok, `status=${r.status}`);
  if (ok) { id = r.data.id; createdIds.push(id); }
}

// 2) previews 문서는 토큰코드+사진 별도 저장(펼친 doc 아님)
if (id) {
  const snap = await db.collection('previews').doc(id).get();
  const d = snap.data() || {};
  check('저장 형태: code 필드 존재 & doc 필드 없음', !!d.code && d.doc === undefined,
    `keys=${Object.keys(d).join(',')}`);
  check('저장 형태: html에 __PHOTO__ 토큰 보존(치환 안 됨)',
    typeof d.code?.html === 'string' && d.code.html.includes('__PHOTO__'));
  check('저장 형태: 사진 1장만(길이 == 원본)', d.photo === photo, `len=${d.photo?.length}`);
}

// 3) GET /api/preview/[id] (iframe) → 펼친 doc에 data-URI 9회
if (id) {
  const res = await fetch(`${BASE}/api/preview/${id}`, { headers: { 'sec-fetch-dest': 'iframe' } });
  const body = await res.text();
  const count = body.split(photo).length - 1;
  check('서빙 doc에 사진 data-URI 9회 인라인', res.status === 200 && count === 9, `status=${res.status} count=${count}`);
  check('서빙 doc에 __PHOTO__ 토큰 잔존 없음', !body.includes('__PHOTO__'));
}

// 4) 사진 없는 POST → previews 문서에 photo 필드 없음
{
  const r = await postPreview({ html: '<p>hi</p>', css: '', javascript: '' });
  if (r.status === 200 && r.data.id) {
    createdIds.push(r.data.id);
    const snap = await db.collection('previews').doc(r.data.id).get();
    const d = snap.data() || {};
    check('사진 없는 글 → photo 필드 미저장', d.photo === undefined && !!d.code);
  } else {
    check('사진 없는 글 POST → 200', false, `status=${r.status}`);
  }
}

// 정리(시드 제거)
for (const cid of createdIds) {
  await db.collection('previews').doc(cid).delete().catch(() => {});
}

console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
if (fail === 0) console.log('SELFTEST_PREVIEW_PHOTO_OK');
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 현재 코드 대비 RED 확인**

Run: `cd ai-program-generator && node scripts/selftest-preview-photo.mjs`
Expected: **FAIL** — `9회 참조+사진 POST → 200 + id` 가 `status=500`으로 실패(현재 `putPreview`가 ~1.44MB doc을 Firestore에 쓰다 throw). `결과: ... 실패` 출력, `SELFTEST_PREVIEW_PHOTO_OK` 미출력.

(커밋하지 않는다 — self-test는 일회성 미커밋 스크립트.)

---

## Task 2: 서빙-시점 치환 (preview-store + 호출부 2곳)

`putPreview` 시그니처가 바뀌면 두 호출부가 동시에 깨지므로 한 커밋에서 함께 고쳐 항상 컴파일되게 한다.

**Files:**
- Modify: `ai-program-generator/lib/preview-store.ts`
- Modify: `ai-program-generator/app/api/preview/route.ts`
- Modify: `ai-program-generator/app/api/share/[postId]/route.ts`

- [ ] **Step 1: `lib/preview-store.ts` 전체 교체**

파일 전체를 아래로 교체(저장=토큰코드+사진, 서빙 시점 치환). `deleteExpiredPreviews`는 그대로 유지:

```ts
import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase/admin';
import { buildPreviewDoc } from '@/lib/program';
import { substitutePhoto } from '@/lib/ai/photo';
import type { GeneratedCode } from '@/lib/ai/types';

// 미리보기 문서 임시 저장소 — Firestore 'previews' 컬렉션 (Admin SDK 전용, 클라이언트 규칙 없음 = 접근 불가).
// 메모리 Map 대신 Firestore를 쓰는 이유: Next dev의 라우트 워커 분리·배포 환경의
// 다중 인스턴스에서도 POST(저장)와 GET(서빙)이 같은 데이터를 보게 하기 위함.
//
// 저장은 토큰 코드 + 사진(별도 필드), 펼치기(__PHOTO__ 치환 + 단일 doc 빌드)는 서빙(getPreview) 시점.
// 사진을 N회 참조해도 저장 문서는 토큰코드(≤150k×3) + 사진 1장(≤400k)으로 바운드돼 1MB를 넘지 않는다.
// N회 인라인은 무제한인 GET HTTP 응답에만 존재한다.
const TTL_MS = 10 * 60 * 1000;
const COL = 'previews';

interface PreviewRecord {
  code: GeneratedCode;
  photo?: string;
  exp: number;
}

export async function putPreview(code: GeneratedCode, photo?: string): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  const data: PreviewRecord = { code, exp: now + TTL_MS };
  if (photo) data.photo = photo; // undefined는 Firestore가 거부 → 있을 때만 기록
  await adminDb.collection(COL).doc(id).set(data);
  // 기회적 청소: 만료된 문서 몇 개 정리 (비용 미미)
  adminDb
    .collection(COL)
    .where('exp', '<', now)
    .limit(20)
    .get()
    .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete())))
    .catch(() => {});
  return id;
}

/**
 * 만료된 미리보기 문서를 일괄 삭제(스케줄 cron용). 한 번에 최대 maxDocs건까지 배치 삭제.
 * putPreview의 기회적 청소(쓰기당 20건)만으로는 한산할 때 만료분이 쌓이므로, 주기적 정리로 보강.
 * exp 단일필드 범위쿼리라 자동 인덱스 사용(복합 인덱스 불필요).
 */
export async function deleteExpiredPreviews(maxDocs = 5000): Promise<number> {
  const now = Date.now();
  let deleted = 0;
  while (deleted < maxDocs) {
    const snap = await adminDb.collection(COL).where('exp', '<', now).limit(450).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 450) break; // 마지막 배치
  }
  return deleted;
}

export async function getPreview(id: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const snap = await adminDb.collection(COL).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<PreviewRecord>;
  if (!data.exp || data.exp < Date.now()) {
    snap.ref.delete().catch(() => {});
    return null;
  }
  if (!data.code) return null; // 구버전/손상 레코드 방어
  // 펼치기: __PHOTO__ → data-URI 치환 후 단일 HTML 문서로. N회 인라인은 여기(HTTP 응답)에만, 1MB 무관.
  return buildPreviewDoc(substitutePhoto(data.code, data.photo));
}
```

- [ ] **Step 2: `app/api/preview/route.ts` 호출부 단순화**

상단 import에서 두 줄 제거:

```ts
import { buildPreviewDoc } from '@/lib/program';
```
```ts
import { substitutePhoto } from '@/lib/ai/photo';
```

그리고 본문 끝(현재 `substitutePhoto(...)`+`buildPreviewDoc`+`putPreview(doc)` 블록)을 교체. 아래 기존 블록:

```ts
  const code = substitutePhoto(
    { html: html as string, css: css as string, javascript: javascript as string },
    typeof photo === 'string' ? photo : undefined,
  );
  const doc = buildPreviewDoc(code);
  const id = await putPreview(doc);
  return NextResponse.json({ id });
```

를 다음으로:

```ts
  // 토큰 코드 + 사진을 그대로 저장한다. __PHOTO__ 치환·doc 빌드는 서빙(getPreview) 시점에 일어나
  // N회 참조여도 저장 문서가 1MB를 넘지 않는다. 위의 길이 캡(MAX_PART·photo)이 저장 크기를 보장.
  const id = await putPreview(
    { html: html as string, css: css as string, javascript: javascript as string },
    typeof photo === 'string' ? photo : undefined,
  );
  return NextResponse.json({ id });
```

(상단의 `MAX_PART`·`html/css/javascript` 문자열 검증·`photo.length > 400000` 검증은 **그대로 유지** — 저장 필드 크기를 바운드하는 장치다.)

- [ ] **Step 3: `app/api/share/[postId]/route.ts` 호출부 단순화**

상단 import에서 두 줄 제거(나머지 import는 유지 — `GeneratedCode`는 계속 사용):

```ts
import { buildPreviewDoc } from '@/lib/program';
```
```ts
import { substitutePhoto } from '@/lib/ai/photo';
```

본문의 미리보기 생성 줄. 기존:

```ts
  const code = post!.code as GeneratedCode;
  const previewId = await putPreview(buildPreviewDoc(substitutePhoto(code, post!.photo as string | undefined)));
```

를 다음으로:

```ts
  const code = post!.code as GeneratedCode;
  // 토큰 코드 + 사진을 저장하고 치환은 서빙 시점에(serve-time). post.code·post.photo는 rules로 이미 크기 검증됨.
  const previewId = await putPreview(code, post!.photo as string | undefined);
```

- [ ] **Step 4: 타입체크 (dev 서버 떠 있어도 안전)**

Run: `cd ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: PASS (에러 0). `putPreview` 시그니처 변경이 두 호출부와 일치함을 확인.

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/lib/preview-store.ts ai-program-generator/app/api/preview/route.ts ai-program-generator/app/api/share/[postId]/route.ts
git commit -m "fix(photo): 미리보기 사진 치환을 서빙 시점으로 이동(previews 1MB 오버플로 해소)

putPreview가 펼친 doc 대신 토큰코드+사진(별도 필드)을 저장하고
getPreview가 읽는 시점에 substitutePhoto+buildPreviewDoc으로 펼친다.
__PHOTO__ N회 참조여도 저장 문서가 캡으로 바운드돼 1MB를 넘지 않음.
스펙 2026-06-29 §3.1·3.2."
```

---

## Task 3: 프롬프트 유도 (사진 1회 로드·canvas 재사용)

**Files:**
- Modify: `ai-program-generator/lib/ai/prompts.ts`

- [ ] **Step 1: `PHOTO_INSTRUCTION` 확장**

기존 `PHOTO_INSTRUCTION`(파일 끝):

```ts
export const PHOTO_INSTRUCTION = `

**사진 활용 (첨부됨)**: 사용자가 사진 1장을 올렸습니다. 사진을 보고 계획서대로 그 사진을 **활용하는** 프로그램(퍼즐·필터·스티커·사진 게임·꾸미기 등)을 만드세요. 코드에서 이미지 소스는 반드시 \`__PHOTO__\` 리터럴을 쓰고(사진을 다시 그리거나 다른 URL을 쓰지 마세요), 사진의 크기·비율은 모를 수 있으니 \`object-fit\`·런타임 \`naturalWidth/Height\`로 어떤 사진에도 맞게 하세요.`;
```

를 다음으로(마지막 문장 추가):

```ts
export const PHOTO_INSTRUCTION = `

**사진 활용 (첨부됨)**: 사용자가 사진 1장을 올렸습니다. 사진을 보고 계획서대로 그 사진을 **활용하는** 프로그램(퍼즐·필터·스티커·사진 게임·꾸미기 등)을 만드세요. 코드에서 이미지 소스는 반드시 \`__PHOTO__\` 리터럴을 쓰고(사진을 다시 그리거나 다른 URL을 쓰지 마세요), 사진의 크기·비율은 모를 수 있으니 \`object-fit\`·런타임 \`naturalWidth/Height\`로 어떤 사진에도 맞게 하세요. 같은 사진을 여러 칸·여러 곳에 보여줄 때는 \`__PHOTO__\`를 칸마다 반복하지 말고, 단일 \`new Image()\`(또는 \`<img>\`) 하나로 \`__PHOTO__\`를 **한 번만** 불러와 \`<canvas>\`에 그린 뒤 \`drawImage\`로 잘라·복제해 재사용하기를 권합니다(퍼즐은 사진 1장을 canvas에 그린 뒤 조각으로 나누는 방식을 권장).`;
```

- [ ] **Step 2: 타입체크**

Run: `cd ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: PASS (문자열 상수만 변경 — 에러 0).

- [ ] **Step 3: 커밋**

```bash
git add ai-program-generator/lib/ai/prompts.ts
git commit -m "feat(photo): 시스템 프롬프트에 사진 1회 로드·canvas 재사용 유도

__PHOTO__를 칸마다 반복하지 말고 1회 로드 후 drawImage로 재사용 권장.
서빙 doc 크기·퍼즐 품질 개선(서빙-시점 치환의 보조 장치). 스펙 §3.3."
```

---

## Task 4: GREEN 검증 (self-test + 빌드 + 수동)

**Files:** (없음 — 검증만)

- [ ] **Step 1: self-test GREEN 확인**

dev 서버가 떠 있는지 확인(편집분은 라우트 요청 시 HMR로 반영됨). 필요시 잔여 node 정리 후 `npm run dev` 재기동.

Run: `cd ai-program-generator && node scripts/selftest-preview-photo.mjs`
Expected: **PASS** — 모든 항목 ✅, 마지막에 `SELFTEST_PREVIEW_PHOTO_OK` 출력. 특히 `9회 참조+사진 POST → 200 + id`(기존 RED였던 항목)와 `서빙 doc에 사진 data-URI 9회 인라인`이 통과.

- [ ] **Step 2: 프로덕션 빌드 (dev 서버 중지 후)**

`.next`를 dev와 공유하므로 dev 서버를 먼저 종료한다(CLAUDE.md: dev 실행 중 build 금지).

Run: `cd ai-program-generator && npm run build`
Expected: 타입체크 포함 빌드 성공(에러 0).

- [ ] **Step 3: 수동 브라우저 확인(회귀 0)**

`npm run dev` 재기동 후 학생/교사 계정으로:
1. 사진 업로드 → 다칸 사진 퍼즐류 생성 → **미리보기 성공**(기존엔 실패 가능).
2. 사진 없는 일반 생성 → 미리보기 정상.
3. 교실 보드 업로드 → 멤버 미리보기 → 공유 PIN 보기 모두 정상.
4. ZIP 다운로드 정상(변경 없음, 회귀 확인).

Expected: 모두 정상. 콘솔/네트워크에 500·"불러오지 못했어요" 없음.

- [ ] **Step 4: self-test 정리**

self-test는 미커밋이므로 git에 들어가지 않았는지 확인(`git status`에 `scripts/selftest-preview-photo.mjs`가 `??`로만 보여야 함). 보관/삭제는 선택.

Run: `cd ai-program-generator && git status --short scripts/`
Expected: `?? scripts/selftest-preview-photo.mjs` (tracked 아님).

---

## 비고

- **rules 배포 불필요**: `firestore.rules`·인덱스 변경 없음(저장 컬렉션·쿼리 모양 동일, `previews`는 Admin 전용).
- **데이터 형식 호환**: 배포 후 `previews` 문서 형식이 `{doc}` → `{code,photo}`로 바뀐다. 기존 `{doc}` 레코드는 TTL 10분 내 자연 만료되며, 그 사이 `getPreview`가 `!data.code`로 걸러 `null`(친절한 만료 안내) 반환 — 깨지지 않음.
- **잔여(스펙 §6)**: 한글-바이트 오버플로는 선재·직교 문제로 이 플랜 범위 밖(그대로 둠).
