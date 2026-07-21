# 자동 예시 생성 루틴 (교육테스트 보드) 설계

**작성일:** 2026-07-21
**상태:** 승인 대기 → 구현 예정
**브랜치:** `feat/auto-examples`

## 목표

놀고 있는 Gemini 무료 할당량으로 예시 작품을 자동 생성해 **교육테스트** 게시판에 쌓는다. 서버 크론 엔드포인트가 서베이 랜덤 조합으로 계획을 만들어 Gemini로 생성하고, 성공분을 Admin SDK로 교육테스트 카테고리에 게시한다. 무료 한도(429)까지만 만들고 멈춘다.

## 핵심 제약 (설계를 좌우)

- **Vercel 함수 실행시간 제한**(Hobby 최대 60s). 건당 생성 ~10~20s → 한 요청에 소량(≤3건)만. 하루 무료 한도(~20~40건)를 소진하려면 **트리거(Claude 루틴)가 엔드포인트를 여러 번 반복 호출**한다.
- **무료 한도는 실사용과 공유** → 실제 사용자가 먼저 쓰면 루틴은 즉시 429로 아무것도 못 만들고 종료(자동 양보, 별도 로직 불필요).

## 비목표 (YAGNI)

- 누적 상한·오래된 예시 삭제/순환 — 안 함(사용자 결정: 상한 없이 쌓기).
- usage/stats 토큰 기록 — 안 함(무료 티어, 저가치). 필요 시 후속.
- 새 UI 없음. 새 Firestore 컬렉션·규칙 변경 없음(Admin SDK가 posts에 직접 쓰며 클라 규칙 우회).

## 아키텍처 / 흐름

```
Claude 스케줄 루틴(매일 1회) → 반복(최대 CALL_CAP회, exhausted까지):
    GET /api/cron/generate-examples (Authorization: Bearer CRON_SECRET)
      → '교육테스트' 카테고리 id 조회
      → 루프(최대 MAX_PER_RUN=3, 429/소진까지):
          randomPlan() → {type, answers, prompt, plan}
          → getAIProvider().generateStream({prompt, system, mode:'generate'}) 소비 → {code, meta}
          → 검열 네트(assertClean) → publishExample: Admin SDK posts/{id} 작성
      → { made, exhausted } 반환
    (exhausted=true면 루틴 반복 중단)
```

## 컴포넌트/파일별

### 1. 엔드포인트 `app/api/cron/generate-examples/route.ts`

- `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;`
- **CRON_SECRET Bearer 인증**(daily-stats와 동일): `authorization !== 'Bearer '+CRON_SECRET` → 401. 미설정 → 500.
- 교육테스트 카테고리 id 조회(§4). 없으면 200 `{ made:0, exhausted:true, error:'category-not-found' }` + 로그.
- 루프 `for (let i=0; i<MAX_PER_RUN; i++)`:
  - `const rp = randomPlan()` (§2)
  - 생성: `generateExampleOnce(rp.prompt)` (§3) → `{code, meta}`. 던지면:
    - 무료 소진(`UserFacingError`) 또는 429 → `exhausted=true`, 루프 종료.
    - 그 외(파싱·일시 오류) → 그 건 스킵하고 계속.
  - `await publishExample(categoryId, rp, code, meta)` (§5). 검열 거부/쓰기 실패도 스킵.
  - 성공 시 `made++`.
- 반환 `NextResponse.json({ made, exhausted })`.
- `MAX_PER_RUN = 3` 상수(튜닝 가능, maxDuration 안에 들도록).

### 2. 랜덤 계획 `lib/examples/randomPlan.ts`

```ts
export interface RandomPlan { type: ProgramType; answers: SurveyAnswers; prompt: string; plan: PlanFields; }
export function randomPlan(): RandomPlan
```
- `PROGRAMS`(lib/survey/programs index)에서 타입 랜덤 선택.
- 답 점진 구성(showIf 반영): 매 단계 `visibleSteps(type, answers)`를 다시 계산하며, 노출된 미답 단계에 대해 옵션을 랜덤 선택. multi 단계는 1~2개, 낮은 확률로 `AI_PICK`.
- `assemblePrompt(type, answers)` → prompt, `surveyToPlan(type, answers)` → plan.
- `Math.random()`은 앱 런타임이라 사용 가능(워크플로 스크립트 제약과 무관).

### 3. 서버 생성 `lib/examples/generateExampleOnce.ts`

```ts
export async function generateExampleOnce(prompt: string): Promise<{ code: GeneratedCode; meta: GenerationMeta }>
```
- system = `SURVEY_SYSTEM_PROMPT + LOGIC_META_INSTRUCTION`(/easy 생성과 동일 톤·교육메타). mode='generate', photo 없음.
- `getAIProvider().generateStream(input)`을 소비해 `done` 청크의 `{code, meta}` 반환(메타가 필요해 `.generate()` 대신 스트림 사용). signal 없음.
- 무료 소진 시 gemini.ts가 던지는 `UserFacingError`는 그대로 위로 전파(엔드포인트가 exhausted 처리).

### 4. 카테고리 조회

- `adminDb.collection('categories').where('name','==','교육테스트').limit(1).get()` → 첫 문서 id. 없으면 null.
- (이름 매칭. 카테고리명이 바뀌면 env `EXAMPLE_CATEGORY_ID`로 덮어쓰기 가능하게 옵션 — 우선 이름 매칭, env 있으면 env 우선.)

### 5. 서버 게시 `lib/examples/publishExample.ts` (Admin SDK)

```ts
export async function publishExample(categoryId: string, rp: RandomPlan, code: GeneratedCode, meta: GenerationMeta): Promise<void>
```
- `rp`(§2)는 `{ plan, prompt }`를 담아 게시 문서에 그대로 저장 — "계획서 보기"·편집·식별에 사용.
- **검열 네트**: `assertClean(rp.plan.name)` + `assertClean(rp.plan.etc)`(생성 계획 요약). 거부(ProfanityError)면 throw → 엔드포인트가 그 건 스킵. (자동생성이라 위험 낮지만 공개 노출 대비 안전망. korcen이 Node에서 임포트·동작하는지 구현 중 확인 — 실패 시 생성 안전계약 프롬프트가 1차 방어.)
- posts 문서(Admin SDK `add`):
  - `title = rp.plan.name` (buildName 결과)
  - `categoryId`, `boardTeacherUid: null`(공개)
  - `ownerUid: 'auto-example-bot'`(자동예시 식별 키 — 실사용자 마이페이지 미오염, admin이 이 uid로 일괄 정리 가능)
  - `authorName: '보기 예시'`(예약어 아님·검열 통과 상수)
  - `code`, `plan: rp.plan`, `prompt: rp.prompt`, `createdAt: Date.now()`
  - 생성 메타: `logicSummary`·`conceptTags`·`conceptNotes`(비어 있지 않을 때만)
- 카운터(like/view/fork)는 생략(기본 0 취급).

### 6. 트리거 (Claude 루틴)

- daily-stats 루틴과 동일 등록. 매일 1회 실행 시, 엔드포인트를 **`exhausted=true`가 나오거나 `CALL_CAP`(예: 15)회에 도달할 때까지 반복 GET**(짧은 간격). 이렇게 짧은 요청 여러 번으로 그날 무료 한도를 소진. `CRON_SECRET`은 루틴이 헤더로 전달.

## 엣지·안전

| 상황 | 처리 |
|---|---|
| 실사용자가 무료 한도 선점 | 첫 생성부터 429/소진 → made=0, exhausted=true, 루틴 즉시 중단(자동 양보) |
| 한 건 파싱/일시 오류 | 스킵하고 다음 건 계속(부분 성공) |
| 교육테스트 카테고리 없음 | no-op + 로그(오배포 안전) |
| 콘텐츠 안전 | 생성 안전계약 프롬프트(KID_CONTRACT) + 검열 네트. 교육테스트가 공개면 자동 게시물 공개 노출(사용자 선택). 문제 시 admin이 `ownerUid=='auto-example-bot'`로 일괄 삭제 |
| 비용 | 무료 티어 429까지 무료. maxOutputTokens(32768)로 건당 바운드 |

## 검증

- `./node_modules/.bin/tsc --noEmit` + `npm run build`.
- `scripts/selftest-generate-examples.mjs`(미커밋): dev 서버 + CRON_SECRET로 엔드포인트 1회 GET → 응답 `{made, exhausted}` 확인, 교육테스트에 예시 posts 생성됐는지 Admin SDK로 확인, 끝에서 `ownerUid=='auto-example-bot'` 시드 정리. (무료 한도 소진 상태면 made=0·exhausted=true가 정상 — 코드 결함 아님.)
- 브라우저: 게시판 교육테스트에 '보기 예시' 작성자 작품이 보이고 열람·포크되는지.

## 참고 기반

- `app/api/cron/daily-stats/route.ts`·`cleanup-previews`(CRON_SECRET Bearer 패턴), `lib/firebase/admin`(adminDb/adminAuth).
- `lib/survey/assemble.ts`(assemblePrompt·surveyToPlan·visibleSteps), `lib/survey/programs/index`(PROGRAMS), `lib/survey/types`(AI_PICK).
- `lib/ai/provider.getAIProvider`·`gemini`(generateStream·done 메타·429 폴백), `lib/ai/prompts`(SURVEY_SYSTEM_PROMPT·LOGIC_META_INSTRUCTION).
- `lib/moderation.assertClean`(검열 네트), `lib/firebase/types`(PlanFields·Post).
