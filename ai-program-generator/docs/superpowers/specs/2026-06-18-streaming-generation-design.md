# 스트리밍 생성 설계 (Streaming Generation)

**작성일:** 2026-06-18
**상태:** 승인됨 (브레인스토밍 합의)

## 목표 (Goal)

`/api/generate`의 코드 생성을 비스트리밍(`Promise<GeneratedCode>`)에서 **스트리밍**으로 전환해, 10~30초 대기 동안 **AI가 실제로 작업 중이라는 신호**를 실시간으로 제공한다. 생성기(고학년)는 코드가 써지는 모습을 라이브로 보여주고, easy 모드(저학년)는 코드 대신 진짜 진행 단계를 보여준다.

### 명시적 비목표 (Non-goals)
- **미리보기 라이브 렌더 아님.** 출력은 `{html, css, javascript}`가 서로 의존하는 단일 JSON이라, 스트리밍 중간의 반쪽 코드를 실행하면 깨진다(반쪽 HTML, 미도착/깨진 JS, 뒤늦은 CSS). **미리보기는 완성 시점에만 렌더한다.** 빨라지는 것은 *체감 속도*(실시간 활동 표시)이지 완료 시각이나 미리보기 등장 시점이 아니다.
- 토큰 절감이 목적이 아님(스트리밍은 토큰 수에 영향 없음). 단, "취소"가 가능해져 버려지는 생성의 잔여 출력 토큰을 아낄 수 있는 부수효과는 있음.
- 모델/프롬프트 변경 없음. `responseSchema` JSON 모드 유지.

## 핵심 결정 (브레인스토밍 합의)

1. **무엇을 보여줄지**: 생성기 = **개념 내레이션 + 읽기 좋은 구문강조 코드(하이브리드)** + 완성 시 미리보기. easy = 코드 미노출, 개념 진행 단계 신호.
2. **전송·파싱(접근법 ①)**: `@google/genai`의 `generateContentStream` + 자체 부분-JSON 파싱. 어댑터 경계·기존 폴백(flash→flash-lite)·503 재시도 보존, 의존성 최소.
3. **부분-JSON 파서**: 초경량 dep `best-effort-json-parser`(무 transitive) 사용.
4. **취소**: 기본 취소 버튼 포함(클라 abort → 서버 생성 중단 + 한도 환불).
5. **교육적 표시**: 도착 중인 필드(html→css→js)를 **3층 개념(구조·스타일·동작)**으로 친근하게 내레이션. 코드는 **구문강조**(색=의미)로 읽기 좋게. 코드 못 읽는 아이도 의미를 얻고, 읽는 아이는 더 배운다.

> 대안 ②(Vercel AI SDK streamObject)는 코드량은 적으나 새 의존성·검증된 폴백 재구현·마이그레이션 리스크로 기각. ③(마커 포맷)은 JSON 모드 신뢰성 포기라 기각.
> 표시 대안: 코드-위주(빠른 스크롤)는 저학년이 못 읽어 위압감·스펙터클에 그칠 위험으로 기각. 개념-위주(코드 접기)도 후보였으나, 하이브리드가 "탈신비화(진짜 코드)+개념 이해"를 모두 줘서 채택.

## 교육적 방향 (Educational rationale)

이 서비스는 **교육용**이며 1차 사용자는 **초등 저학년(7~10세, 읽기 느림)**([PRODUCT.md](../../../../PRODUCT.md)). 따라서 스트리밍은 "멋진 스펙터클"이 아니라 **학습 계기**여야 한다.

- **근거가 코드에 이미 있음**: 시스템 프롬프트가 "**사람이 읽고 배우기 좋게** 정돈된 코드"를 지시([prompts.ts](../../lib/ai/prompts.ts)) → 생성 코드는 '보고 배우는 대상'으로 의도됨.
- **교육 레버 = 3층 개념 매핑**: 스트리밍에서 어느 필드가 도착 중인지 알 수 있어, 코드를 **구조(HTML)·스타일(CSS)·동작(JS)** 3층으로 자연스럽게 풀어줄 수 있다. 이 모델은 진짜 CS 개념이면서 저학년도 이해 가능.

| 도착 중 필드 | 친근 내레이션(예) | 가르치는 개념 |
|---|---|---|
| `html` | "화면의 **뼈대**를 만들어요" | 구조 |
| `css` | "색과 모양으로 **꾸며요**" | 스타일 |
| `javascript` | "**규칙과 움직임**을 넣어요" | 동작 |

- **포용**: 코드를 못 읽는 아이도 내레이션으로 의미를 얻고, 읽는 아이는 구문강조 코드로 더 배운다. PRODUCT 원칙(큰 것이 친절·쉬운 말·결과물이 주인공)과 정렬.
- 이 내레이션 매핑은 **생성기(배너)와 easy(메인 신호)가 공유**한다(단일 소스).

## 아키텍처

### 1. AI 어댑터 계약 — `lib/ai/types.ts`
```ts
export type GenerationChunk =
  | { type: 'delta'; partial: Partial<GeneratedCode> }  // 지금까지 파싱된 부분 코드
  | { type: 'done'; code: GeneratedCode };               // 검증 통과한 최종 결과

export interface AIProvider {
  /** 점진 생성: 부분 코드를 delta로 흘리고, 마지막에 검증된 최종을 done으로 emit. */
  generateStream(input: GenerateInput): AsyncIterable<GenerationChunk>;
  /** 비스트리밍 편의: generateStream을 끝까지 소비해 최종만 반환(DRY, 하위호환). */
  generate(input: GenerateInput): Promise<GeneratedCode>;
}
```
제공자 교체점은 여전히 `lib/ai/provider.ts` 1곳. 검증·폴백·파싱은 전부 `gemini.ts` 내부.

### 2. 제공자 — `lib/ai/gemini.ts`
- `generateStream(input)`:
  1. **초기화에 폴백/재시도 적용**: `generateContentStream`(PRIMARY)을 `callWithRetry`(503 백오프)로 시작. 시작이 429(할당량)면 `FALLBACK_MODEL`로 재시도, 그것도 429면 기존 친근 메시지로 throw. (스트림은 첫 청크 전에 초기화 에러가 표면화되므로 폴백/재시도가 그대로 유효.)
  2. **청크 루프**: `for await (const chunk of stream)`로 `chunk.text` 누적 → `parsePartialCode(누적)` → 직전과 달라졌으면 `{ type: 'delta', partial }` yield.
  3. **종료**: 누적 전체를 **엄격 `JSON.parse` → `normalize` → 빈 html 검사**. 비었으면 throw(기존과 동일: 한도 환불 유도). 통과 시 `{ type: 'done', code }` yield.
- `generate(input)`: `generateStream`을 소비해 `done.code` 반환(없으면 throw). 기존 의미 보존.
- `parsePartialCode(raw: string): Partial<GeneratedCode>`: `best-effort-json-parser`로 누적 텍스트를 관용 파싱 → `{html?,css?,javascript?}` 추출(없는 필드는 생략). escape 중간끊김 안전 처리.
- **한계(문서화)**: 첫 delta 이후의 드문 중간 에러는 재시도 불가 → throw로 인스트림 에러 처리.

### 3. API 라우트 — `app/api/generate/route.ts`
- **유지**: Bearer 인증, 입력 검증, 한도 선점(트랜잭션), modify 프롬프트/exemplar 조립, KST 날짜 키.
- **변경**: 응답을 `ReadableStream`(NDJSON — 줄당 JSON 1개, `Content-Type: application/x-ndjson`, `Cache-Control: no-store`)으로.
  - `provider.generateStream(...)`을 `for await` 하며 `{"type":"delta","partial":{…}}\n` enqueue → 마지막 `{"type":"done","code":{…}}\n` 후 close.
- **에러 2층**:
  - *스트림 시작 전*(인증·검증·한도 초과): 기존처럼 상태코드 JSON 응답(401/400/429/500). 스트림을 열기 전에 모두 처리.
  - *생성 중*(200 헤더 송신 후): catch하여 `{"type":"error","error":"…"}\n` enqueue + **한도 환불**(`refundQuota`) + close. (200 이후 상태코드 변경 불가.)
- **취소**: `req.signal`(클라 연결 끊김) 감지 시 `for await` 중단 → 모델 스트림 종료 + **한도 환불**.

### 4. 클라이언트 전송 — `lib/client/generate.ts`
```ts
export async function requestGenerateStream(
  prompt: string, mode: GenerateMode, variant: SystemPromptVariant,
  opts: { onDelta: (partial: Partial<GeneratedCode>) => void; signal?: AbortSignal },
): Promise<GeneratedCode>
```
- 인증 토큰 첨부 + `signal` 전달. `res.body.getReader()`로 NDJSON 라인 파싱:
  - `delta` → `opts.onDelta(partial)`
  - `done` → 최종 `GeneratedCode` resolve
  - `error` → `Error(error)` throw
- **시작 전 비-200**: 기존처럼 JSON 에러 파싱해 throw(메시지 그대로 사용).
- 호출부 형태 유지: `const result = await requestGenerateStream(...)` + `onDelta` 콜백만 추가.
- 기존 `requestGenerate`는 호출부가 모두 스트리밍으로 이전하면 제거(미사용 시).

### 5. 생성기 UI — `components/creator/Creator.tsx` + `ResultPanel.tsx` (하이브리드: 개념 내레이션 + 구문강조 코드)
- 새 상태: `streamingPartial: Partial<GeneratedCode>`(라이브 표시용 부분 코드), `streamStage: 'html'|'css'|'javascript'|null`(현재 도착 중 필드).
- `handleGenerate`/`handleModify`: `requestGenerateStream(..., { onDelta, signal })`.
  - `onDelta(partial)` → `streamingPartial` 갱신 + 어느 필드가 막 늘어났는지로 `streamStage` 판정.
- **스트림 중 ResultPanel 표시(하이브리드)**:
  - **개념 내레이션 배너**(상단): `streamStage`를 `lib/ai/streamStages.ts`(공유)의 친근 문구로 — 구조/스타일/동작 3층(위 표). easy와 같은 소스.
  - **구문강조 코드**(아래): 도착분을 섹션(화면/꾸미기/움직임)으로 나눠 표시, 각 섹션은 해당 언어로 **구문강조**(markup/css/js). 누적 코드에 강조를 적용하되 **delta마다가 아니라 throttle(rAF/≈100ms)** 로 재강조해 jank 방지. 하단 자동 스크롤(추적).
  - 코드 가독성: 큰 모노스페이스, 차분한(브랜드 정렬) 라이트/다크 테마, 대비 ≥4.5:1(네온 dev 테마 금지 — DESIGN 정렬).
- `done` → `setCode(result)` + **'미리보기' 탭 전환** + `previewKey++` → 미리보기 렌더(기존 흐름, "결과물이 주인공").
- 가짜 회전 메시지(`GENERATE_MESSAGES`/`MODIFY_MESSAGES`)와 2.5초 타이머 제거(개념 내레이션+코드가 실제 진행). BuilderBot은 스트림 시작 직전 짧은 "시작 중"에만(또는 제거).
- generate·modify 동일(같은 `ResultPanel`).
- **취소 버튼**: 스트림 중 노출 → `AbortController.abort()` → 부분 결과 폐기, idle 복귀, 토스트("멈췄어요").

### 6. easy 모드 UI — `components/survey/SurveyWizard.tsx`
- 코드 미노출. `onDelta`의 `streamStage`를 **공유 `streamStages.ts`** 의 3단계 친근 문구로 매핑(생성기 배너와 동일 소스): 화면을 그려요 → 예쁘게 꾸며요 → 움직임을 넣어요.
  - **타이머가 아니라 진짜 도착 기반.** BuilderBot 유지.
- `done` → 미리보기.
- 취소: easy에도 동일 취소(단순화 가능).

## 데이터 흐름 (생성 1회)
```
[클라] 계획서 → requestGenerateStream(POST /api/generate, Bearer, signal)
[서버] 인증·검증·한도선점 → 200 + NDJSON 스트림 시작
        gemini.generateStream: generateContentStream(폴백/재시도) 
          → 청크 누적 → parsePartialCode → {type:delta,partial}  (반복)
          → 종료 시 엄격파싱·검증 → {type:done,code}
[클라] delta마다 onDelta(partial) → (생성기) 코드 라이브 / (easy) 진행단계
        done → 최종 code resolve → setCode → 미리보기 렌더
[에러] 시작 전: 상태코드 JSON / 생성 중: {type:error}+환불 / 취소: 중단+환불
```

## 의존성
- 추가: `best-effort-json-parser`(부분-JSON 파싱, 무 transitive, ~1KB).
- 추가: `prismjs`(구문강조 — `markup`/`css`/`javascript` 컴포넌트만, 차분한 라이트/다크 테마). 누적 코드에 **throttle 재강조**(rAF/≈100ms)로 jank 방지.

## 파일별 영향
| 파일 | 변경 |
|---|---|
| `lib/ai/types.ts` | `GenerationChunk` 타입 + `AIProvider.generateStream` 추가 |
| `lib/ai/gemini.ts` | `generateStream` 구현(스트림+폴백+부분파싱+최종검증), `generate`는 stream 소비로 |
| `lib/ai/provider.ts` | 변경 없음(계약만 넓어짐) — 확인만 |
| `lib/ai/streamStages.ts` | **신규** — 도착 필드(html/css/js)→3층 개념 친근 문구 매핑(생성기·easy 공유 단일 소스) |
| `app/api/generate/route.ts` | 응답을 NDJSON ReadableStream으로, 인스트림 에러·취소 환불 |
| `lib/client/generate.ts` | `requestGenerateStream` 추가, 기존 호출부 이전 |
| `components/creator/Creator.tsx` | 스트리밍 상태(`streamingPartial`/`streamStage`)·onDelta·취소·탭 전환 |
| `components/creator/ResultPanel.tsx` | 개념 내레이션 배너 + 구문강조 라이브 코드(throttle·자동 스크롤)·취소 버튼·busy UI |
| `components/survey/SurveyWizard.tsx` | 공유 `streamStages` 기반 3단계 진행 신호·취소 |
| `components/ui/CodeBlock.tsx`(또는 ResultPanel 내부) | **신규/확장** — Prism 구문강조 코드 표시(라이트/다크·대비) |
| `package.json` | `best-effort-json-parser`, `prismjs`(+타입) 추가 |

## 에러 처리 요약
- **시작 전**(인증/검증/한도): 상태코드 JSON(기존 동일).
- **생성 중**: `{type:error}` 인스트림 + 한도 환불. 클라는 토스트로 안내(부분 코드 폐기).
- **취소**: 클라 abort → 서버 중단 + 환불. 클라 idle 복귀.
- **빈 html**: 종료 검증에서 throw → 인스트림 에러 + 환불(기존 의미 보존).

## 검증 (테스트 프레임워크 없음)
- `./node_modules/.bin/tsc --noEmit` + `npm run build`(dev 정지 상태).
- self-test 스크립트(1회성, 기존 `selftest-*.mjs` 패턴): 커스텀토큰→ID토큰으로 스트리밍 `/api/generate` 호출 →
  **delta 다수 수신 후 done + 유효 `{html,css,javascript}`(html 비지 않음)** 단언, 빈 프롬프트 → 시작 전 400 단언. 실 Gemini 1~2회(유료키, 소량).
- 브라우저: ① 생성기 생성 → **개념 내레이션 배너(구조→스타일→동작) + 구문강조 코드 라이브** → 완성 시 미리보기, ② modify 동일, ③ easy에서 3단계 진행 문구 → 미리보기, ④ 취소 동작, ⑤ 라이트/다크에서 코드 대비·강조 확인.

## 엣지/주의
- NDJSON 라인 경계: 청크가 라인 중간에서 끊길 수 있으니 클라 파서는 버퍼링 후 `\n` 분리.
- 구문강조는 누적 코드 재강조라 **throttle 필수**(rAF/≈100ms); 미강조 텍스트를 먼저 그리고 강조는 따라붙어도 됨(점진적 향상).
- `previewKey` 증가로 iframe 재마운트(기존 패턴) — 완성 코드로만 1회.
- modify의 `genPrompt` 누적·40k 클램프(firestore.rules prompt 한도)는 기존 그대로.
- 첫 delta 이후 중간 에러는 재시도 불가(드묾) — 인스트림 에러로 처리.
- abort 시 한도 환불은 best-effort(연결 끊김 감지 실패 시 환불 누락 가능 — 허용 가능한 손실).
