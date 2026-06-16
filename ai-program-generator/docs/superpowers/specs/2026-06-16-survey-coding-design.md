# 선택지형 저학년 코딩 모드(Survey-to-Prompt) 설계

작성일: 2026-06-16

## 배경 / 목표
기존 생성기는 **텍스트 입력** 기반(초등 고학년·일반). 글자 입력이 서툰 **저학년·코딩 취약계층**을 위해, **타이핑 없이 "클릭(선택지)"만으로** 프로그램의 의도와 로직을 설계하는 모드를 추가한다. 선택이 자연어 프롬프트로 조립되어 **기존 AI 생성·미리보기·게시판 파이프라인에 그대로 연결**된다. (룬/LUN 사업계획서의 Survey-to-Prompt 고도화 항목.)

교육적 의도: 옵션 선택=문제 분해, 순차 구성=알고리즘/절차적 사고, 선택→결과 확인·수정=자기주도 최적화.

## 결정 사항(확정)
- **진입**: 기존 텍스트 생성기(`/`)는 고학년용으로 유지. **새 전체화면 마법사 라우트 `/easy`** 신설. 홈/헤더에 "골라서 만들기" 진입점 추가(기존 `/` 흐름은 보존).
- **구조**: 종류별 분기 — 1단계에서 만들 종류 선택 → 종류별 **7~8개 옵션 단계**(일부 **조건부 분기**) → "만들기".
- **데이터-주도**: 각 종류 = TS 설정 객체(steps/options/조건/프롬프트 조각). 종류 추가는 **설정 작업**(엔진 코드 불변).
- **파이프라인 재사용**: 선택 → 프롬프트 조립 → 기존 `/api/generate` → 미리보기(`FullscreenFrame`) → 공유(`UploadDialog`). 미리보기·게시판·규칙 **변경 없음**. (`/api/generate`는 시스템 프롬프트 **변형 선택**만 소폭 추가 — 아래.)
- **선택지 전용 시스템 프롬프트 신규**: 저학년·선택지 입력에 맞춘 `SURVEY_SYSTEM_PROMPT`를 새로 만든다. 변형은 **서버가 `variant` 키로 선택**(클라이언트는 프롬프트 텍스트가 아닌 키만 전송 → 기존 주입 차단 정책 유지).
- **인증**: 생성은 로그인 필수(기존 정책). 저학년은 교실 계정(@class.kr) 전제. 일일 한도 그대로.
- **v1 범위**: 엔진 + 조건부 단계 + 진입 분기 + 종류 **2~3개**(🎨그림판·❓퀴즈·💌소개카드) 완성. 나머지 종류(🎮게임·🌀미로·🎡룰렛·🔢계산기·🔮칭찬운세·🎵소리놀이·🐠수족관)는 같은 패턴으로 점진 추가.

## 데이터 모델 (신규 `lib/survey/types.ts`)

```ts
export type SurveyAnswers = Record<string, string | string[]>; // stepId → 선택한 optionId(들)

export interface SurveyOption {
  id: string;
  label: string;          // 저학년용 짧은 말
  icon?: string;          // 이모지/기호(장식)
  promptFragment: string; // 이 선택이 프롬프트에 더하는 자연어 조각
}

export interface SurveyStep {
  id: string;
  question: string;       // "어떤 종이에 그릴까?"
  options: SurveyOption[];
  multi?: boolean;        // 다중 선택 허용(기본 단일)
  /** 조건부 단계: 이전 답에 따라 노출 여부 결정(분기). 없으면 항상 노출. */
  showIf?: (a: SurveyAnswers) => boolean;
}

export interface ProgramType {
  id: string;
  label: string;
  icon: string;
  basePrompt: string;     // 종류 고유 기반 설명(AI에 주는 토대)
  steps: SurveyStep[];    // 7~8단계(조건부 포함)
  /** 작품 제목 기본값 생성(선택 기반). */
  buildName: (a: SurveyAnswers) => string;
}
```

종류 설정은 `lib/survey/programs/<id>.ts`(TS라 `showIf`/`buildName` 함수 가능) + `lib/survey/programs/index.ts` 레지스트리(`PROGRAM_TYPES: ProgramType[]`).

### 예시 설정(그림판, 발췌)
```ts
export const paint: ProgramType = {
  id: 'paint', label: '그림판', icon: '🎨',
  basePrompt: '마우스로 자유롭게 그림을 그릴 수 있는 그림판 웹 프로그램을 만들어줘.',
  buildName: (a) => '나의 그림판',
  steps: [
    { id: 'bg', question: '어떤 종이에 그릴까?', options: [
        { id: 'white', label: '하얀 종이', icon: '🤍', promptFragment: '배경은 하얀색.' },
        { id: 'board', label: '까만 칠판', icon: '🟩', promptFragment: '배경은 어두운 칠판색이고, 그림 색은 밝게 잘 보이게.' },
        /* ... */ ] },
    { id: 'tool', question: '무엇으로 그릴까?', options: [/* 연필/크레용/스프레이 ... */] },
    { id: 'rainbow', question: '무지개 색도 넣을까?', showIf: (a) => a.tool === 'crayon',
      options: [/* 응/아니 → promptFragment */] },
    /* ... 총 7~8단계, 일부 showIf 분기 ... */
  ],
};
```

## 조립 로직 (신규 `lib/survey/assemble.ts`, 순수 함수)
```ts
// showIf를 적용해 현재 답 기준 실제 노출 단계 목록
export function visibleSteps(type: ProgramType, a: SurveyAnswers): SurveyStep[];

// basePrompt + 노출된 단계의 선택 조각들 → 생성용 프롬프트(저학년 친화 기본값은 시스템 프롬프트가 이미 보장)
export function assemblePrompt(type: ProgramType, a: SurveyAnswers): string;

// 게시판 저장/호환용 PlanFields 매핑(name=buildName, 나머지는 선택 요약을 분배).
export function surveyToPlan(type: ProgramType, a: SurveyAnswers): PlanFields;
```
- 미답 단계(특히 조건부)는 건너뜀. 진행률 = 답한 노출단계 / 전체 노출단계.
- `assemblePrompt` 결과를 `requestGenerate(prompt, 'generate', 'survey')`에 전달 → 기존 경로. 업로드 시 `plan = surveyToPlan(...)`, `prompt = assemblePrompt(...)`로 기존 `createPost` 스키마에 그대로 저장(게시판/딥링크/좋아요 등 자동 호환).

## 3-1) 프롬프트 설계 (선택지 전용 — 품질의 핵심)
선택지형은 저학년이 몇 번 클릭한 **빈약한 입력**이므로, 시스템 프롬프트가 결과 품질을 좌우한다.

- **신규 `SURVEY_SYSTEM_PROMPT`** (`lib/ai/prompts.ts`): 기존 `DEFAULT_SYSTEM_PROMPT`의 제약을 **계승**(출력 JSON `{html,css,javascript}`, `alert/confirm/prompt` 금지, `while(true)` 금지, `localStorage` try-catch, SVG/캔버스·Web Audio 가이드) + 저학년·선택지 맞춤 지시 추가:
  - 입력은 저학년이 "선택지"로 설계한 **간단한 의도**다. 부족한 세부는 **합리적·안전한 기본값으로 풍부하게 채워 완성**하라(빈 화면·설명창·미완성 금지).
  - 결과는 **켜자마자 바로 즐길 수 있는 완성형**. 큰 글씨·큰 버튼·밝고 친근한 색·모바일 반응형. 조작은 단순·관대하게(클릭 위주, 실수해도 안 깨짐). 한국어는 아주 쉬운 말.
- **변형은 서버가 키로 선택**: `lib/ai/prompts.ts`에 `SYSTEM_PROMPTS: Record<'default'|'survey', string>` 맵. `/api/generate`가 본문의 `variant`(화이트리스트, 기본 `'default'`)로 **서버에서** 시스템 프롬프트를 고른다. **클라이언트는 시스템 프롬프트 텍스트를 보내지 않음**(기존 주입 차단 유지). `lib/client/generate.ts`의 `requestGenerate(prompt, mode, variant?)`에 `variant` 인자 추가 → 마법사는 `'survey'` 전달.
- **basePrompt(종류별)·promptFragment(선택지별) 작성 가이드**: 명령형·구체·짧게, 서로 모순 없게. 종류별 실제 문구는 구현 시 작성하고 대표 답안으로 품질 확인(검증).

영향 파일(프롬프트): `lib/ai/prompts.ts`(SURVEY_SYSTEM_PROMPT + SYSTEM_PROMPTS 맵), `app/api/generate/route.ts`(variant 화이트리스트 선택), `lib/client/generate.ts`(variant 인자).

## 컴포넌트 (신규 `components/survey/`)
- `SurveyWizard.tsx` — 오케스트레이터: 종류 선택 → 단계 진행(answers 상태, 진행률, 조건부 단계 계산) → 생성 호출 → 결과 패널/공유. 뒤로/다시 고르기.
- `TypePicker.tsx` — 1단계 종류 선택(큰 아이콘 카드 그리드).
- `StepScreen.tsx` — 한 단계(질문 + 큰 선택 카드, 단일/다중).
- `SurveySummary.tsx` — "내가 고른 것" 요약(고를수록 채워짐; 순차 구성 체감).
- 재사용: 미리보기 `FullscreenFrame`(기존), 결과/생성 흐름은 `lib/client/generate`의 `requestGenerate`, 공유 `UploadDialog`(기존), 인증 `useAuth`.
- `app/easy/page.tsx` — `SurveyWizard` 마운트(전체화면). 홈/헤더에 `/easy` 진입 버튼 추가.

## 저학년 UI 원칙
- 한 화면 한 질문, 큰 아이콘 카드(≥큰 탭타깃), 최소 텍스트. 상단 진행표시 + 하단 "내가 고른 것" 요약.
- 기존 디자인 토큰·모션·UI 프리미티브 재사용. 모든 모션 `prefers-reduced-motion` 가드.
- (추후) TTS 읽어주기·비로그인 체험.

## 검증 기준 (완료 정의)
1. `tsc --noEmit` + 프로덕션 빌드 통과.
2. 조립 로직 순수함수 자체점검(노드): `visibleSteps`가 `showIf` 분기를 정확히 반영, `assemblePrompt`가 basePrompt+선택조각을 순서대로 결합, 미답/조건부 단계 처리, `surveyToPlan` name/요약 매핑.
3. **시스템 프롬프트 변형**: `variant: 'survey'`가 `SURVEY_SYSTEM_PROMPT`를 사용하고, 누락/잘못된 `variant`는 `'default'`로 폴백. 클라이언트가 보낸 임의 `system`은 여전히 무시.
4. **생성 품질(육안)**: 종류별 대표 답안 1~2개로 실제 생성 → "켜자마자 즐길 수 있는 완성형"인지 확인(빈 화면·미완성 아님).
5. 브라우저: `/easy`에서 종류 선택 → 7~8단계(조건부 포함) 진행 → 진행표시·요약 갱신 → "만들기" → 기존 미리보기에 결과 표시 → 공유(업로드)까지 동작. 콘솔 에러 0.
6. 기존 텍스트 생성기·게시판 회귀 없음(생성 경로는 variant 추가만, 미리보기·게시판·규칙 불변).

## 비범위(추후)
- TTS/음성 읽어주기, 비로그인 체험 모드.
- 종류 7개 추가분(엔진 완성 후 설정으로 점진 — 같은 패턴).
- 선택지 기반 재편집(현재는 결과를 기존 텍스트 편집기로 수정 또는 마법사 재실행).
- 관리자용 설문 설정 편집 UI(현재 종류 설정은 코드 내 TS 파일).
