# 개념별 "내 작품 예시" 노트(conceptNotes) 설계

**작성일:** 2026-07-10
**상태:** 승인 대기 → 구현 예정
**브랜치(예정):** `feat/concept-notes`

## 목표

개념 배지(순서·조건·반복·입력·출력)를 눌렀을 때 나오는 설명에, **그 개념이 이 프로그램에서 실제로 어떻게 쓰였는지** 저학년 말투 한 줄을 덧붙인다. 개념의 일반 정의(전이 가능한 지식)는 그대로 두고, 그 아래 "이 작품에선: …" 형태로 구체 예시(내 작품과의 연결)를 더하는 **하이브리드**다.

예) 돌림판 룰렛 → `조건` 배지 클릭 시:
> **조건** — '만약 ~하면 ~해요'처럼, 상황에 따라 다른 일이 일어나요.
> 이 작품에선: 버튼을 누르면 돌림판이 돌아가요.

## 교육적 근거

- 개념의 **일반 정의**는 다음 프로그램에서도 개념을 알아보게 하는 전이(transfer)의 핵심 → 반드시 유지.
- **구체 예시**(내 작품)는 추상 정의를 이해·동기화하는 앵커.
- 여러 작품에서 "변하지 않는 정의 + 바뀌는 예시"가 반복되는 것이 개념 일반화(추상화)의 메커니즘. 그래서 정의를 **대체**하지 않고 **병기**한다.

## 비목표 (YAGNI)

- 고치기(수정) 후 저장본 노트 갱신 — 안 함(아래 staleness 참고).
- 구버전 글 마이그레이션·백필 — 안 함.
- 상시 노출/발견성 강화 — 안 함. **클릭 시에만** 표시(사용자 결정). logicSummary가 이미 상시 노출돼 프로그램별 설명 니즈를 일부 충족.
- 신규 검열 경로 — 안 함(logicSummary와 동일 위험군, 기존 생성 안전 시스템프롬프트로 커버).

## 저장 형태 결정

**맵(map)** `conceptNotes: { 개념: 노트 }` 채택.

- 병렬 배열(conceptTags와 인덱스 매칭): 진실원천은 `detectConcepts`라 `conceptTags`와 어긋나면 정렬이 깨짐 → 탈락.
- JSON 문자열: 불투명·타입 안전성 저하 → 탈락.
- 맵: `conceptNotes[개념]` 단순 조회, Gemini responseSchema OBJECT로 자연 생성. 규칙 검증만 약간 장황(수용).

## 아키텍처 / 데이터 흐름

```
Gemini 생성(RESPONSE_SCHEMA.conceptNotes OBJECT)
  → gemini.ts 파싱: CONCEPT_SET 키만, 값 trim().slice(0,60), 빈값 제외
  → GenerationMeta.conceptNotes (Record<string,string>)
  → (라이브) ResultPanel → LogicCard → ConceptBadges "이 작품에선:"
  → (업로드) UploadDialog → createPost → Post.conceptNotes (Firestore, 규칙 검증)
  → (게시판/공유) PostPreview → LogicCard → ConceptBadges "이 작품에선:"
```

배지에 표시할 개념은 언제나 `detectConcepts(code)`(진실원천). 노트는 **탐지된 개념 ∩ 노트 존재**일 때만 표시.

## 컴포넌트/파일별 변경

### 1. 데이터 계약

- **`lib/ai/types.ts`** — `GenerationMeta`에 `conceptNotes: Record<string, string>` 추가(필수 필드, 없으면 `{}`).
- **`lib/firebase/types.ts`** — `Post`에 `conceptNotes?: Record<string, string>` 추가(옵셔널; 구버전/미측정 글엔 없음).

### 2. 생성(`lib/ai/gemini.ts`)

- `RESPONSE_SCHEMA.properties`에 `conceptNotes` 추가:
  ```ts
  conceptNotes: {
    type: Type.OBJECT,
    properties: {
      순서: { type: Type.STRING }, 조건: { type: Type.STRING },
      반복: { type: Type.STRING }, 입력: { type: Type.STRING }, 출력: { type: Type.STRING },
    },
  }
  ```
  `required` 배열에 `'conceptNotes'` 추가(형제 필드와 동일하게 필수).
  - 한글 프로퍼티명이 SDK에서 문제되면(폴백): 영문 키(sequence/condition/loop/input/output)로 스키마 정의 후 gemini.ts에서 한글 개념키로 매핑. 1차는 한글 키로 시도(conceptTags가 한글 값을 이미 정상 반환하므로 무방할 가능성 높음).
- 파싱: `meta.conceptNotes`를 아래로 구성 —
  ```ts
  conceptNotes: (p.conceptNotes && typeof p.conceptNotes === 'object')
    ? Object.fromEntries(
        CONCEPT_SET
          .filter((k) => typeof (p.conceptNotes as Record<string, unknown>)[k] === 'string'
                      && ((p.conceptNotes as Record<string, string>)[k]).trim())
          .map((k) => [k, (p.conceptNotes as Record<string, string>)[k].trim().slice(0, 60)])
      )
    : {}
  ```

### 3. 생성 프롬프트(`lib/creator/prompts.ts`)

- 시스템 프롬프트에 지시 추가(요지): "사용한 각 개념에 대해, **이 프로그램에서 그 개념이 어떻게 쓰였는지** 저학년 말투로 아주 짧게(한 구절, 예: '버튼을 누르면 돌아가요') `conceptNotes`에 적어라. 사용하지 않은 개념은 비워라(빈 문자열)." generate·modify 두 variant 모두.

### 4. 저장(`components/creator/*`, `components/board/UploadDialog.tsx`, `lib/firebase/posts.ts`)

- 생성 meta의 `conceptNotes`를 Creator 상태에 보관(logicSummary/conceptTags와 같은 경로).
- `NewPost` 구성 시 `conceptNotes`가 **비어 있지 않을 때만** 포함(빈 맵은 생략해 문서·규칙 단순화 — 다른 옵셔널과 동일 관례).
- `createPost`가 존재 시 그대로 기록.

### 5. firestore.rules (배포 필요)

- `validPost`의 `hasOnly([...])`에 `'conceptNotes'` 추가.
- 검증절 추가:
  ```
  && (!('conceptNotes' in d) || (
       d.conceptNotes is map
       && d.conceptNotes.keys().hasOnly(['순서','조건','반복','입력','출력'])
       && (!('순서' in d.conceptNotes) || (d.conceptNotes['순서'] is string && d.conceptNotes['순서'].size() <= 60))
       && (!('조건' in d.conceptNotes) || (d.conceptNotes['조건'] is string && d.conceptNotes['조건'].size() <= 60))
       && (!('반복' in d.conceptNotes) || (d.conceptNotes['반복'] is string && d.conceptNotes['반복'].size() <= 60))
       && (!('입력' in d.conceptNotes) || (d.conceptNotes['입력'] is string && d.conceptNotes['입력'].size() <= 60))
       && (!('출력' in d.conceptNotes) || (d.conceptNotes['출력'] is string && d.conceptNotes['출력'].size() <= 60))
     ))
  ```
- update 규칙은 손대지 않음(메타는 create 전용 유지).
- `firebase deploy --only firestore:rules` 후 client SDK self-test.

### 6. 렌더(`components/common/ConceptBadges.tsx`, `LogicCard.tsx`)

- `ConceptBadges`에 `notes?: Record<string, string>` prop 추가. 팝오버 렌더 시, 열린 개념 `open`에 대해 `notes?.[open]`이 있으면 정의 아래에 구분된 한 줄 추가:
  ```tsx
  {note && (
    <span className="mt-1.5 block border-t border-current/15 pt-1.5 text-[13px]">
      <span className="opacity-70">이 작품에선:</span> {note}
    </span>
  )}
  ```
  (정의와 시각적으로 분리, 저학년 부담 최소화)
- `LogicCard`에 `conceptNotes?: Record<string, string>` prop 추가 → `ConceptBadges`에 `notes={conceptNotes}` 전달.
- `ResultPanel`: 라이브 `meta.conceptNotes` 전달. `PostPreview`: `post.conceptNotes` 전달.

## 엣지 케이스

| 상황 | 동작 |
|---|---|
| 구버전/게시판 글(노트 없음) | 정의만 |
| 탐지됐지만 노트 없는 개념 | 정의만 |
| 노트 있지만 미탐지 개념 | 배지 없음 → 노트 미표시(무해) |
| 고치기 후 저장본 | 노트 = 생성 시점 고정(logicSummary와 동일 staleness). 라이브 화면은 새 노트 표시 |
| Gemini가 과길이/잘못된 키 반환 | gemini.ts에서 CONCEPT_SET 필터 + 60자 절단으로 방어(규칙은 최후 방어선) |

## 검증

- `./node_modules/.bin/tsc --noEmit` + `npm run build`.
- `scripts/selftest-conceptnotes.mjs`(미커밋, 끝에 시드 정리):
  - ⓐ 생성 경로: `/api/generate`(admin ID 토큰) 호출 → 응답 meta의 `conceptNotes` 형태·키(⊆5개념)·길이(≤60) 검증.
  - ⓑ 규칙 경로(**client SDK**): 정상 맵 포함 게시물 create=통과 / 잘못된 키·61자 이상 값=거부 / conceptNotes 미포함=통과.
- 브라우저: 생성 후 배지 클릭 → "이 작품에선:" 노출 확인, 게시판 글에서도 확인.

## 참고 기반

- 기존 교육 메타 패턴: `logicSummary`/`conceptTags`(Phase 0), `logicLine`(#8) — 스키마·rules·저장·렌더 경로 동일하게 따름.
- `detectConcepts`가 배지 진실원천(`lib/edu/detectConcepts.ts`).
- 개념 메타 공유 소스: `lib/edu/concepts.ts`(정의 `desc`는 이 기능이 병기하는 일반 정의).
