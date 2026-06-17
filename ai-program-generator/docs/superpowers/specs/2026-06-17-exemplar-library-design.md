# few-shot exemplar 라이브러리 — 설계 문서

작성일: 2026-06-17
상태: 설계 확정 (구현 계획 대기)

## 배경 / 동기

Hermes Agent의 "경험에서 스킬을 만들어 재사용하는 학습 루프"를 우리 도메인으로 번안한다.
우리 앱은 계획서 → Gemini가 HTML/CSS/JS 생성 구조다. 빈약한 계획서가 들어오면
미완성·빈 화면·단조로운 결과가 나오는 경우가 있다. 게시판에 이미 쌓인 "잘 나온 생성물"을
few-shot 예시로 생성 프롬프트에 주입해 **생성 결과의 완성도 floor를 끌어올린다.**

이미 보유한 데이터(`posts`의 `likeCount`/`forkCount`/`plan`/`code`)를 품질 개선 신호로 재활용하는 것이라
새 인프라가 거의 필요 없다.

## 목표 / 비목표

### 목표
- 빈약한 계획서에도 "켜자마자 즐길 수 있는 완성형"이 더 자주 나오게 한다(완성도 floor 상향).
- 예시 품질을 사람이 통제한다(자동 추림 후보 → 관리자 승인).
- 무료 티어 한도(flash 20회/일)를 고려해 토큰 추가량을 작게 유지한다.

### 비목표 (YAGNI)
- 카테고리별 매칭 — **생성 시점에 카테고리가 없다**(카테고리는 게시판 업로드 단계에서 선택).
  분류 신호로 `variant`(default/survey)만 사용한다.
- exemplar 이력/버전 관리, 생성당 2개 이상 주입, A/B 효과 측정.
- 생성기(Creator)에 카테고리 선택 UI 추가 — 저학년 타깃 단순함 원칙과 충돌.

## 핵심 결정 (확정)

| 항목 | 결정 |
|---|---|
| 목표 | 완성도/품질 floor 상향 |
| 저장 구조 | 별도 `exemplars` 컬렉션 (포인터 문서 방식) |
| 예시 출처 | 좋아요/fork 자동 추림 후보 + 관리자 승인 |
| 주입 형태 | 계획서(plan) → 결과 쌍, 코드는 상한으로 축약 |
| 개수·시점 | generate 1회당 1개, 항상(해당 variant 슬롯이 채워져 있으면) |
| 매칭 키 | `variant`(default / survey), 각 1개 |
| modify 주입 | 안 함 (기존 코드가 이미 컨텍스트) |

## 데이터 모델

서버 전용 Firestore 컬렉션 `exemplars`. variant당 정확히 1개이므로 **포인터 문서**로 둔다:

- 문서 id: `active_default`, `active_survey`
- 필드:
  - `variant: 'default' | 'survey'`
  - `plan: PlanFields` (name, look, usage, how, etc)
  - `code: { html: string; css: string; javascript: string }` — **축약된** 상태로 저장
  - `sourcePostId: string` (출처 게시물 id)
  - `sourceTitle: string` (관리자 표시·동결 스냅샷용)
  - `approvedBy: string` (관리자 uid)
  - `approvedAt: number` (epoch ms)

**포인터 문서를 쓰는 이유:** variant당 1개라 풀 관리·복합 인덱스가 불필요하고,
생성 핫패스가 `get(exemplars/active_${variant})` 한 번으로 끝난다. 원본 글이 수정·삭제돼도
exemplar는 동결된 복사본으로 유지된다.

## 압축·동결 (관리자 승인 시점)

관리자가 후보 글을 특정 variant 슬롯에 "지정"하면 서버가:

1. 원본 게시물(`posts/{sourcePostId}`)을 Admin SDK로 fetch.
2. `plan`을 복사(구버전 글에 `plan`이 없으면 지정 불가 — 에러로 안내).
3. `code`의 html/css/javascript 각 필드를 `EXEMPLAR_CODE_CAP`(기본 4000자) 상한으로 자르고,
   잘린 경우 끝에 `/* …생략… */` 마커를 붙인다.
4. `exemplars/active_${variant}` 포인터 문서에 위 필드로 set(덮어쓰기).

토큰 영향: 생성당 입력에 약 3~4k 토큰 추가(plan + 축약 코드 3필드). 허용 범위로 본다.
`EXEMPLAR_CODE_CAP`은 상수로 두고 추후 조정한다.

## 생성 시 주입

위치: `app/api/generate/route.ts`, `provider.generate(...)` 호출 직전.

조건: `mode === 'generate'` 일 때만(모디파이 제외).

흐름:
1. `exemplars/active_${promptVariant}`를 adminDb로 get.
2. 문서가 없으면 아무것도 하지 않고 기존 동작(주입 없음)으로 진행 — 폴백은 "예시 없는 현행 생성".
3. 문서가 있으면 `buildExemplarBlock(exemplar)`(순수 함수, `lib/ai/` 신규 모듈)로
   참고 예시 블록을 만든다. 블록은 다음을 명시한다:
   - "아래는 완성도 높은 **참고 예시**다. 그대로 베끼지 말 것."
   - 예시의 계획서와 (축약된) 결과 코드.
   - "이어서 아래 '새 계획서'에 대한 코드를 만들라."
4. 이 블록을 **사용자 prompt 앞에 prepend**해서 `provider.generate({ prompt: block + userPrompt, system, mode })` 호출.
   시스템 프롬프트(지시)는 그대로 두고, exemplar는 content로만 들어간다.

modify에 주입하지 않는 이유: 수정 모드는 이미 기존 코드 전체를 컨텍스트로 싣고 있어(
`buildModifyPrompt`), 예시까지 더하면 "어느 코드를 고치라는 건지" 혼란을 준다. 또한
2026-06-17에 추가한 `MODIFY_SYSTEM_SUFFIX`(요청한 부분만 수정·나머지 보존)와 책임을 분리한다.

## 관리자 지정 흐름 + 보안

### 어드민 API
신규 라우트 `app/api/admin/exemplars/route.ts` (Node 런타임, admin claim 검증):
- `GET` — 현재 두 슬롯(`active_default`, `active_survey`)의 exemplar 요약 반환(관리자 UI용).
- `POST` — body `{ sourcePostId: string; variant: 'default' | 'survey' }` → 압축·동결 후 포인터 문서 write.
- `DELETE` — body `{ variant }` → 해당 슬롯 비우기.

모든 메서드는 `Authorization: Bearer <ID 토큰>`에서 admin claim을 검증한다(기존 어드민 패턴과 동일).

### 어드민 콘솔 UI
어드민 콘솔에 "예시(Exemplars)" 섹션 추가:
- variant 슬롯 2개의 현재 exemplar 미리보기(제목·출처·축약 코드 일부).
- **좋아요/fork 상위 후보 글 목록**(자동 추림: `posts`를 `likeCount`/`forkCount` 내림차순으로 조회).
  각 후보에 "default 예시로 지정" / "survey 예시로 지정" 버튼.
- 슬롯 비우기 버튼.

후보 글의 원본 variant는 알 수 없으므로(게시물에 variant 미기록), 어느 슬롯에 맞는지는 관리자가 판단한다.

### 권한 규칙
`firestore.rules`: `exemplars` 컬렉션은 클라이언트 **읽기·쓰기 전면 차단**(`usage`와 동일 패턴).
- 주입은 서버(route.ts)에서 Admin SDK로만 읽는다 → 클라이언트 read 불필요.
- 쓰기는 어드민 API(Admin SDK)로만 → 클라이언트 write 불필요.

## 컴포넌트 경계

| 단위 | 책임 | 의존 |
|---|---|---|
| `exemplars` 컬렉션 (포인터 문서) | 동결된 variant별 예시 1개 보관 | Firestore |
| `lib/ai/exemplars.ts` (신규) | `buildExemplarBlock(exemplar)` 순수 함수 + `EXEMPLAR_CODE_CAP` + 축약 유틸 | 없음(순수) |
| `app/api/generate/route.ts` (수정) | generate 모드에서 슬롯 get → 블록 prepend | adminDb, exemplars.ts |
| `app/api/admin/exemplars/route.ts` (신규) | 지정/조회/삭제 + 압축·동결 | adminAuth, adminDb, exemplars.ts |
| 어드민 콘솔 "예시" 섹션 (신규) | 후보 추림 + 슬롯 관리 UI | 어드민 API |
| `firestore.rules` (수정) | `exemplars` 클라이언트 접근 차단 | — |

## 에러 처리 / 엣지 케이스
- 슬롯 비어 있음 → 주입 생략, 현행 생성으로 폴백(에러 아님).
- `exemplars` get 실패(네트워크 등) → 주입 생략하고 생성 계속(예시는 부가기능; 생성을 막지 않는다).
- 원본 글에 `plan` 없음(구버전) → 지정 시 400 에러로 안내(축약할 계획서가 없음).
- 축약으로 코드가 잘려도 "참고 예시"로 충분 — 블록에 "예시는 축약·생략될 수 있다" 명시.
- 원본 글 삭제 → 이미 동결 복사본이라 영향 없음(`sourcePostId`는 출처 표시용일 뿐).

## 검증
프롬프트 조립 결과를 라우트가 반환하지 않으므로, "프롬프트에 블록이 포함됐다"는 단언은
**순수 함수 단위**로 검증하고, API는 라운드트립·스모크로 검증한다.

- `./node_modules/.bin/tsc --noEmit` (dev 서버 띄운 채) → `npm run build`.
- `buildExemplarBlock` 검증(`scripts/selftest-exemplars.mjs`에서 직접 호출 또는 인라인 단언):
  - 주어진 exemplar로 블록 문자열을 만들면 plan 5필드·축약 코드·"참고 예시(베끼지 말 것)" 프레이밍 문구가 모두 포함된다.
  - 축약 유틸이 `EXEMPLAR_CODE_CAP` 초과 코드를 잘라 `/* …생략… */` 마커를 붙인다.
- `scripts/selftest-exemplars.mjs`(기존 selftest 컨벤션, Admin SDK custom token → ID token):
  1. 어드민 API로 특정 글을 default 슬롯에 지정(`POST`) → `GET`으로 슬롯이 채워졌는지 확인.
  2. generate(default) 호출이 정상 응답(슬롯 있는 상태에서도 생성이 깨지지 않음 — 스모크).
  3. 슬롯 비우기(`DELETE`) → `GET`으로 빈 슬롯 확인 → generate 여전히 정상.
  4. 비-admin 토큰으로 어드민 API 호출 시 거부(401/403) 확인.
- 브라우저 확인: 어드민에서 지정 → 빈약한 계획서로 생성 → 완성도 향상 체감(정성).

## 토큰 / 한도 영향
생성당 입력 토큰 약 3~4k 증가. flash 무료 한도는 호출 횟수(20회/일) 기준이라 토큰 증가가
한도 횟수를 직접 깎지는 않으나, 장기적으로 유료 전환 시 비용에 반영됨. `EXEMPLAR_CODE_CAP`으로 통제.
