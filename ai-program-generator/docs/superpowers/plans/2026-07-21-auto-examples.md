# 자동 예시 생성 루틴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 놀고 있는 Gemini 무료 한도로 예시 작품을 자동 생성해 교육테스트 게시판에 쌓는 크론 엔드포인트를 만든다.

**Architecture:** `GET /api/cron/generate-examples`(CRON_SECRET)가 서베이 랜덤 조합으로 계획을 만들어(`randomPlan`) Gemini로 생성하고(`generateExampleOnce`) Admin SDK로 교육테스트에 게시(`publishExample`). Vercel 함수 시간제한 때문에 한 요청은 소량(MAX_PER_RUN=3)만 만들고, Claude 루틴이 `exhausted`까지 반복 호출해 그날 무료 한도를 소진.

**Tech Stack:** Next.js 15 Route Handler(nodejs) · firebase-admin(Firestore) · @google/genai(Gemini) · TypeScript.

## Global Constraints

- **테스트 프레임워크 없음.** 검증 = `./node_modules/.bin/tsc --noEmit` + `npm run build`(dev 정지 후) + `scripts/selftest-generate-examples.mjs`(미커밋) + 브라우저. `npx tsc` 금지.
- **스키마·firestore.rules·배포 변경 없음.** Admin SDK가 posts에 직접 써서 클라 규칙을 우회.
- **CRON_SECRET Bearer 인증**(`authorization === 'Bearer '+CRON_SECRET`, daily-stats 동일). 미설정 500, 불일치 401.
- 엔드포인트: `runtime='nodejs'`, `dynamic='force-dynamic'`, `maxDuration=60`, `MAX_PER_RUN=3`.
- 게시물: `ownerUid='auto-example-bot'`, `authorName='보기 예시'`, `boardTeacherUid=null`, `categoryId`=교육테스트.
- 무료 소진(429/`UserFacingError`)이면 `exhausted=true`로 그날 종료. 한 건 실패(검열·파싱·일시)는 스킵.
- **트리거는 코드 아님** — 사용자가 Claude 루틴 등록(daily-stats처럼), 엔드포인트를 exhausted까지 반복 호출.
- 브랜치 **`feat/auto-examples`**(생성됨, 스펙 `12ba935` 커밋, origin/main 기반). 커밋은 각 태스크 끝.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `lib/examples/randomPlan.ts` | 서베이 랜덤 조합 → `{type, answers, prompt, plan}` |
| `lib/examples/generateExampleOnce.ts` | survey 프롬프트+메타로 1건 생성 → `{code, meta}` |
| `lib/examples/publishExample.ts` | 검열 네트 + Admin SDK로 교육테스트에 게시 |
| `app/api/cron/generate-examples/route.ts` | 크론 GET — 인증·카테고리 조회·루프·요약 반환 |
| `scripts/selftest-generate-examples.mjs` | 검증(미커밋) |

---

## Task 1: 랜덤 계획 `lib/examples/randomPlan.ts`

**Files:** Create `lib/examples/randomPlan.ts`

**Interfaces:**
- Consumes: `PROGRAM_TYPES`(`@/lib/survey/programs`), `visibleSteps`/`assemblePrompt`/`surveyToPlan`(`@/lib/survey/assemble`), `AI_PICK`·`ProgramType`·`SurveyAnswers`·`SurveyStep`(`@/lib/survey/types`), `PlanFields`(`@/lib/firebase/types`).
- Produces: `interface RandomPlan { type: ProgramType; answers: SurveyAnswers; prompt: string; plan: PlanFields }` · `export function randomPlan(): RandomPlan`.

- [ ] **Step 1: 파일 생성**

```ts
import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import { visibleSteps, assemblePrompt, surveyToPlan } from '@/lib/survey/assemble';
import type { PlanFields } from '@/lib/firebase/types';

export interface RandomPlan {
  type: ProgramType;
  answers: SurveyAnswers;
  prompt: string;
  plan: PlanFields;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 한 단계의 무작위 답. 단일선택은 15% 확률로 '아무거나(AI)'. multi는 1~2개 선택. */
function randomAnswer(step: SurveyStep): string | string[] {
  const ids = step.options.map((o) => o.id);
  if (step.multi) {
    const n = 1 + Math.floor(Math.random() * Math.min(2, ids.length)); // 1~2
    return [...ids].sort(() => Math.random() - 0.5).slice(0, n);
  }
  if (Math.random() < 0.15) return AI_PICK; // AI_PICK은 단일선택 단계에만
  return pick(ids);
}

/** 서베이 타입·옵션을 무작위로 골라 완성된 예시 계획을 만든다. showIf가 이전 답에 의존하므로
 *  매번 visibleSteps를 다시 계산하며 아직 답 안 한 노출 단계를 채운다. */
export function randomPlan(): RandomPlan {
  const type = pick(PROGRAM_TYPES);
  const answers: SurveyAnswers = {};
  for (let guard = 0; guard < type.steps.length + 2; guard++) {
    const next = visibleSteps(type, answers).find((s) => answers[s.id] === undefined);
    if (!next) break;
    answers[next.id] = randomAnswer(next);
  }
  return { type, answers, prompt: assemblePrompt(type, answers), plan: surveyToPlan(type, answers) };
}
```

- [ ] **Step 2: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add lib/examples/randomPlan.ts
git commit -m "feat(examples): 서베이 랜덤 조합 계획 생성기

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 서버 생성 + 게시 helper

**Files:** Create `lib/examples/generateExampleOnce.ts`, `lib/examples/publishExample.ts`

**Interfaces:**
- Consumes: `getAIProvider`(`@/lib/ai/provider`), `SYSTEM_PROMPTS`·`LOGIC_META_INSTRUCTION`(`@/lib/ai/prompts`), `GeneratedCode`·`GenerationMeta`(`@/lib/ai/types`), `adminDb`(`@/lib/firebase/admin`), `assertClean`(`@/lib/moderation`), `RandomPlan`(Task 1).
- Produces: `generateExampleOnce(prompt: string): Promise<{ code: GeneratedCode; meta: GenerationMeta }>` · `publishExample(categoryId: string, rp: RandomPlan, code: GeneratedCode, meta: GenerationMeta): Promise<void>`.

- [ ] **Step 1: generateExampleOnce.ts 생성**

```ts
import type { GeneratedCode, GenerationMeta } from '@/lib/ai/types';
import { getAIProvider } from '@/lib/ai/provider';
import { SYSTEM_PROMPTS, LOGIC_META_INSTRUCTION } from '@/lib/ai/prompts';

/** 예시용 서버 생성 — /easy와 동일 톤(survey 시스템 프롬프트 + 교육 메타). done 청크의 code·meta 반환.
 *  무료 소진 시 gemini.ts가 UserFacingError를 던지며 그대로 위로 전파(호출부가 exhausted 처리). */
export async function generateExampleOnce(
  prompt: string,
): Promise<{ code: GeneratedCode; meta: GenerationMeta }> {
  const system = SYSTEM_PROMPTS['survey'] + LOGIC_META_INSTRUCTION;
  for await (const chunk of getAIProvider().generateStream({ prompt, system, mode: 'generate' })) {
    if (chunk.type === 'done') {
      return {
        code: chunk.code,
        meta: chunk.meta ?? { logicSummary: '', conceptTags: [], nextChallenge: '', conceptNotes: {} },
      };
    }
  }
  throw new Error('생성 결과(done)가 없어요.');
}
```

- [ ] **Step 2: publishExample.ts 생성**

```ts
import 'server-only';
import type { GeneratedCode, GenerationMeta } from '@/lib/ai/types';
import type { RandomPlan } from './randomPlan';
import { adminDb } from '@/lib/firebase/admin';
import { assertClean } from '@/lib/moderation';

const EXAMPLE_OWNER_UID = 'auto-example-bot'; // 자동예시 식별 키 — admin이 이 uid로 일괄 정리
const EXAMPLE_AUTHOR = '보기 예시';

/** 생성 예시를 교육테스트 카테고리에 게시(Admin SDK, 규칙 우회).
 *  검열 네트(korcen)를 통과 못하면 ProfanityError를 던져 호출부가 그 건 스킵하게 한다. */
export async function publishExample(
  categoryId: string,
  rp: RandomPlan,
  code: GeneratedCode,
  meta: GenerationMeta,
): Promise<void> {
  await assertClean(rp.plan.name, '제목');
  if (rp.plan.etc.trim()) await assertClean(rp.plan.etc, '계획');

  const doc: Record<string, unknown> = {
    title: rp.plan.name,
    categoryId,
    ownerUid: EXAMPLE_OWNER_UID,
    authorName: EXAMPLE_AUTHOR,
    code,
    plan: rp.plan,
    prompt: rp.prompt,
    createdAt: Date.now(),
    boardTeacherUid: null,
  };
  if (meta.logicSummary) doc.logicSummary = meta.logicSummary;
  if (meta.conceptTags.length) doc.conceptTags = meta.conceptTags;
  if (Object.keys(meta.conceptNotes).length) doc.conceptNotes = meta.conceptNotes;

  await adminDb.collection('posts').add(doc);
}
```

- [ ] **Step 3: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add lib/examples/generateExampleOnce.ts lib/examples/publishExample.ts
git commit -m "feat(examples): 서버 생성(메타 포함)·게시(Admin SDK 검열네트) helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 크론 엔드포인트 `app/api/cron/generate-examples/route.ts`

**Files:** Create `app/api/cron/generate-examples/route.ts`

**Interfaces:**
- Consumes: `adminDb`(`@/lib/firebase/admin`), `randomPlan`(Task 1), `generateExampleOnce`·`publishExample`(Task 2), `UserFacingError`(`@/lib/ai/errors`).
- Produces: `GET` → `{ made: number, exhausted: boolean, error?: string }`.

- [ ] **Step 1: 파일 생성**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { randomPlan } from '@/lib/examples/randomPlan';
import { generateExampleOnce } from '@/lib/examples/generateExampleOnce';
import { publishExample } from '@/lib/examples/publishExample';
import { UserFacingError } from '@/lib/ai/errors';

// 놀고 있는 Gemini 무료 한도로 예시 작품을 교육테스트 보드에 생성·게시. CRON_SECRET Bearer(daily-stats 동일).
// 한 요청은 소량(MAX_PER_RUN)만 — Vercel 함수 시간제한(maxDuration). 트리거(Claude 루틴)가 exhausted까지 반복 호출.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PER_RUN = 3;

async function findExampleCategoryId(): Promise<string | null> {
  const configured = process.env.EXAMPLE_CATEGORY_ID;
  if (configured) return configured;
  const snap = await adminDb.collection('categories').where('name', '==', '교육테스트').limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** 무료 소진(429/UserFacingError) 여부 — true면 그날 종료. */
function isExhausted(e: unknown): boolean {
  if (e instanceof UserFacingError) return true;
  const msg = String((e as { message?: string })?.message ?? e);
  const status = (e as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  if ((req.headers.get('authorization') ?? '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const categoryId = await findExampleCategoryId();
  if (!categoryId) {
    console.error("[generate-examples] '교육테스트' 카테고리를 찾지 못함");
    return NextResponse.json({ made: 0, exhausted: true, error: 'category-not-found' });
  }

  let made = 0;
  let exhausted = false;
  for (let i = 0; i < MAX_PER_RUN; i++) {
    try {
      const rp = randomPlan();
      const { code, meta } = await generateExampleOnce(rp.prompt);
      await publishExample(categoryId, rp, code, meta);
      made++;
    } catch (e) {
      if (isExhausted(e)) {
        exhausted = true;
        break;
      }
      console.error('[generate-examples] 한 건 실패(스킵):', e); // 검열/파싱/일시오류
    }
  }
  return NextResponse.json({ made, exhausted });
}
```

- [ ] **Step 2: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add app/api/cron/generate-examples/route.ts
git commit -m "feat(examples): 크론 엔드포인트 — 인증·카테고리·루프·exhausted

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 엔드투엔드 검증 + 빌드 + PR

**Files:** Create `scripts/selftest-generate-examples.mjs`(미커밋)

- [ ] **Step 1: self-test 작성**

`scripts/selftest-generate-examples.mjs` — dev 서버 + `.env.local`(CRON_SECRET) + `serviceAccountKey.json` 필요. **기존 `scripts/selftest-*.mjs`의 env·Admin 초기화 패턴을 따르고**, 아래를 수행:

```
// 1) Admin SDK로 게시 전 auto-example-bot 게시물 id 집합(before) 수집.
// 2) GET http://localhost:3000/api/cron/generate-examples, 헤더 Authorization: Bearer <CRON_SECRET>.
//    응답 {made, exhausted} 출력. (무료 소진이면 made=0·exhausted=true가 정상 — 코드 결함 아님.)
// 3) after 집합 수집. new = after - before. new 각 문서의 title·category 확인, '교육테스트' categoryId와 일치하는지.
// 4) 정리: new 문서만 삭제(before 것/실 예시는 보존). 결과 요약 출력.
// ※ dev와 prod가 같은 Firestore(test-ai-builder)이므로, 반드시 이 실행이 만든 new만 지운다.
```

- [ ] **Step 2: self-test 실행(dev 서버 켠 상태)**

```bash
cd ai-program-generator && node scripts/selftest-generate-examples.mjs
```
Expected: 엔드포인트 200 + `{made, exhausted}` 형태. made>0이면 그만큼 교육테스트에 새 auto-example-bot 게시물 생성 후 정리됨. 무료 소진 상태면 made=0·exhausted=true(정상).

- [ ] **Step 3: 프로덕션 빌드(dev 정지 후)**

```bash
cd ai-program-generator && npm run build
```
Expected: 타입체크 포함 빌드 성공(에러 0).

- [ ] **Step 4: 브라우저 확인(선택, made>0였을 때)**

dev에서 게시판 → 교육테스트 보드에 '보기 예시' 작성자 작품이 보이고 열람·포크되는지. (self-test가 정리하므로, 남겨 보고 싶으면 정리 전 확인.)

- [ ] **Step 5: PR + 트리거 안내**

```bash
git push -u origin feat/auto-examples
gh pr create --base main --title "feat(examples): 자동 예시 생성 루틴(교육테스트 보드)" --body "$(cat <<'EOF'
놀고 있는 Gemini 무료 한도로 예시 작품을 교육테스트 게시판에 자동 생성.

- app/api/cron/generate-examples: CRON_SECRET Bearer, maxDuration 60, MAX_PER_RUN 3, 429 시 exhausted
- lib/examples: randomPlan(서베이 랜덤)·generateExampleOnce(survey+메타)·publishExample(Admin SDK·검열네트)
- 게시물 ownerUid='auto-example-bot'·authorName='보기 예시'·교육테스트·공개. 스키마·규칙·배포 변경 없음
- 트리거는 코드 아님: Claude 루틴이 exhausted까지 반복 호출(daily-stats식)

검증: tsc + build + selftest-generate-examples.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL. **머지 후 사용자가 Claude 루틴 등록**(매일, 엔드포인트를 exhausted까지 최대 ~15회 반복 GET, Authorization: Bearer CRON_SECRET).

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** 엔드포인트(T3)·randomPlan(T1)·generateExampleOnce+publishExample(T2)·검증(T4)·검열네트(T2 publishExample)·카테고리 조회(T3)·exhausted(T3)·트리거(비코드, T4 안내) 모두 반영.
- **플레이스홀더:** 소스 4파일 전부 실제 코드. self-test는 "기존 selftest 패턴 + 명시 단계"로 지정(before/after diff 정리 구체).
- **타입 일관성:** `RandomPlan{type,answers,prompt,plan}` — T1 정의, T2 publishExample·generateExampleOnce·T3 route에서 일치. `generateExampleOnce(prompt):{code,meta}` / `publishExample(categoryId, rp, code, meta)` 시그니처가 T3 호출과 일치. `SYSTEM_PROMPTS['survey']`·`LOGIC_META_INSTRUCTION`·`adminDb`·`assertClean`·`UserFacingError`·`PROGRAM_TYPES` 모두 실제 export(확인됨).
- **주의:** dev/prod 공유 Firestore → self-test는 이 실행이 만든 new 게시물만 삭제(before/after diff). korcen(assertClean)이 Node에서 임포트·동작하는지 T2 구현 시 확인 — 실패하면 생성 안전계약 프롬프트가 1차 방어(스펙 명시).
