# 골라서 만들기 "역할 카드" (선택 항목별 역할 표시) 설계

**작성일:** 2026-07-10
**상태:** 승인 대기 → 구현 예정
**브랜치:** `feat/easy-role-cards`

## 목표

골라서 만들기의 "내가 고른 것"(`SurveySummary`)에서, 아이가 고른 **각 선택이 프로그램의 어느 부분을 정하는지**를 보여준다. 하이브리드 A+B:
- **A (인라인 역할 태그)**: 각 항목 값 앞에 작은 태그(종류·모양·조작·배경·규칙·흐름·결과 …).
- **B (ⓘ 탭 카드)**: ⓘ를 누르면 그 역할의 한 줄 설명 + (해당하면) **개념 다리 칩**(조작→입력, 규칙→조건, 흐름→반복, 소리/결과→출력)이 열림. 개념 칩은 배지·도감과 동일한 색·아이콘.

## 교육적 근거

- **분해(decomposition)** 를 가르친다 — "프로그램은 목적이 다른 부분들이 모인 것". 아이는 옵션을 고르면서 각 선택이 *어느 부분*을 정하는지 자연히 인지한다.
- **골라서만들기 ↔ conceptNotes ↔ 도감** 을 하나의 흐름으로 잇는다: 여기서 심은 "조작=입력" 같은 다리가, 생성 후 개념 배지/도감에서 다시 만난다.

## 비목표 (YAGNI)

- **스키마·firestore.rules·배포·AI 전부 없음** — 순수 클라이언트 정적 텍스트.
- 옵션 단위 역할 없음(역할은 **단계(step) 단위**). 생성 프롬프트·결과 변경 없음.
- 미답 항목은 지금 동작 그대로(점선+질문) — 태그·ⓘ 미표시.
- 영속화 없음(펼침 상태는 로컬 UI state).
- 발견성 강화(상시 노출) 없음 — ⓘ 탭 온디맨드(목업 승인 방식).

## 접근법 결정

**공유 역할 테이블(A) + per-step 오버라이드.** 역할 6~9종을 한 곳에 정의하고 각 step이 `role` 키로 참조. 드물게 안 맞는 단계만 `roleHint`로 그 단계 문구를 덮어씀. (대안 "step별 직접 저작"은 100+개 저작·문구 불일치·개념매핑 중복으로 탈락.)

## 아키텍처 / 데이터 흐름

```
SurveyStep.role (프로그램 정의)  →  ROLES[role] (lib/survey/roles.ts: label·hint·concept)
  →  SurveySummary: 답한 항목에 태그(A) + ⓘ(B)
  →  ⓘ 탭 → hint + 개념 칩(CONCEPT_BY_KEY[concept] 색·아이콘 재사용)
```

배지·도감과의 일관성: 개념 칩은 `lib/edu/concepts.ts`의 `CONCEPT_BY_KEY`를 그대로 읽는다(색·아이콘·라벨 단일 소스).

## 컴포넌트/파일별 변경

### 1. 신규 `lib/survey/roles.ts`

```ts
export type RoleKey = 'type' | 'goal' | 'appearance' | 'decor' | 'sound' | 'control' | 'rule' | 'flow' | 'output';

export interface RoleInfo {
  label: string;   // 인라인 태그(A)
  hint: string;    // ⓘ 카드 한 줄(B), 저학년 "~해요"
  concept?: string; // 개념 다리 — CONCEPT_SET('순서'|'조건'|'반복'|'입력'|'출력') 중 하나, 없으면 미표시
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  type:       { label: '종류', hint: '어떤 놀이를 만들지 큰 틀을 정해요.' },
  goal:       { label: '목표', hint: '무엇을 하는 게 목표인지 정해요.' },
  appearance: { label: '모양', hint: '주인공이 어떻게 생길지 정해요.' },
  decor:      { label: '배경', hint: '펼쳐지는 곳을 꾸며요.' },
  sound:      { label: '소리', hint: '어떤 소리로 들려줄지 정해요.', concept: '출력' },
  control:    { label: '조작', hint: '네가 어떻게 움직일지 정하는 부분이에요.', concept: '입력' },
  rule:       { label: '규칙', hint: '언제 어떻게 될지 규칙을 정해요.', concept: '조건' },
  flow:       { label: '흐름', hint: '얼마나 빠르게·계속 될지 정해요.', concept: '반복' },
  output:     { label: '결과', hint: '끝나면 무엇을 보여줄지 정해요.', concept: '출력' },
};
```

### 2. `lib/survey/types.ts` — SurveyStep 확장

`SurveyStep`에 추가(둘 다 옵셔널, 하위호환):
```ts
  /** '내가 고른 것' 역할 카드용 — 이 단계가 프로그램의 어느 부분을 정하는지 */
  role?: RoleKey;
  /** 그 단계만 역할 hint를 덮어쓸 때(드묾). 없으면 ROLES[role].hint 사용 */
  roleHint?: string;
```

### 3. `lib/survey/programs/*.ts` (10종) — step에 role 배정

각 step에 `role: '...'` 한 줄 추가. **배정 rubric**:
- 종류/장르 선택 → `type`
- 무엇을 모을지·잡을지·피할지(대상) → `goal`
- 주인공·캐릭터 모습, 시각 효과 → `appearance`
- 배경·테마 → `decor`
- 소리·음악 → `sound`(→출력)
- 조작/입력 방식 → `control`(→입력)
- 점수·판정·승패·특수 규칙·파워업 → `rule`(→조건)
- 속도·빨라짐·반복 흐름 → `flow`(→반복)
- 게임오버·결과·점수판·표시 방식 → `output`(→출력)
- 딱 안 맞는 단계는 가장 가까운 role + 필요 시 `roleHint`로 문구 조정.

**worked example — `game.ts`**: genre→type · collectitem→goal · star_effect→appearance · hero→appearance · control→control · background→decor · scoring→rule · speed→flow · speedup→flow · powerup→rule · powerup_effect→output · mole_type→goal · obstacle_type→goal · scorename→output · gameover→output. (나머지 9개 프로그램도 같은 rubric으로 플랜에서 배정.)

### 4. `components/survey/SurveySummary.tsx` — 렌더(A+B)

- **답한 항목**(`v` 존재)에만 역할 UI. 미답/점선 항목은 현행 유지.
- 각 항목 행: `[역할 태그]  값  … [ⓘ]`. 역할 태그 = `ROLES[step.role].label`(작은 muted pill). ⓘ = 작은 원형 버튼.
- **단일 오픈 state**: `const [openRole, setOpenRole] = useState<string | null>(null)`(step.id 저장). ⓘ 클릭 → 토글. ConceptBadges와 동일 패턴.
- **어포던스 분리**: 항목 본문 클릭 = 기존 `onEditStep(i)` 재선택 유지. ⓘ는 별도 요소로 `e.stopPropagation()` 후 카드만 토글(재선택 안 일어남).
- **펼침 카드**: `step.roleHint ?? ROLES[step.role].hint` 한 줄 + concept 있으면 개념 칩:
  - 칩 = `CONCEPT_BY_KEY[concept]`의 `icon`·`soft`(색)·`label` 재사용, 문구 "이건 '{label}' 개념이에요".
- 펼침 애니메이션은 `prefers-reduced-motion` 가드(globals.css 모션 정책) — reduced일 땐 즉시 표시.
- `step.role`이 없으면 태그·ⓘ 미렌더(안전 폴백 — 구·미배정 step).

## 엣지 케이스

| 상황 | 동작 |
|---|---|
| step.role 없음 | 태그·ⓘ 미표시(기존 렌더) |
| role은 있으나 concept 없음(모양·배경·종류·목표) | ⓘ 카드에 hint만, 개념 칩 없음 |
| 미답 항목 | 현행(점선+질문), 역할 UI 없음 |
| 다중선택(multi) 답 | 값은 콤마 조인, 역할은 단계 것 그대로 |
| AI_PICK('아무거나 🎲') 답 | 값만 그렇게 표시, 역할 UI 정상 |
| type 버튼(맨 위) | 프로그램 종류라 역할 카드 대상 아님(현행 유지) |

## 검증

- `./node_modules/.bin/tsc --noEmit` + `npm run build`.
- **브라우저**(/easy): 한 종류 골라 단계 답 → 각 항목에 역할 태그 표시 · ⓘ 탭 시 hint+개념 칩(색 일치) 열림 · 항목 본문 탭은 재선택(카드 안 열림) · 미답 항목 무영향 · 다크모드 · reduced-motion.
- 규칙 없음 → firestore self-test 불필요.

## 참고 기반

- `components/survey/SurveySummary.tsx`(현행 렌더), `lib/survey/types.ts`(SurveyStep/SurveyOption), `lib/survey/programs/*.ts`(10 프로그램).
- `lib/edu/concepts.ts` `CONCEPT_BY_KEY`(개념 색·아이콘·라벨 — 칩 재사용).
- 상호작용 패턴은 `components/common/ConceptBadges.tsx`(단일 오픈 팝오버)와 동일 결.
