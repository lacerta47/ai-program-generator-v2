# 스트리밍 생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/api/generate`를 스트리밍으로 전환해, 생성 중 "AI가 실제로 작업 중"임을 교육적으로 보여준다(생성기=개념 내레이션+구문강조 라이브 코드, easy=3단계 진행 신호), 미리보기는 완성 시 렌더.

**Architecture:** 접근법 ① — `@google/genai`의 `generateContentStream`으로 `responseSchema` JSON 모드를 스트림하고, 누적 텍스트를 `best-effort-json-parser`로 부분 파싱해 `{html,css,javascript}` 부분 객체를 흘린다. 어댑터 경계(`AIProvider`)·flash→flash-lite 폴백·503 재시도 보존. 전송은 `/api/generate`의 NDJSON `ReadableStream`(인증·한도 선점/환불 유지). 클라이언트는 NDJSON을 파싱해 `onDelta`로 라이브 표시.

**Tech Stack:** Next.js 15(App Router) · TypeScript · `@google/genai` · Firebase Admin · highlight.js(기존 `CodeView`) · `best-effort-json-parser`(신규).

**스펙 대비 변경(계획 중 발견):** 스펙은 `prismjs`+신규 `CodeBlock`이었으나, **기존 `components/ui/CodeView.tsx`(highlight.js)** 재사용으로 변경(의존성 0 추가, 패턴 일치). 스트리밍 중엔 Prettier가 미완성 코드에서 실패하므로 `CodeView`에 **포맷 생략 모드**만 추가. (Task 9에서 스펙 문서 동기화.)

**검증 방식:** 테스트 프레임워크 없음 → 각 태스크는 `tsc --noEmit` + (해당 시) self-test 스크립트 + 브라우저로 검증. dev 서버 실행 중엔 `npm run build` 금지(.next 공유). 자체 스크립트는 커밋하지 않음(기존 `selftest-*.mjs` 관례).

**브랜치:** `feature/streaming-generation` (스펙 커밋이 이미 있음).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/ai/types.ts` (수정) | `GenerationChunk` 타입 + `AIProvider.generateStream` 계약 |
| `lib/ai/partialJson.ts` (신규) | 누적 텍스트 → `Partial<GeneratedCode>` 관용 파서(`best-effort-json-parser` 래핑) |
| `lib/ai/gemini.ts` (수정) | `generateStream` 구현(스트림+폴백+부분파싱+최종검증), `generate`는 stream 소비 |
| `lib/ai/streamStages.ts` (신규) | 도착 필드 → 3층 개념 친근 문구(생성기·easy 공유) |
| `app/api/generate/route.ts` (수정) | 응답을 NDJSON `ReadableStream`으로, 인스트림 에러·취소 환불 |
| `lib/client/generate.ts` (수정) | `requestGenerateStream` 추가(기존 `requestGenerate`는 stream 래핑으로 유지) |
| `components/ui/CodeView.tsx` (수정) | `skipFormat` prop(스트리밍용 즉시 강조, Prettier 생략) |
| `components/creator/Creator.tsx` (수정) | 스트리밍 상태·onDelta·AbortController·취소·탭 전환 |
| `components/creator/ResultPanel.tsx` (수정) | busy 시 개념 내레이션 배너 + 라이브 강조 코드 + 취소 |
| `components/survey/SurveyWizard.tsx` (수정) | `requestGenerateStream`으로 교체 + 단계 신호(취소는 기존 abortRef 재사용) |
| `package.json` (수정) | `best-effort-json-parser` 추가 |

---

## Task 1: 의존성 추가

**Files:**
- Modify: `ai-program-generator/package.json`

- [ ] **Step 1: 설치**

Run (in `ai-program-generator/`):
```bash
npm install best-effort-json-parser
```
Expected: `package.json` `dependencies`에 `best-effort-json-parser` 추가, 설치 성공.

- [ ] **Step 2: 익스포트 형태 확인**

Run:
```bash
node -e "const m=require('best-effort-json-parser'); console.log(typeof m.parse)"
```
Expected: `function` (이름붙은 `parse` export). 만약 `undefined`면 `console.log(Object.keys(m))`로 실제 export 이름 확인 후 Task 2의 import를 맞춘다.

- [ ] **Step 3: 빌드 그린 확인**

Run:
```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
```
Expected: `TSC_OK` (의존성만 추가, 코드 변경 없음).

- [ ] **Step 4: Commit**

```bash
git add ai-program-generator/package.json ai-program-generator/package-lock.json
git commit -m "build: best-effort-json-parser 추가(스트리밍 부분 JSON 파싱)"
```

---

## Task 2: 어댑터 계약 + 부분 파서

**Files:**
- Modify: `ai-program-generator/lib/ai/types.ts`
- Create: `ai-program-generator/lib/ai/partialJson.ts`

- [ ] **Step 1: 계약에 스트리밍 추가** — `lib/ai/types.ts`의 `AIProvider` 인터페이스를 교체

```ts
export interface GeneratedCode {
  html: string;
  css: string;
  javascript: string;
}

/** 스트리밍 청크: 진행 중 부분 코드(delta) → 검증 통과한 최종(done). */
export type GenerationChunk =
  | { type: 'delta'; partial: Partial<GeneratedCode> }
  | { type: 'done'; code: GeneratedCode };

export interface AIProvider {
  /** 점진 생성: 부분 코드를 delta로 흘리고 마지막에 검증된 최종을 done으로 emit. */
  generateStream(input: GenerateInput): AsyncIterable<GenerationChunk>;
  /** 비스트리밍 편의: generateStream을 끝까지 소비해 최종만 반환. */
  generate(input: GenerateInput): Promise<GeneratedCode>;
}
```
(기존 `GeneratedCode`·`GenerateInput`·`GenerateMode`는 그대로 두고, 위 `GenerationChunk`와 `AIProvider`만 반영.)

- [ ] **Step 2: 부분 파서 작성** — `lib/ai/partialJson.ts`

```ts
import { parse } from 'best-effort-json-parser';
import type { GeneratedCode } from './types';

/**
 * 스트리밍 중 누적된(=불완전한) JSON 텍스트에서 {html,css,javascript}의 "지금까지" 값을 관용 추출.
 * 파싱 불가 구간이면 빈 객체. 문자열인 필드만 채운다.
 */
export function parsePartialCode(raw: string): Partial<GeneratedCode> {
  if (!raw) return {};
  let obj: unknown;
  try {
    obj = parse(raw);
  } catch {
    return {};
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const out: Partial<GeneratedCode> = {};
  if (typeof o.html === 'string') out.html = o.html;
  if (typeof o.css === 'string') out.css = o.css;
  if (typeof o.javascript === 'string') out.javascript = o.javascript;
  return out;
}
```

- [ ] **Step 3: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: `gemini.ts`가 아직 `generateStream`을 구현하지 않아 **실패**(예: "Property 'generateStream' is missing"). 이는 정상 — Task 3에서 해소. (이 단계는 계약이 올바르게 더 엄격해졌는지 확인용.)

- [ ] **Step 4: 진행** — Task 3까지 끝내고 함께 커밋(중간 상태는 빌드 깨짐이 정상).

---

## Task 3: gemini.ts 스트리밍 구현

**Files:**
- Modify: `ai-program-generator/lib/ai/gemini.ts`

- [ ] **Step 1: import 추가** — 파일 상단 import 블록에

```ts
import type { AIProvider, GeneratedCode, GenerateInput, GenerationChunk } from './types';
import { parsePartialCode } from './partialJson';
```
(기존 `import type { AIProvider, GeneratedCode, GenerateInput } from './types';`를 위 형태로 교체.)

- [ ] **Step 2: 스트림 시작 헬퍼 추가** — `callModel` 함수 아래에

```ts
/** 모델 스트림 시작(초기화)만 담당 — 503 재시도는 callWithRetry로. */
function startStream(ai: GoogleGenAI, model: string, input: GenerateInput) {
  return callWithRetry(() =>
    ai.models.generateContentStream({
      model,
      contents: input.prompt,
      config: {
        systemInstruction: input.system,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  );
}
```

- [ ] **Step 3: `GeminiProvider`의 `generate`를 `generateStream` + 소비로 교체** — 클래스 본문을 아래로 교체

```ts
export class GeminiProvider implements AIProvider {
  async *generateStream(input: GenerateInput): AsyncGenerator<GenerationChunk> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    const ai = new GoogleGenAI({ apiKey });

    // 초기화 시점에 폴백/재시도 적용(첫 청크 전에 429/503이 표면화됨)
    let stream;
    try {
      stream = await startStream(ai, PRIMARY_MODEL, input);
    } catch (e) {
      if (!isQuotaExhausted(e)) throw e;
      console.warn(`[gemini] ${PRIMARY_MODEL} 일일 무료 한도 소진 → ${FALLBACK_MODEL}로 폴백`);
      try {
        stream = await startStream(ai, FALLBACK_MODEL, input);
      } catch (e2) {
        if (isQuotaExhausted(e2)) {
          throw new Error(
            '오늘 사용할 수 있는 무료 AI 횟수를 모두 썼어요. 내일 다시 해보세요! (무료 한도는 매일 새로 채워져요)',
          );
        }
        throw e2;
      }
    }

    let acc = '';
    let lastSig = '';
    for await (const chunk of stream) {
      const t = chunk.text;
      if (!t) continue;
      acc += t;
      const partial = parsePartialCode(acc);
      const sig = JSON.stringify(partial);
      if (sig !== lastSig) {
        lastSig = sig;
        yield { type: 'delta', partial };
      }
    }

    // 최종: 엄격 파싱 + 빈 html 검사(기존 의미 보존)
    let parsed: unknown;
    try {
      parsed = JSON.parse(acc);
    } catch {
      throw new Error('Gemini 응답을 JSON으로 파싱하지 못했습니다.');
    }
    const code = normalize(parsed);
    if (!code.html.trim()) {
      throw new Error('AI가 빈 결과를 만들었어요. 다시 한 번 만들어 볼까요?');
    }
    yield { type: 'done', code };
  }

  async generate(input: GenerateInput): Promise<GeneratedCode> {
    let final: GeneratedCode | null = null;
    for await (const chunk of this.generateStream(input)) {
      if (chunk.type === 'done') final = chunk.code;
    }
    if (!final) throw new Error('Gemini 응답이 비어 있습니다.');
    return final;
  }
}
```
(기존 `async generate(...)` 본문 전체를 위 클래스 본문으로 대체. `callModel`은 더 이상 쓰이지 않으면 삭제하거나 둬도 무방 — 미사용 경고 피하려면 삭제. `isQuotaExhausted`/`callWithRetry`/`normalize`는 그대로 사용.)

- [ ] **Step 4: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`. (계약 충족.) 만약 `callModel` 미사용 경고/에러가 빌드에서 나면 해당 함수 삭제.

- [ ] **Step 5: Commit** (Task 2+3 함께)

```bash
git add ai-program-generator/lib/ai/types.ts ai-program-generator/lib/ai/partialJson.ts ai-program-generator/lib/ai/gemini.ts
git commit -m "feat(ai): generateStream 계약+gemini 스트리밍 구현(폴백/검증 보존)"
```

---

## Task 4: streamStages.ts (공유 개념 매핑)

**Files:**
- Create: `ai-program-generator/lib/ai/streamStages.ts`

- [ ] **Step 1: 작성**

```ts
import type { GeneratedCode } from './types';

export type StreamStage = 'html' | 'css' | 'javascript';
export const STAGE_ORDER: StreamStage[] = ['html', 'css', 'javascript'];

/** 부분 코드에서 '지금 도착 중'인 필드 추정: 값이 있는 마지막 필드(순서 html→css→js). */
export function currentStage(partial: Partial<GeneratedCode>): StreamStage | null {
  let cur: StreamStage | null = null;
  for (const k of STAGE_ORDER) {
    if (typeof partial[k] === 'string' && partial[k] !== '') cur = k;
  }
  return cur;
}

/** 가르치는 개념(3층). */
export const STAGE_CONCEPT: Record<StreamStage, string> = {
  html: '구조',
  css: '스타일',
  javascript: '동작',
};

/** 생성기 배너용 친근 문구. */
export const STAGE_LABEL: Record<StreamStage, string> = {
  html: '화면의 뼈대를 만들어요',
  css: '색과 모양으로 꾸며요',
  javascript: '규칙과 움직임을 넣어요',
};

/** easy(저학년) 진행 신호용 더 단순한 문구. */
export const STAGE_LABEL_EASY: Record<StreamStage, string> = {
  html: '화면을 그려요',
  css: '예쁘게 꾸며요',
  javascript: '움직임을 넣어요',
};
```

- [ ] **Step 2: 타입체크 + Commit**

```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
git add ai-program-generator/lib/ai/streamStages.ts
git commit -m "feat(ai): streamStages — 도착 필드→3층 개념 문구(생성기·easy 공유)"
```
Expected: `TSC_OK`.

---

## Task 5: /api/generate NDJSON 스트리밍

**Files:**
- Modify: `ai-program-generator/app/api/generate/route.ts`

- [ ] **Step 1: 생성 블록을 스트리밍으로 교체** — 현재 `// 4) 생성 — 실패 시 선점한 한도를 환불` 의 `try { ... } catch { ... }` 전체를 아래로 교체

```ts
  // 4) 생성(스트리밍) — NDJSON. 실패/취소 시 선점한 한도를 1회 환불.
  const provider = getAIProvider();
  let system = SYSTEM_PROMPTS[promptVariant];
  let finalPrompt = prompt;
  if (mode === 'modify') {
    system = SYSTEM_PROMPTS[promptVariant] + MODIFY_SYSTEM_SUFFIX;
  } else {
    const exemplar = await getExemplar(promptVariant);
    if (exemplar) finalPrompt = buildExemplarBlock(exemplar) + prompt;
  }

  const encoder = new TextEncoder();
  let refunded = false;
  const refundOnce = async () => {
    if (refunded || isAdmin) return;
    refunded = true;
    await refundQuota(usageRef);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        for await (const chunk of provider.generateStream({ prompt: finalPrompt, system, mode })) {
          if (req.signal.aborted) throw new Error('ABORTED');
          send(chunk);
        }
        controller.close();
      } catch (e) {
        const aborted = req.signal.aborted || (e instanceof Error && e.message === 'ABORTED');
        await refundOnce();
        if (!aborted) {
          console.error('[/api/generate] 스트리밍 실패:', e);
          try {
            send({ type: 'error', error: e instanceof Error ? e.message : 'AI 생성에 실패했습니다.' });
          } catch {}
        }
        try {
          controller.close();
        } catch {}
      }
    },
    async cancel() {
      // 클라이언트 연결 끊김(취소) — 한도 환불
      await refundOnce();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
```
(인증·입력검증·한도 선점 블록 1)2)3)은 **변경 없음**. `refundQuota` 함수도 그대로.)

- [ ] **Step 2: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK`.

- [ ] **Step 3: Commit**

```bash
git add ai-program-generator/app/api/generate/route.ts
git commit -m "feat(api): /api/generate NDJSON 스트리밍(인스트림 에러·취소 환불)"
```

---

## Task 6: 클라이언트 스트리밍 헬퍼

**Files:**
- Modify: `ai-program-generator/lib/client/generate.ts`

- [ ] **Step 1: `requestGenerateStream` 추가 + `requestGenerate`를 래퍼로** — 파일 전체를 아래로 교체

```ts
import { auth } from '@/lib/firebase/client';
import type { GeneratedCode, GenerateMode } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

interface StreamOpts {
  /** 부분 코드 도착 콜백(라이브 표시용). */
  onDelta?: (partial: Partial<GeneratedCode>) => void;
  signal?: AbortSignal;
}

/** 클라이언트에서 /api/generate(NDJSON 스트림)를 호출. onDelta로 부분 코드를 받고 최종을 반환. */
export async function requestGenerateStream(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
  opts: StreamOpts = {},
): Promise<GeneratedCode> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('로그인해야 프로그램을 만들 수 있어요.');
  }
  const idToken = await user.getIdToken();

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ prompt, mode, variant }),
    signal: opts.signal,
  });

  // 스트림 시작 전 에러(인증·검증·한도)는 일반 JSON 응답
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let final: GeneratedCode | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as
        | { type: 'delta'; partial: Partial<GeneratedCode> }
        | { type: 'done'; code: GeneratedCode }
        | { type: 'error'; error: string };
      if (msg.type === 'delta') opts.onDelta?.(msg.partial);
      else if (msg.type === 'done') final = msg.code;
      else if (msg.type === 'error') throw new Error(msg.error);
    }
  }

  if (!final) throw new Error('생성 결과를 받지 못했어요. 다시 해볼까요?');
  return final;
}

/** 하위호환: 스트림을 끝까지 소비해 최종만 반환(부분 표시 없음). */
export async function requestGenerate(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
  signal?: AbortSignal,
): Promise<GeneratedCode> {
  return requestGenerateStream(prompt, mode, variant, { signal });
}
```

- [ ] **Step 2: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit && echo TSC_OK`
Expected: `TSC_OK` (기존 `requestGenerate` 호출부는 시그니처 동일이라 그대로 동작).

- [ ] **Step 3: 스트리밍 self-test 스크립트 작성** — `ai-program-generator/scripts/selftest-generate-stream.mjs` (커밋 안 함)

```js
// 스트리밍 /api/generate 검증(개발용): delta 다수 → done + 유효 코드, 빈 프롬프트 400.
// 사전: npm run dev 실행 중 + serviceAccountKey.json, .env.local.
// 사용: node scripts/selftest-generate-stream.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3000';
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
initializeApp({ credential: cert(sa) });
async function idToken() {
  const custom = await getAuth().createCustomToken('dev-test-user', { dev: true });
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const d = await r.json(); if (!r.ok) throw new Error(JSON.stringify(d)); return d.idToken;
}
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

async function main() {
  const token = await idToken();
  // 1) 정상 스트림
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: '숫자 1~10을 더하는 아주 간단한 계산기', mode: 'generate', variant: 'default' }),
  });
  check('200 + 스트림', res.ok && !!res.body, String(res.status));
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', deltas = 0, done = null, error = null;
  for (;;) { const { done: d, value } = await reader.read(); if (d) break; buf += dec.decode(value, { stream: true });
    let nl; while ((nl = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1); if (!line) continue;
      const m = JSON.parse(line); if (m.type === 'delta') deltas++; else if (m.type === 'done') done = m.code; else if (m.type === 'error') error = m.error; } }
  check('delta 다수 수신', deltas >= 2, `deltas=${deltas}`);
  check('done 수신', !!done && !error, error || '');
  check('유효 코드(html 비지 않음)', !!done && typeof done.html === 'string' && done.html.trim().length > 0);
  // 2) 빈 프롬프트 → 시작 전 400
  const bad = await fetch(`${BASE}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ prompt: '', mode: 'generate' }) });
  check('빈 프롬프트 400', bad.status === 400, String(bad.status));
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`); process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: 스트리밍 self-test 실행** — 별도 셸에서 dev 띄우고

```bash
# 셸 A: npm run dev   (또는 preview_start)
node scripts/selftest-generate-stream.mjs
```
Expected: 5개 모두 ✅ (`200+스트림`, `delta 다수`, `done`, `유효 코드`, `빈 프롬프트 400`). 실패 시 gemini.ts/route.ts/generate.ts 점검.

- [ ] **Step 5: Commit** (스크립트 제외)

```bash
git add ai-program-generator/lib/client/generate.ts
git commit -m "feat(client): requestGenerateStream(NDJSON) + requestGenerate 래퍼"
```

---

## Task 7: CodeView 포맷 생략 모드

**Files:**
- Modify: `ai-program-generator/components/ui/CodeView.tsx`

- [ ] **Step 1: `skipFormat` prop 추가** — `Props`에 추가하고 포맷 효과를 가드

`Props` 인터페이스에 한 줄 추가:
```ts
  /** 스트리밍 중 등 미완성 코드: Prettier 생략하고 즉시 강조(기본 false). */
  skipFormat?: boolean;
```
컴포넌트 시그니처를 `export default function CodeView({ code, language, className = '', skipFormat = false }: Props) {` 로 변경.

포맷 `useEffect`를 아래로 교체(생략 시 원본 사용):
```ts
  useEffect(() => {
    let alive = true;
    if (skipFormat || !code) {
      setPretty(null);
      return;
    }
    setPretty(null);
    formatCode(code, language)
      .then((f) => alive && setPretty(f.trimEnd()))
      .catch(() => alive && setPretty(code));
    return () => {
      alive = false;
    };
  }, [code, language, skipFormat]);
```
`const source = pretty ?? code;` 는 그대로 — `skipFormat`이면 `pretty`가 null이라 원본 강조.

- [ ] **Step 2: 타입체크 + Commit**

```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
git add ai-program-generator/components/ui/CodeView.tsx
git commit -m "feat(ui): CodeView skipFormat(스트리밍 즉시 강조)"
```
Expected: `TSC_OK`.

---

## Task 8: 생성기 — 스트리밍 라이브 표시 + 취소

**Files:**
- Modify: `ai-program-generator/components/creator/Creator.tsx`
- Modify: `ai-program-generator/components/creator/ResultPanel.tsx`

- [ ] **Step 1: Creator import 교체** — `requestGenerate` → `requestGenerateStream`, 부분 타입

```ts
import { requestGenerateStream } from '@/lib/client/generate';
```
(`import { requestGenerate } ...` 라인을 위로 교체.)

- [ ] **Step 2: Creator 스트리밍 상태 추가** — 다른 useState 근처에

```ts
  const [streamingPartial, setStreamingPartial] = useState<Partial<GeneratedCode>>({});
  const abortRef = useRef<AbortController | null>(null);
```

- [ ] **Step 3: `startLoadingMessages` 제거 + `handleGenerate` 교체**

`GENERATE_MESSAGES`/`MODIFY_MESSAGES`/`startLoadingMessages`/`loadingMsg` 상태는 제거. `handleGenerate` 본문의 생성 부분을 아래로:
```ts
    const promptText = buildGeneratePrompt(plan);
    setGenPrompt(promptText);
    setStreamingPartial({});
    setResultTab('code'); // 스트림 중 코드 탭에서 라이브 표시
    setLoading('generating');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await requestGenerateStream(promptText, 'generate', 'default', {
        signal: ctrl.signal,
        onDelta: setStreamingPartial,
      });
      setCode(result);
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
      toast('우와! 멋진 프로그램을 완성했어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setStreamingPartial({});
      setLoading('idle');
    }
```

- [ ] **Step 4: `handleModify` 동일 패턴으로 교체** — 생성 부분을

```ts
    setLoading('modifying');
    setGenPrompt((prev) => `${prev}\n\n[수정 요청]: ${modifyText}`.slice(-40000));
    setStreamingPartial({});
    setResultTab('code');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await requestGenerateStream(buildModifyPrompt(plan, code, modifyText), 'modify', 'default', {
        signal: ctrl.signal,
        onDelta: setStreamingPartial,
      });
      setCode(result);
      setModifyText('');
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
      toast('원하는 대로 고쳐봤어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '고치다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setStreamingPartial({});
      setLoading('idle');
    }
```

- [ ] **Step 5: 취소 핸들러 추가** (Creator 내)
```ts
  function handleCancel() {
    abortRef.current?.abort();
  }
```

- [ ] **Step 6: ResultPanel props 갱신** — `<ResultPanel ... />`에서 `loadingMsg={loadingMsg}` 제거하고 추가:
```tsx
        streamingPartial={streamingPartial}
        onCancel={handleCancel}
```

- [ ] **Step 7: ResultPanel 시그니처/표시 교체** — `Props`에서 `loadingMsg: string;` 제거, 추가:
```ts
  streamingPartial: Partial<GeneratedCode>;
  onCancel: () => void;
```
import 추가:
```ts
import { currentStage, STAGE_LABEL, STAGE_CONCEPT, STAGE_ORDER } from '@/lib/ai/streamStages';
```
busy 블록(현재 `<BuilderBot/> + LoadingDots`)을 **개념 내레이션 배너 + 라이브 강조 코드 + 취소**로 교체:
```tsx
      {busy ? (
        <div className="flex flex-1 flex-col gap-3">
          {(() => {
            const stage = currentStage(streamingPartial);
            const liveCode = stage ? streamingPartial[stage] ?? '' : '';
            const langMap = { html: 'html', css: 'css', javascript: 'javascript' } as const;
            return (
              <>
                <div className="flex items-center gap-2 rounded-[var(--r-md)] border-2 border-brand/30 bg-brand-soft px-4 py-3">
                  <LoadingDots />
                  <span className="text-[16px] text-brand-strong dark:text-brand">
                    {stage ? STAGE_LABEL[stage] : 'AI가 준비하고 있어요…'}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {STAGE_ORDER.map((s) => (
                    <span
                      key={s}
                      className={`rounded-full px-3 py-1 text-[13px] font-medium ${
                        stage === s ? 'bg-brand text-brand-ink' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {STAGE_CONCEPT[s]}
                    </span>
                  ))}
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line">
                  {liveCode ? (
                    <CodeView code={liveCode} language={stage!} skipFormat className="h-full min-h-[44vh] bg-surface" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><BuilderBot /></div>
                  )}
                </div>
                <Button variant="ghost" onClick={onCancel} className="self-center">그만 만들기</Button>
              </>
            );
          })()}
        </div>
      ) : !hasCode ? (
```
(`langMap`은 사용 안 하면 제거 — `stage`가 곧 `'html'|'css'|'javascript'`라 `language={stage!}`로 충분. import에서 `LoadingDots`·`BuilderBot`·`CodeView`는 기존에 이미 import됨.)

- [ ] **Step 8: 타입체크 + 빌드**

Run (dev 정지 상태):
```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
rm -rf .next && npm run build > /tmp/b.log 2>&1 && test -f .next/BUILD_ID && echo BUILD_OK; rm -rf .next
```
Expected: `TSC_OK`, `BUILD_OK`.

- [ ] **Step 9: 브라우저 검증** — dev 띄우고 `/create`에서 생성

확인: 스트림 시작 시 코드 탭으로 전환, 개념 배너가 구조→스타일→동작으로 바뀌고, 구문강조된 코드가 라이브로 차오름, 완성 시 미리보기 탭으로 전환·렌더. "그만 만들기" 누르면 멈추고 idle 복귀. modify도 동일.

- [ ] **Step 10: Commit**

```bash
git add ai-program-generator/components/creator/Creator.tsx ai-program-generator/components/creator/ResultPanel.tsx
git commit -m "feat(creator): 스트리밍 라이브 코드+개념 내레이션+취소"
```

---

## Task 9: easy 모드 — 스트리밍 단계 신호

**Files:**
- Modify: `ai-program-generator/components/survey/SurveyWizard.tsx`

- [ ] **Step 1: import 교체** — `requestGenerate` → `requestGenerateStream`, 단계 유틸
```ts
import { requestGenerateStream } from '@/lib/client/generate';
import { currentStage, STAGE_LABEL_EASY } from '@/lib/ai/streamStages';
```

- [ ] **Step 2: `generate()`의 생성부 교체** — `startBuildMessages` 호출 제거하고 onDelta로 단계 문구
```ts
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBuildMsg('AI가 준비하고 있어요…');
    try {
      const prompt = assemblePrompt(type, answers);
      setGenPrompt(prompt);
      const result = await requestGenerateStream(prompt, 'generate', 'survey', {
        signal: ctrl.signal,
        onDelta: (p) => {
          const s = currentStage(p);
          if (s) setBuildMsg(STAGE_LABEL_EASY[s]);
        },
      });
      setCode(result);
      setPreviewKey((k) => k + 1);
      toast('우와! 멋진 걸 만들었어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
```

- [ ] **Step 3: `handleSurveyModify()`의 생성부 동일 패턴 교체**
```ts
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBuildMsg('AI가 준비하고 있어요…');
    try {
      const prompt = buildModifyPrompt(surveyToPlan(type, answers), code, request);
      const result = await requestGenerateStream(prompt, 'modify', 'survey', {
        signal: ctrl.signal,
        onDelta: (p) => {
          const s = currentStage(p);
          if (s) setBuildMsg(STAGE_LABEL_EASY[s]);
        },
      });
      setCode(result);
      setPreviewKey((k) => k + 1);
      setFixPicks([]);
      setFixText('');
      toast('원하는 대로 고쳐봤어요!', 'success');
    } catch (e) {
      if (!ctrl.signal.aborted && !(e instanceof Error && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : '고치다가 문제가 생겼어요. 다시 해볼까요?');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
```
(`startBuildMessages` 함수와 `BUILD_MESSAGES`/`FIX_MESSAGES` 상수가 더 이상 안 쓰이면 제거. `abortRef`·`setBusy`·`buildMsg`·취소 버튼은 기존 그대로 재사용.)

- [ ] **Step 4: 타입체크 + 빌드**
Run (dev 정지):
```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
rm -rf .next && npm run build > /tmp/b.log 2>&1 && test -f .next/BUILD_ID && echo BUILD_OK; rm -rf .next
```
Expected: `TSC_OK`, `BUILD_OK`.

- [ ] **Step 5: 브라우저 검증** — `/easy`에서 선택지 채우고 만들기
확인: BuilderBot 유지된 채 진행 문구가 "화면을 그려요→예쁘게 꾸며요→움직임을 넣어요"로 **실제 도착 기반** 전환, 완성 시 미리보기. "그만 만들기" 동작. 고치기도 동일.

- [ ] **Step 6: Commit**
```bash
git add ai-program-generator/components/survey/SurveyWizard.tsx
git commit -m "feat(survey): easy 모드 스트리밍 단계 진행 신호"
```

---

## Task 10: 마무리 — 스펙 동기화·전체 검증·PR

**Files:**
- Modify: `ai-program-generator/docs/superpowers/specs/2026-06-18-streaming-generation-design.md`

- [ ] **Step 1: 스펙 동기화** — prismjs/CodeBlock 언급을 highlight.js/CodeView 재사용으로 정정(의존성 표·파일 영향 표). 한 줄 메모: "구현 중 기존 CodeView(highlight.js) 재사용으로 변경, prismjs 불채택."

- [ ] **Step 2: 미사용 정리** — `requestGenerate`가 더 이상 어디서도 직접 안 쓰이면 둘지/뺄지 판단(래퍼라 둬도 무해). `grep -rn "requestGenerate\b"`로 확인.

Run:
```bash
grep -rn "requestGenerate\b" ai-program-generator/ --include=*.ts --include=*.tsx
```
Expected: 정의(래퍼)만 남고 직접 호출 없음이면 OK(유지).

- [ ] **Step 3: 전체 검증** (dev 정지)
```bash
./node_modules/.bin/tsc --noEmit && echo TSC_OK
rm -rf .next && npm run build > /tmp/b.log 2>&1 && test -f .next/BUILD_ID && echo BUILD_OK; rm -rf .next
```
그리고 스트리밍 self-test 재실행(dev 띄운 뒤): `node scripts/selftest-generate-stream.mjs` → 5/5.
브라우저 e2e: 생성기 생성·modify·취소, easy 생성·고치기·취소, 미리보기는 게시판 GET 경로 무영향 확인.

- [ ] **Step 4: 스펙 커밋 + 푸시 + PR**
```bash
git add ai-program-generator/docs/superpowers/specs/2026-06-18-streaming-generation-design.md
git commit -m "docs(spec): 스트리밍 — highlight.js 재사용으로 정정"
git push -u origin feature/streaming-generation
gh pr create --base main --head feature/streaming-generation --title "feat: 스트리밍 생성(라이브 코드+개념 내레이션)" --body "<요약>"
```
CI(build) 통과 + MERGEABLE 확인 후 사용자에게 병합 제시.

---

## Self-Review

**1. Spec coverage:**
- 계약 generateStream(delta/done) → Task 2,3 ✅
- @google/genai 스트림+폴백+503 보존 → Task 3 ✅
- 부분 JSON 파서(best-effort) → Task 1,2 ✅
- NDJSON 전송+인증·한도 선점/환불·인스트림 에러·취소 → Task 5 ✅
- 클라 requestGenerateStream → Task 6 ✅
- 생성기 개념 내레이션 배너+구문강조 라이브 코드+취소+탭 전환 → Task 8 ✅
- easy 3단계 진행 신호(공유 streamStages) → Task 4,9 ✅
- 구문강조 = 기존 CodeView(highlight.js) 재사용(스펙의 prismjs 대체) → Task 7,10 ✅
- 검증 tsc+build+self-test+브라우저 → Task 6,8,9,10 ✅

**2. Placeholder scan:** PR body의 `<요약>`만 실행 시 채움(의도적). 그 외 모든 단계 실제 코드 포함.

**3. Type consistency:** `GenerationChunk`(delta/done) · `parsePartialCode` · `currentStage`/`STAGE_LABEL`/`STAGE_LABEL_EASY`/`STAGE_CONCEPT`/`STAGE_ORDER` · `requestGenerateStream(opts.onDelta/signal)` · `CodeView`의 `skipFormat`/`language` — 태스크 전반에서 동일 시그니처 사용 확인.
