# 골라서 만들기 "역할 카드" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 골라서 만들기 "내가 고른 것"에서 답한 각 선택에 역할 태그(A)를 붙이고, ⓘ를 누르면 역할 설명 + 개념 다리 칩(B)을 보여준다.

**Architecture:** 공유 역할 테이블(`lib/survey/roles.ts`)을 각 `SurveyStep.role`이 참조 → `SurveySummary`가 답한 항목에 태그·ⓘ 렌더, ⓘ 카드의 개념 칩은 `lib/edu/concepts.ts`의 `CONCEPT_BY_KEY`를 재사용해 배지·도감과 색·아이콘 일치. 순수 클라이언트, 정적 텍스트.

**Tech Stack:** Next.js 15(App Router) · React · TypeScript · Tailwind v4 · lucide-react.

## Global Constraints

- **테스트 프레임워크 없음.** 검증 = `./node_modules/.bin/tsc --noEmit`(dev 중 안전) + `npm run build`(dev 정지 후) + 브라우저(/easy). `npx tsc` 금지.
- **스키마·firestore.rules·배포·AI·self-test 전부 불필요** — 순수 클라이언트 정적.
- **역할 UI는 "답한 항목"에만.** 미답 항목은 현행(점선+질문) 그대로.
- **개념 칩은 반드시 `CONCEPT_BY_KEY` 재사용**(색·아이콘·라벨 단일 소스). concept 값 ∈ `['순서','조건','반복','입력','출력']`.
- 모든 노출 한국어는 초등 저학년 "~해요" 체, 짧게.
- 항목 본문 탭 = 재선택(onEditStep) 유지. ⓘ 탭은 `stopPropagation`으로 카드만 토글.
- 브랜치 **`feat/easy-role-cards`**(이미 생성, 스펙 커밋 `0fa60b0`). 커밋은 각 태스크 끝.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/survey/roles.ts` | 역할 정의(단일 소스) | 신규 — RoleKey/RoleInfo/ROLES 9종 |
| `lib/survey/types.ts` | 서베이 타입 | `SurveyStep.role?`·`roleHint?` 추가 |
| `lib/survey/programs/*.ts` (10) | 프로그램별 단계 | 각 step에 `role` 배정 |
| `components/survey/SurveySummary.tsx` | "내가 고른 것" 렌더 | 태그(A)+ⓘ(B)+개념 칩 |

---

## Task 1: 역할 테이블 + 타입

**Files:**
- Create: `lib/survey/roles.ts`
- Modify: `lib/survey/types.ts`

**Interfaces:**
- Produces: `RoleKey`, `RoleInfo`, `ROLES: Record<RoleKey, RoleInfo>` (roles.ts). `SurveyStep.role?: RoleKey`, `SurveyStep.roleHint?: string` (types.ts).

- [ ] **Step 1: roles.ts 생성**

`lib/survey/roles.ts`:

```ts
// 골라서 만들기 "역할 카드" 공유 정의(단일 소스). SurveyStep.role이 이 키를 참조하고,
// SurveySummary가 label(태그)·hint(ⓘ 설명)·concept(개념 다리)를 읽어 렌더한다.
// concept는 lib/edu/concepts.ts의 개념 키('순서'|'조건'|'반복'|'입력'|'출력') — 칩 색·아이콘은 CONCEPT_BY_KEY에서 재사용.

export type RoleKey = 'type' | 'goal' | 'appearance' | 'decor' | 'sound' | 'control' | 'rule' | 'flow' | 'output';

export interface RoleInfo {
  /** 인라인 태그(A) */
  label: string;
  /** ⓘ 카드 한 줄(B), 저학년 말투 */
  hint: string;
  /** 개념 다리 — 없으면 개념 칩 미표시 */
  concept?: string;
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  type: { label: '종류', hint: '어떤 놀이를 만들지 큰 틀을 정해요.' },
  goal: { label: '목표', hint: '무엇을 하는 게 목표인지 정해요.' },
  appearance: { label: '모양', hint: '주인공이나 화면이 어떻게 생길지 정해요.' },
  decor: { label: '배경', hint: '펼쳐지는 곳을 꾸며요.' },
  sound: { label: '소리', hint: '어떤 소리로 들려줄지 정해요.', concept: '출력' },
  control: { label: '조작', hint: '네가 어떻게 움직일지 정하는 부분이에요.', concept: '입력' },
  rule: { label: '규칙', hint: '언제 어떻게 될지 규칙을 정해요.', concept: '조건' },
  flow: { label: '흐름', hint: '얼마나 빠르게·계속 될지 정해요.', concept: '반복' },
  output: { label: '결과', hint: '끝나면 무엇을 보여줄지 정해요.', concept: '출력' },
};
```

- [ ] **Step 2: types.ts에 role 필드 추가**

`lib/survey/types.ts` 상단에 import 추가:
```ts
import type { RoleKey } from './roles';
```
`SurveyStep` 인터페이스에 두 필드 추가(`showIf` 아래):
```ts
  /** 조건부 단계: 이전 답에 따라 노출 여부. 없으면 항상 노출. */
  showIf?: (a: SurveyAnswers) => boolean;
  /** '내가 고른 것' 역할 카드용 — 이 단계가 프로그램의 어느 부분을 정하는지 */
  role?: RoleKey;
  /** 그 단계만 역할 hint를 덮어쓸 때(드묾). 없으면 ROLES[role].hint 사용 */
  roleHint?: string;
```

- [ ] **Step 3: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add lib/survey/roles.ts lib/survey/types.ts
git commit -m "feat(edu): 역할 카드 — roles 테이블 + SurveyStep.role

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: SurveySummary 렌더 (A 태그 + B ⓘ 카드)

**Files:**
- Modify: `components/survey/SurveySummary.tsx` (전체 교체)

**Interfaces:**
- Consumes: `ROLES`(Task 1), `CONCEPT_BY_KEY`(기존 `lib/edu/concepts.ts`), `SurveyStep.role`/`roleHint`(Task 1).

- [ ] **Step 1: SurveySummary.tsx 전체 교체**

`components/survey/SurveySummary.tsx` 전체를 아래로 교체:

```tsx
'use client';

import { useState } from 'react';
import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';
import { AI_PICK } from '@/lib/survey/types';
import { ROLES } from '@/lib/survey/roles';
import { CONCEPT_BY_KEY } from '@/lib/edu/concepts';

export default function SurveySummary({
  type,
  steps,
  answers,
  currentStepId,
  onEditType,
  onEditStep,
}: {
  type: ProgramType;
  steps: SurveyStep[]; // 현재 노출 단계
  answers: SurveyAnswers;
  currentStepId?: string;
  onEditType?: () => void;
  onEditStep?: (index: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const labelOf = (step: SurveyStep): string => {
    const a = answers[step.id];
    if (a === AI_PICK) return '아무거나 🎲';
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    return step.options
      .filter((o) => ids.includes(o.id))
      .map((o) => o.label)
      .join(', ');
  };

  return (
    <div className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <p className="text-[14px] font-medium text-muted">🧺 내가 고른 것</p>
      <p className="mb-3 text-[12px] text-muted">눌러서 다시 고를 수 있어요</p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onEditType}
          className="press flex items-center gap-1.5 rounded-[var(--r-md)] bg-brand-soft px-3 py-2 text-left text-[14px] font-medium text-brand-strong dark:text-brand"
        >
          <span aria-hidden>{type.icon}</span> {type.label}
        </button>
        {steps.map((s, i) => {
          const v = labelOf(s);
          const active = s.id === currentStepId;
          const role = s.role ? ROLES[s.role] : undefined;
          const showRole = !!role && !!v; // 답한 항목 + 역할 있을 때만
          const open = openId === s.id;
          const concept = role?.concept ? CONCEPT_BY_KEY[role.concept] : undefined;
          const ConceptIcon = concept?.icon;
          return (
            <div key={s.id}>
              <div className="flex items-stretch gap-1.5">
                <button
                  onClick={() => onEditStep?.(i)}
                  className={`press flex-1 rounded-[var(--r-md)] px-3 py-2 text-left text-[14px] ${
                    active
                      ? 'border-2 border-brand bg-brand-soft/50 text-ink'
                      : v
                        ? 'bg-surface-2 text-ink hover:bg-brand-soft/40'
                        : 'border-2 border-dashed border-line text-muted hover:border-brand/40'
                  }`}
                >
                  {showRole && (
                    <span className="mr-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                      {role!.label}
                    </span>
                  )}
                  {v || s.question}
                </button>
                {showRole && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenId(open ? null : s.id);
                    }}
                    aria-expanded={open}
                    aria-label={`${role!.label} 역할 설명 ${open ? '닫기' : '보기'}`}
                    className={`press grid w-9 shrink-0 place-items-center rounded-[var(--r-md)] border-2 text-[15px] ${
                      open
                        ? 'border-brand bg-brand-soft text-brand-strong dark:text-brand'
                        : 'border-line text-muted hover:border-brand/40'
                    }`}
                  >
                    ⓘ
                  </button>
                )}
              </div>
              {showRole && open && (
                <div className="anim-pop-in mt-1.5 rounded-[var(--r-md)] bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-ink">
                  <p>{s.roleHint ?? role!.hint}</p>
                  {concept && ConceptIcon && (
                    <span
                      className={`anim-pop-in mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${concept.soft}`}
                    >
                      <ConceptIcon size={13} aria-hidden /> 이건 ‘{concept.label}’ 개념이에요
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
```
Expected: 에러 0. (`anim-pop-in`은 globals.css 기존 유틸 — prefers-reduced-motion 가드 내장. `concept.soft`는 CONCEPT_BY_KEY의 색 클래스.)

- [ ] **Step 3: 커밋**

```bash
git add components/survey/SurveySummary.tsx
git commit -m "feat(edu): 역할 카드 — SurveySummary 태그+ⓘ+개념 칩

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: role 배정 — game·quiz·aquarium·paint·maze

**Files:**
- Modify: `lib/survey/programs/game.ts`, `quiz.ts`, `aquarium.ts`, `paint.ts`, `maze.ts`

각 파일에서 **step 객체마다 `role: '<값>',` 한 줄 추가**(그 step의 `id:` 줄 바로 아래에). 아래 표의 step id → role대로. (options의 id가 아니라 **step의 id** 기준.)

- [ ] **Step 1: game.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| genre | type | | speed | flow |
| collectitem | goal | | speedup | flow |
| star_effect | appearance | | powerup | rule |
| hero | appearance | | powerup_effect | output |
| control | control | | mole_type | goal |
| background | decor | | obstacle_type | goal |
| scoring | rule | | scorename | output |
| | | | gameover | output |

- [ ] **Step 2: quiz.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| topic | type | | timer | rule |
| mathtype | goal | | timer_warn | rule |
| numrange | rule | | lives | rule |
| count | flow | | lives_count | rule |
| answer | control | | playmode | rule |
| feedback | output | | end | output |
| soundtype | sound | | | |

- [ ] **Step 3: aquarium.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| place | decor | | bgcolor | decor |
| spacefx | appearance | | click | control |
| creatures | goal | | feedkind | appearance |
| fishcolor | appearance | | sound | sound |
| decor | decor | | soundkind | sound |
| count | flow | | daynight | control |
| speed | flow | | | |

- [ ] **Step 4: paint.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| bg | decor | | default_size | appearance |
| brush | appearance | | stamp | appearance |
| rainbow | appearance | | stamp_size | appearance |
| rainbow_speed | flow | | name_stamp | appearance |
| palette | appearance | | music | sound |
| size | control | | music_mood | sound |
| | | | save | output |

- [ ] **Step 5: maze.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| theme | decor | | treasure_type | goal |
| size | rule | | trap | rule |
| minimap | output | | trap_hint | rule |
| control | control | | timer | rule |
| hero | appearance | | success | output |
| goal | goal | | | |
| treasure_count | goal | | treasure_hint | rule |

- [ ] **Step 6: 타입체크 + 커밋**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
git add lib/survey/programs/game.ts lib/survey/programs/quiz.ts lib/survey/programs/aquarium.ts lib/survey/programs/paint.ts lib/survey/programs/maze.ts
git commit -m "feat(edu): 역할 카드 — role 배정(game·quiz·aquarium·paint·maze)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: tsc 에러 0(role 값이 RoleKey union과 일치해야 통과 — 오타 시 여기서 잡힘).

---

## Task 4: role 배정 — roulette·calc·card·fortune·sound

**Files:**
- Modify: `lib/survey/programs/roulette.ts`, `calc.ts`, `card.ts`, `fortune.ts`, `sound.ts`

Task 3과 동일 방식(step id 아래 `role: '<값>',`).

- [ ] **Step 1: roulette.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| use | type | | stopfx | output |
| namemethod | control | | bigshow | output |
| namecount | goal | | celebrate | output |
| slots | appearance | | again | output |
| color | appearance | | bg | decor |
| speed | flow | | spinsound | sound |
| soundmood | sound | | | |

- [ ] **Step 2: calc.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| mode | type | | btnshape | appearance |
| range | rule | | btncolor | appearance |
| hint | rule | | btnsound | sound |
| timesdan | goal | | soundfx | sound |
| ops | goal | | | |

- [ ] **Step 3: card.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| kind | type | | clickfx | output |
| meinfo | goal | | music | sound |
| favkind | goal | | musicmood | sound |
| animaldetail | goal | | nameField | control |
| theme | decor | | font | appearance |
| shooting | appearance | | pattern | decor |
| deco | decor | | bgcolor | decor |
| decomotion | flow | | | |

- [ ] **Step 4: fortune.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| kind | type | | count | flow |
| luckyextras | goal | | again | output |
| animalshow | appearance | | share | output |
| mood | decor | | bg | decor |
| btnshape | appearance | | fx | output |
| fxsound | sound | | | |

- [ ] **Step 5: sound.ts**

| step id | role | | step id | role |
|---|---|---|---|---|
| instrument | type | | volume | control |
| playmode | control | | bg | decor |
| songslist | goal | | record | output |
| keycount | appearance | | score | rule |
| color | appearance | | extra | output |
| pressfx | output | | | |

- [ ] **Step 6: 타입체크 + 커밋**

```bash
cd ai-program-generator && ./node_modules/.bin/tsc --noEmit
git add lib/survey/programs/roulette.ts lib/survey/programs/calc.ts lib/survey/programs/card.ts lib/survey/programs/fortune.ts lib/survey/programs/sound.ts
git commit -m "feat(edu): 역할 카드 — role 배정(roulette·calc·card·fortune·sound)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Expected: tsc 에러 0.

---

## Task 5: 엔드투엔드 검증 + 빌드 + PR

**Files:** 없음(검증만).

- [ ] **Step 1: 프로덕션 빌드(dev 정지 후)**

dev 서버를 멈춘 뒤:
```bash
cd ai-program-generator && npm run build
```
Expected: 타입체크 포함 빌드 성공(에러 0).

- [ ] **Step 2: 브라우저 확인(dev 재기동 후)**

`/easy`에서: ⓐ 게임 하나 골라 몇 단계 답 → 각 답한 항목 앞에 **역할 태그**(종류·조작·규칙 등) 표시. ⓑ 항목의 **ⓘ 탭** → 역할 설명 한 줄 + (조작/규칙/흐름/소리/결과면) **개념 칩**이 그 개념 색으로 열림. ⓒ 항목 **본문 탭 = 재선택**(카드 안 열림, 그 단계로 이동). ⓓ **미답 항목**엔 태그·ⓘ 없음(현행). ⓔ 다크모드에서 색 정상. ⓕ 다른 프로그램(뽑기·그림판) 한둘도 확인.

Expected: 위 전부 동작.

- [ ] **Step 3: PR 생성**

```bash
git push -u origin feat/easy-role-cards
gh pr create --base main --title "feat(edu): 골라서 만들기 역할 카드(선택 항목별 역할 A+B)" --body "$(cat <<'EOF'
'내가 고른 것'의 각 선택에 역할 태그(A)를 붙이고, ⓘ를 누르면 역할 설명 + 개념 다리 칩(B)을 보여준다.

- lib/survey/roles.ts: 역할 9종(종류·목표·모양·배경·소리·조작·규칙·흐름·결과) 단일 소스
- SurveyStep.role 추가, 10개 프로그램 step에 배정
- SurveySummary: 답한 항목에 태그+ⓘ, 개념 칩은 CONCEPT_BY_KEY 재사용(배지·도감과 색 일치)
- 미답 항목·재선택 동작은 현행 유지, 스키마·규칙·배포 없음(순수 클라)

검증: tsc + build + 브라우저(/easy).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL 출력.

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** roles 테이블(T1)·types(T1)·SurveySummary A+B(T2)·10프로그램 role 배정(T3·T4)·검증(T5) 모두 태스크 있음. 개념 칩 CONCEPT_BY_KEY 재사용(T2)·답한 항목만(T2 showRole)·stopPropagation(T2)·reduced-motion(anim-pop-in, T2) 반영.
- **플레이스홀더:** 소스는 전부 실제 코드. role 배정은 step id→role 표로 구체(총 스텝 전수). 빈 표 없음.
- **타입 일관성:** `RoleKey` 9키(type/goal/appearance/decor/sound/control/rule/flow/output)가 roles.ts 정의·types 필드·배정 표에서 일치. concept 값(입력/조건/반복/출력)이 CONCEPT_BY_KEY 키와 일치. `ConceptIcon`은 `concept.icon`(LucideIcon) 대문자 바인딩 후 JSX 사용(ConceptBadges와 동일 패턴).
- **주의:** role 오타는 tsc가 union 불일치로 잡음(T3/T4 Step 6). 애매한 배정(개수·효과류)은 rubric상 가장 가까운 role로 통일 — 기능·타입에 무해.
