# 개념별 "내 작품 예시" 노트(conceptNotes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개념 배지를 눌렀을 때, 그 개념이 이 프로그램에서 어떻게 쓰였는지 저학년 한 줄("이 작품에선: …")을 일반 정의 아래에 덧붙여 보여준다.

**Architecture:** Gemini 생성 시 `conceptNotes`(개념→한 줄 맵)를 기존 교육 메타(logicSummary/conceptTags/nextChallenge)와 함께 emit → 전송은 GenerationMeta 통째로 편승(변경 불필요) → 업로드 시 Post에 저장(빈값 생략, firestore.rules 검증) → ConceptBadges 팝오버에서 detectConcepts로 탐지된 개념에 노트가 있으면 표시. 기존 logicSummary 경로를 그대로 따른다.

**Tech Stack:** Next.js 15(App Router) · Firebase(Firestore/Auth) · @google/genai(Gemini) · TypeScript · Tailwind v4.

## Global Constraints

- **테스트 프레임워크 없음.** 검증 = `./node_modules/.bin/tsc --noEmit`(dev 서버 실행 중 안전) + `npm run build`(dev 정지 후) + `scripts/selftest-*.mjs` + 브라우저. `npx tsc` 금지(다른 cwd에 가짜 패키지 설치).
- **firestore.rules는 반드시 client SDK로 검증**(Admin SDK는 규칙 우회). 규칙 변경 시 `firebase deploy --only firestore:rules`(프로젝트 test-ai-builder) 후 self-test.
- **self-test는 커밋하지 않는 일회성 스크립트**(git `??`로 남김). 끝에서 시드 정리. dev 서버 필요한 것은 명시.
- 모든 사용자 노출 한국어는 **초등 저학년(7~10세) 쉬운 말·짧게**.
- `detectConcepts(code)`가 배지 표시의 **진실원천**. conceptNotes는 표시를 결정하지 않고, 탐지된 개념에 대해서만 보조 표시.
- conceptNotes 값 상한 **60자**(스키마 파싱 절단 = 규칙 = 일관). 프롬프트는 ~30자 요청(더 짧게 유도).
- 작업 브랜치 **`feat/concept-notes`**(main에서 분기). 커밋은 각 태스크 끝에서.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/ai/types.ts` | AI 계약 | `GenerationMeta.conceptNotes` 추가 |
| `lib/ai/gemini.ts` | Gemini 스키마·파싱 | `RESPONSE_SCHEMA.conceptNotes` + 파싱(60자 절단) |
| `lib/ai/prompts.ts` | 시스템 프롬프트 | `LOGIC_META_INSTRUCTION`에 conceptNotes 지시 |
| `lib/firebase/types.ts` | 게시물 타입 | `Post.conceptNotes?` 추가 |
| `firestore.rules` | 게시물 검증 | `validPost` 화이트리스트 + map 검증 |
| `components/board/UploadDialog.tsx` | 업로드→NewPost | conceptNotes prop + NewPost 빈값 생략 |
| `components/creator/Creator.tsx` | 생성 화면 상태 | meta.conceptNotes를 ResultPanel·UploadDialog에 전달 |
| `components/creator/ResultPanel.tsx` | 라이브 결과 | prop + LogicCard 전달 |
| `components/board/PostPreview.tsx` | 게시판 상세 | post.conceptNotes → LogicCard |
| `components/common/LogicCard.tsx` | 로직 카드 | conceptNotes prop → ConceptBadges |
| `components/common/ConceptBadges.tsx` | 개념 배지 | notes prop + "이 작품에선:" 렌더 |
| `scripts/selftest-conceptnotes.mjs` | 검증(미커밋) | 생성 형태 + client SDK 규칙 |

전송 계층(`app/api/generate/route.ts`, `lib/client/generate.ts`)은 GenerationMeta를 통째로 전달하므로 **변경 없음**.

---

## Task 0: 브랜치 생성 + 스펙·플랜 커밋

**Files:**
- Git only.

- [ ] **Step 1: main에서 feat 브랜치 생성**

현재 워킹트리에 이번 세션의 무관한 변경(스크린샷·스크립트 등)이 있으므로, 그것들은 건드리지 말고 브랜치만 만든다.

```bash
cd ai-program-generator
git checkout -b feat/concept-notes
```

Expected: `Switched to a new branch 'feat/concept-notes'` (working tree의 미커밋 변경은 그대로 따라옴).

- [ ] **Step 2: 스펙·플랜만 스테이징해서 커밋**

```bash
git add docs/superpowers/specs/2026-07-10-concept-notes-design.md docs/superpowers/plans/2026-07-10-concept-notes.md
git commit -m "docs(edu): conceptNotes(개념별 내 작품 예시) 설계·플랜"
```

Expected: 2 files changed. 다른 미커밋 파일은 스테이징하지 않는다.

---

## Task 1: 생성 — conceptNotes 데이터 계약·스키마·파싱·프롬프트

**Files:**
- Modify: `lib/ai/types.ts` (GenerationMeta)
- Modify: `lib/ai/gemini.ts:15-28` (RESPONSE_SCHEMA), `lib/ai/gemini.ts:96-104` (meta 파싱)
- Modify: `lib/ai/prompts.ts:87-97` (LOGIC_META_INSTRUCTION)

**Interfaces:**
- Produces: `GenerationMeta.conceptNotes: Record<string, string>` — 키 ⊆ `['순서','조건','반복','입력','출력']`, 각 값 trim·≤60자, 빈값 없음. 미측정 시 `{}`.

- [ ] **Step 1: GenerationMeta에 conceptNotes 추가**

`lib/ai/types.ts`의 `GenerationMeta`에서 `nextChallenge` 아래에 추가:

```ts
  /** 교육(#6) — 다음에 키워볼 도전 한 문장(저장 안 함, 고치기 칸 힌트로만). */
  nextChallenge: string;
  /** 개념별 '내 작품 예시' 한 줄 — 키 ⊆ ['순서','조건','반복','입력','출력'], 각 값 ≤60자. 미측정 시 {}. */
  conceptNotes: Record<string, string>;
```

- [ ] **Step 2: RESPONSE_SCHEMA에 conceptNotes OBJECT 추가**

`lib/ai/gemini.ts`의 `RESPONSE_SCHEMA`에서 `nextChallenge` 프로퍼티 아래에 추가하고, `required`에 `'conceptNotes'`를 넣는다:

```ts
    // 교육(#6) — 다음 도전 한 문장(저장 안 함, 고치기 칸 힌트).
    nextChallenge: { type: Type.STRING },
    // 개념별 '내 작품 예시' 한 줄(하이브리드 C). 미사용 개념은 빈 문자열.
    conceptNotes: {
      type: Type.OBJECT,
      properties: {
        순서: { type: Type.STRING },
        조건: { type: Type.STRING },
        반복: { type: Type.STRING },
        입력: { type: Type.STRING },
        출력: { type: Type.STRING },
      },
    },
  },
  required: ['html', 'css', 'javascript', 'logicSummary', 'conceptTags', 'nextChallenge', 'conceptNotes'],
};
```

- [ ] **Step 3: meta 파싱에 conceptNotes 구성 추가**

`lib/ai/gemini.ts`의 `const meta = { ... }`에서 `nextChallenge` 줄 아래에 추가(기존 CONCEPT_SET 상수 재사용):

```ts
      nextChallenge: typeof p.nextChallenge === 'string' ? p.nextChallenge.trim().slice(0, 120) : '',
      // 개념별 예시: CONCEPT_SET 키만, 값 trim·60자 절단, 빈값 제외(규칙 ≤60과 일치).
      conceptNotes:
        p.conceptNotes && typeof p.conceptNotes === 'object' && !Array.isArray(p.conceptNotes)
          ? Object.fromEntries(
              CONCEPT_SET.filter((k) => {
                const v = (p.conceptNotes as Record<string, unknown>)[k];
                return typeof v === 'string' && v.trim().length > 0;
              }).map((k) => [k, (p.conceptNotes as Record<string, string>)[k].trim().slice(0, 60)]),
            )
          : {},
```

- [ ] **Step 4: LOGIC_META_INSTRUCTION에 conceptNotes 지시 추가**

`lib/ai/prompts.ts`의 `LOGIC_META_INSTRUCTION` 끝(nextChallenge 항목 뒤)에 항목 추가:

```ts
- nextChallenge: 지금 프로그램을 한 단계 더 키울 '다음 도전'을 초등 저학년 눈높이의 짧은 한 문장으로. 아이가 바로 시도할 만큼 작고 구체적이며, 이 프로그램에 딱 맞는 것으로. "~해보면 어때요?" 형태, 40자 이내. 코드/기술 용어 금지.
- conceptNotes: conceptTags에 넣은 **각 개념**에 대해, '이 프로그램에서 그 개념이 어떻게 쓰였는지'를 초등 저학년 말투로 아주 짧게 한 구절만 적으세요(예: 조건="버튼을 누르면 돌아가요", 입력="버튼을 눌러요", 출력="뽑힌 것을 보여줘요"). 키는 ["순서","조건","반복","입력","출력"] 중 **실제 사용해 conceptTags에 넣은 것만**, 각 값은 30자 이내의 짧은 구절. 사용하지 않은 개념은 빈 문자열로 두세요. 코드/기술 용어 금지.`;
```

- [ ] **Step 5: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 없음(종료 코드 0). GenerationMeta에 필수 필드가 늘었지만 생성처는 gemini.ts 한 곳이라 여기서 채우므로 통과.

- [ ] **Step 6: 커밋**

```bash
git add lib/ai/types.ts lib/ai/gemini.ts lib/ai/prompts.ts
git commit -m "feat(edu): conceptNotes 생성 — 스키마·파싱(60자)·프롬프트 지시"
```

---

## Task 2: firestore.rules — conceptNotes 검증 + 배포 + 규칙 self-test

**Files:**
- Modify: `firestore.rules:59` (validPost hasOnly), `firestore.rules:82` (검증절)
- Create: `scripts/selftest-conceptnotes-rules.mjs` (미커밋)

**Interfaces:**
- Produces: 게시물 문서에 `conceptNotes` 맵 허용 — 키 ⊆ 5개념, 각 값 string·≤60자. 미포함도 허용. 위반 시 create 거부.

- [ ] **Step 1: validPost hasOnly에 conceptNotes 추가**

`firestore.rules`의 `validPost`의 `d.keys().hasOnly([...])` 배열 끝(`'logicLine'` 뒤)에 `'conceptNotes'` 추가:

```
      return d.keys().hasOnly(['title', 'categoryId', 'ownerUid', 'authorName', 'code', 'plan', 'prompt', 'createdAt', 'updatedAt', 'forkedFrom', 'forkedFromAuthor', 'boardTeacherUid', 'photo', 'logicSummary', 'conceptTags', 'logicLine', 'conceptNotes'])
```

- [ ] **Step 2: 검증절 추가**

`firestore.rules`의 `validPost`에서 logicLine 줄을 아래처럼 바꾼다(끝 `;`를 conceptNotes 블록으로 이동):

```
        // 교육(#8) — 아이가 직접 쓴 핵심 한 줄(옵셔널, 한 줄 분량 제한).
        && (!('logicLine' in d) || (d.logicLine is string && d.logicLine.size() <= 200))
        // 개념별 '내 작품 예시'(옵셔널) — 키 ⊆ 5개념, 각 값 string·≤60자.
        && (!('conceptNotes' in d) || (
             d.conceptNotes is map
             && d.conceptNotes.keys().hasOnly(['순서','조건','반복','입력','출력'])
             && (!('순서' in d.conceptNotes) || (d.conceptNotes['순서'] is string && d.conceptNotes['순서'].size() <= 60))
             && (!('조건' in d.conceptNotes) || (d.conceptNotes['조건'] is string && d.conceptNotes['조건'].size() <= 60))
             && (!('반복' in d.conceptNotes) || (d.conceptNotes['반복'] is string && d.conceptNotes['반복'].size() <= 60))
             && (!('입력' in d.conceptNotes) || (d.conceptNotes['입력'] is string && d.conceptNotes['입력'].size() <= 60))
             && (!('출력' in d.conceptNotes) || (d.conceptNotes['출력'] is string && d.conceptNotes['출력'].size() <= 60))
           ));
```

- [ ] **Step 3: 규칙 배포**

```bash
cd ai-program-generator && firebase deploy --only firestore:rules
```
Expected: `✔  Deploy complete!` / `firestore: released rules ...`.

- [ ] **Step 4: 규칙 self-test 작성(client SDK)**

`scripts/selftest-conceptnotes-rules.mjs` 생성. **기존 `scripts/selftest-edu-logic-meta.mjs`의 게시물-생성 셋업(admin custom token → ID token → App Check 디버그 → 카테고리/보드 조건 충족한 post create)을 그대로 베이스로 삼고**, `conceptNotes` 케이스만 바꿔 검증한다. App Check 디버그 토큰 초기화는 `scripts/shoot-required.mjs`의 `signIn` 패턴과 동일(dev `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` + `initializeAppCheck`). 검증 케이스:

```
// 통과해야 하는 것들:
//  - conceptNotes 없음(미포함)                → create 성공
//  - { 조건: "버튼을 누르면 돌아가요" }          → 성공
//  - { 순서:"..", 조건:"..", 반복:"..", 입력:"..", 출력:".." } (각 ≤60) → 성공
// 거부해야 하는 것들:
//  - { 알수없는키: "x" }                       → 거부 (hasOnly 위반)
//  - { 조건: 61자 문자열 }                      → 거부 (size 초과)
//  - { 조건: 123 }  (문자열 아님)               → 거부 (is string 위반)
// 각 케이스는 client SDK addDoc이 성공/‘permission-denied’로 갈리는지로 판정.
// 끝에서 생성된 성공 문서·시드는 정리(delete).
```

- [ ] **Step 5: 규칙 self-test 실행**

```bash
cd ai-program-generator && node scripts/selftest-conceptnotes-rules.mjs
```
Expected: 모든 통과 케이스 성공, 모든 거부 케이스 `permission-denied`. 최종 요약 `N/0` 형태로 실패 0.

- [ ] **Step 6: 커밋(규칙만 — self-test는 미커밋 유지)**

```bash
git add firestore.rules
git commit -m "feat(edu): firestore.rules — conceptNotes 맵 검증(키·60자)"
```

---

## Task 3: 저장 경로 — Post 타입 + Creator→UploadDialog + NewPost 빈값 생략

**Files:**
- Modify: `lib/firebase/types.ts:56` (Post)
- Modify: `components/board/UploadDialog.tsx:36-41` (props), `:173-175` (NewPost 조립)
- Modify: `components/creator/Creator.tsx:472-473` (UploadDialog에 전달)

**Interfaces:**
- Consumes: `GenerationMeta.conceptNotes`(Task 1) via Creator `meta` 상태.
- Produces: `Post.conceptNotes?: Record<string, string>` — 비어 있지 않을 때만 문서에 기록.

- [ ] **Step 1: Post 타입에 conceptNotes 추가**

`lib/firebase/types.ts`의 `Post`에서 `logicLine` 아래(또는 conceptTags 근처)에 추가:

```ts
  /** 교육 메타(Phase 0) — 사용한 컴퓨팅 개념 태그(순서·조건·반복·입력·출력 부분집합). */
  conceptTags?: string[];
  /** 개념별 '내 작품 예시' 한 줄(순서·조건·반복·입력·출력 부분집합). 생성 시 AI가 채움. 구버전/미측정/빈값 글엔 없음. */
  conceptNotes?: Record<string, string>;
```

- [ ] **Step 2: UploadDialog에 conceptNotes prop 추가**

`components/board/UploadDialog.tsx` Props 타입에 추가(logicSummary/conceptTags 옆):

```ts
  logicSummary?: string;
  conceptTags?: string[];
  conceptNotes?: Record<string, string>;
```

그리고 함수 시그니처 구조분해(line 41)에 `conceptNotes` 추가:

```ts
export default function UploadDialog({ open, onClose, code, plan, prompt, defaultTitle, forkedFrom, forkedFromAuthor, defaultCategoryId, photo, logicSummary, conceptTags, conceptNotes }: Props) {
```

- [ ] **Step 3: NewPost 조립에 빈값 생략으로 포함**

`components/board/UploadDialog.tsx`의 NewPost 조립부(line 173-175 근처)에서 conceptTags 아래에 추가:

```ts
        ...(logicSummary ? { logicSummary } : {}),
        ...(conceptTags && conceptTags.length ? { conceptTags } : {}),
        ...(conceptNotes && Object.keys(conceptNotes).length ? { conceptNotes } : {}),
        ...(logicLine.trim() ? { logicLine: logicLine.trim() } : {}),
```

- [ ] **Step 4: Creator에서 UploadDialog로 전달**

`components/creator/Creator.tsx`의 UploadDialog 렌더(line 472-473 근처)에서 conceptTags 옆에 추가:

```tsx
        logicSummary={meta?.logicSummary}
        conceptTags={meta?.conceptTags}
        conceptNotes={meta?.conceptNotes}
```

- [ ] **Step 5: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add lib/firebase/types.ts components/board/UploadDialog.tsx components/creator/Creator.tsx
git commit -m "feat(edu): conceptNotes 저장 경로 — Post 타입·업로드 조립(빈값 생략)"
```

---

## Task 4: 렌더 — ConceptBadges "이 작품에선:" + LogicCard/ResultPanel/PostPreview 배선

**Files:**
- Modify: `components/common/ConceptBadges.tsx:11`, `:39-46` (notes prop + 팝오버)
- Modify: `components/common/LogicCard.tsx:22-34`, `:60` (conceptNotes prop → ConceptBadges)
- Modify: `components/creator/ResultPanel.tsx:48-50`, `:82-83`, `:218` (prop → LogicCard)
- Modify: `components/creator/Creator.tsx:454-456` (ResultPanel에 전달)
- Modify: `components/board/PostPreview.tsx:236` (post.conceptNotes → LogicCard)

**Interfaces:**
- Consumes: `Post.conceptNotes`(Task 3), `GenerationMeta.conceptNotes`(Task 1).
- Produces: 배지 클릭 팝오버에 정의 + (탐지된 개념에 노트 있으면) "이 작품에선: {노트}".

- [ ] **Step 1: ConceptBadges에 notes prop + 팝오버 렌더**

`components/common/ConceptBadges.tsx` 시그니처에 `notes` 추가:

```tsx
export default function ConceptBadges({ tags, notes, className = '' }: { tags?: string[]; notes?: Record<string, string>; className?: string }) {
```

팝오버 블록(line 39-46)을 정의 + 예시 2단으로 교체:

```tsx
      {openMeta && (
        <div
          role="note"
          className={`anim-pop-in mt-2 rounded-[var(--r-md)] px-3 py-2 text-[13.5px] leading-relaxed ${openMeta.soft}`}
        >
          <p>
            <strong>{openMeta.label}</strong> — {openMeta.desc}
          </p>
          {open && notes?.[open] && (
            <p className="mt-1.5 border-t border-current/15 pt-1.5 text-[13px]">
              <span className="opacity-70">이 작품에선:</span> {notes[open]}
            </p>
          )}
        </div>
      )}
```

- [ ] **Step 2: LogicCard에 conceptNotes prop 추가·전달**

`components/common/LogicCard.tsx` props(line 22-34)에 추가:

```tsx
export default function LogicCard({
  logicSummary,
  conceptTags,
  conceptNotes,
  code,
  className = '',
}: {
  logicSummary?: string;
  conceptTags?: string[];
  conceptNotes?: Record<string, string>;
  code?: GeneratedCode;
  className?: string;
}) {
```

ConceptBadges 렌더(line 60)에 notes 전달:

```tsx
      {hasConcepts && <ConceptBadges tags={tags} notes={conceptNotes} className="mt-2.5" />}
```

- [ ] **Step 3: ResultPanel에 conceptNotes prop 추가·전달**

`components/creator/ResultPanel.tsx` props 타입(line 48-50)에 `conceptNotes?: Record<string, string>;` 추가, 구조분해(line 82-83)에 `conceptNotes,` 추가, LogicCard 렌더(line 218)를:

```tsx
          <LogicCard logicSummary={logicSummary} conceptTags={conceptTags} conceptNotes={conceptNotes} code={code} />
```

- [ ] **Step 4: Creator에서 ResultPanel로 전달**

`components/creator/Creator.tsx`의 ResultPanel 렌더(line 454-456)에서 conceptTags 옆에 추가:

```tsx
        logicSummary={meta?.logicSummary}
        conceptTags={meta?.conceptTags}
        nextChallenge={meta?.nextChallenge}
        conceptNotes={meta?.conceptNotes}
```

- [ ] **Step 5: PostPreview에서 LogicCard로 전달**

`components/board/PostPreview.tsx` line 236을:

```tsx
      <LogicCard logicSummary={post.logicSummary} conceptTags={post.conceptTags} conceptNotes={post.conceptNotes} code={post.code} />
```

- [ ] **Step 6: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add components/common/ConceptBadges.tsx components/common/LogicCard.tsx components/creator/ResultPanel.tsx components/creator/Creator.tsx components/board/PostPreview.tsx
git commit -m "feat(edu): conceptNotes 렌더 — 배지 '이 작품에선:' + 라이브·게시판 배선"
```

---

## Task 5: 엔드투엔드 검증(생성 형태 self-test + 빌드 + 브라우저)

**Files:**
- Create: `scripts/selftest-conceptnotes.mjs` (미커밋)

- [ ] **Step 1: 생성 형태 self-test 작성**

`scripts/selftest-conceptnotes.mjs` 생성. **기존 `scripts/selftest-edu-logic-meta.mjs`의 /api/generate 호출 셋업(admin ID 토큰 + App Check 디버그 헤더)을 베이스로**, 응답 스트림의 `done.meta.conceptNotes`에 대해 검증:

```
// dev 서버 필요. 돌림판/뽑기 같은 계획으로 생성 요청 →
//  - meta.conceptNotes 는 객체(map)
//  - 모든 키 ∈ ['순서','조건','반복','입력','출력']
//  - 모든 값 typeof string && length <= 60 && trim 비어있지 않음
//  - 최소 1개 이상 키 존재(권장, 실패해도 경고만 — 모델 편차)
// 결과 N/0 요약.
```

- [ ] **Step 2: 생성 형태 self-test 실행(dev 서버 켠 상태)**

```bash
cd ai-program-generator && node scripts/selftest-conceptnotes.mjs
```
Expected: conceptNotes 형태 검증 통과(키·60자·문자열). 키가 0개면 경고만.

- [ ] **Step 3: 프로덕션 빌드(dev 정지 후)**

dev 서버를 멈춘 뒤:

```bash
cd ai-program-generator && npm run build
```
Expected: 타입체크 포함 빌드 성공(에러 0).

- [ ] **Step 4: 브라우저 확인**

dev 서버로 ⓐ /create에서 돌림판·뽑기류 하나 생성 → 결과의 개념 배지 클릭 → 정의 아래 "이 작품에선: …" 노출 확인. ⓑ 그 작품을 게시판에 업로드 → 게시판 상세에서 같은 배지 클릭 시 노출 확인. ⓒ 노트 없는 구버전 글(예: 기존 게시물)은 정의만 나오는지 확인.

Expected: 탐지된 개념 배지에 예시 한 줄이 붙고, 노트 없는 글/개념은 정의만.

- [ ] **Step 5: PR 생성**

```bash
git push -u origin feat/concept-notes
gh pr create --base main --title "feat(edu): 개념별 '내 작품 예시' 노트(conceptNotes)" --body "$(cat <<'EOF'
개념 배지 클릭 시 일반 정의 아래에 '이 작품에선: …' 한 줄(그 프로그램에서 개념이 쓰인 방식)을 덧붙인다(하이브리드 C).

- Gemini 생성 메타에 conceptNotes(개념→한 줄) 추가, 60자 절단
- firestore.rules validPost에 map 검증(키 ⊆ 5개념, 각 ≤60자) + 배포
- ConceptBadges 팝오버에 정의 + 예시 2단, detectConcepts 탐지 개념에만 표시
- 저장 빈값 생략, 구버전/미탐지 글은 정의만(폴백)

검증: tsc + build + selftest-conceptnotes(생성 형태)·selftest-conceptnotes-rules(client SDK 규칙) + 브라우저.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL 출력.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지:** 스키마(T1)·rules(T2)·저장(T3)·렌더(T4)·검증(T5)·프롬프트(T1 S4)·엣지(폴백=T4 렌더의 `notes?.[open]` 가드 + 빈값 생략 T3) 모두 태스크 있음. staleness는 비목표(변경 없음)라 태스크 없음 — 의도적.
- **플레이스홀더:** 소스 변경은 모두 실제 코드 제시. self-test 2종은 "기존 selftest 베이스 + 명시된 케이스"로 지정(하니스 재현 대신 기존 파일 재사용 — DRY). 케이스 목록은 구체.
- **타입 일관성:** `conceptNotes: Record<string,string>` — GenerationMeta(필수)·Post(옵셔널)·UploadDialog/ResultPanel/LogicCard prop(옵셔널)·ConceptBadges `notes`(옵셔널) 시그니처 일관. 60자 상한: 파싱(T1 S3)·rules(T2 S2)·self-test(T2 S4, T5 S1) 일치. CONCEPT_SET(gemini.ts:30) 재사용.
- **주의:** Gemini responseSchema의 한글 프로퍼티명 리스크 — 스펙의 폴백(영문키+매핑) 참고. T1 S2 구현 시 한글키로 먼저 시도하고, self-test(T5)에서 conceptNotes가 비어만 나오면 영문키로 전환.
