# 선택지형 저학년 코딩 모드 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타이핑 없이 "선택지(클릭)"로 프로그램의 의도·로직을 설계하면, 선택이 프롬프트로 조립돼 기존 AI 생성·미리보기·게시판 파이프라인으로 결과를 만드는 저학년 모드(`/easy`).

**Architecture:** 데이터-주도 설문(종류별 7~8단계, 조건부 `showIf`) → 순수 조립 함수가 `basePrompt`+선택 `promptFragment`를 프롬프트로 결합 → 서버가 `variant='survey'` 키로 선택지 전용 시스템 프롬프트 사용 → 기존 `/api/generate`·`FullscreenFrame`·`UploadDialog` 재사용.

**Tech Stack:** Next.js 15 App Router · React · TypeScript · Tailwind v4 · Firebase · Gemini.

**검증 도구 주의:** 단위 테스트 러너·tsx 없음. 검증 = `./node_modules/.bin/tsc --noEmit`(dev 띄운 채 안전) + 순수 유틸은 임시 tsconfig로 단독 컴파일 후 node 자체점검 + 브라우저(코디네이터/유저). dev 실행 중 `npm run build` 금지. `npx tsc`/`npx tsx` 금지. git은 repo 루트 `C:/Users/amh47/Documents/test`에서. 현재 브랜치 `feature/survey-coding`. 일회성 `.mjs`/`.selftest-*`는 미커밋. 커밋 footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 파일 구조
- 신규 `lib/survey/types.ts` — SurveyOption/SurveyStep/ProgramType/SurveyAnswers.
- 신규 `lib/survey/assemble.ts` — 순수: visibleSteps/assemblePrompt/surveyToPlan/surveyProgress.
- 신규 `lib/survey/programs/{paint,quiz,card}.ts` + `index.ts`(레지스트리).
- 수정 `lib/ai/prompts.ts` — SURVEY_SYSTEM_PROMPT + SYSTEM_PROMPTS 맵.
- 수정 `app/api/generate/route.ts` — variant 화이트리스트로 시스템 프롬프트 선택.
- 수정 `lib/client/generate.ts` — requestGenerate에 variant 인자.
- 신규 `components/survey/{TypePicker,StepScreen,SurveySummary,SurveyWizard}.tsx`.
- 신규 `app/easy/page.tsx`.
- 수정 `components/common/Header.tsx` — "골라서 만들기" 네비 링크.

---

## Task 1: 설문 타입 + 순수 조립 + 자체점검

**Files:** Create `lib/survey/types.ts`, `lib/survey/assemble.ts`; self-test(미커밋) `scripts/selftest-survey.mjs`.

- [ ] **Step 1: 타입 정의** — `lib/survey/types.ts`:
```ts
export type SurveyAnswers = Record<string, string | string[]>;

export interface SurveyOption {
  id: string;
  label: string;
  icon?: string;
  /** 이 선택이 생성 프롬프트에 더하는 자연어 조각 */
  promptFragment: string;
}

export interface SurveyStep {
  id: string;
  question: string;
  options: SurveyOption[];
  multi?: boolean;
  /** 조건부 단계: 이전 답에 따라 노출 여부. 없으면 항상 노출. */
  showIf?: (a: SurveyAnswers) => boolean;
}

export interface ProgramType {
  id: string;
  label: string;
  icon: string;
  basePrompt: string;
  steps: SurveyStep[];
  buildName: (a: SurveyAnswers) => string;
}
```

- [ ] **Step 2: 순수 조립 함수** — `lib/survey/assemble.ts`:
```ts
import type { PlanFields } from '@/lib/firebase/types';
import type { ProgramType, SurveyAnswers, SurveyStep } from './types';

/** showIf를 적용해 현재 답 기준 실제 노출 단계 */
export function visibleSteps(type: ProgramType, answers: SurveyAnswers): SurveyStep[] {
  return type.steps.filter((s) => !s.showIf || s.showIf(answers));
}

function selectedOptions(step: SurveyStep, answers: SurveyAnswers) {
  const a = answers[step.id];
  const ids = Array.isArray(a) ? a : a ? [a] : [];
  return step.options.filter((o) => ids.includes(o.id));
}

/** basePrompt + 노출 단계의 선택 조각들을 순서대로 결합 */
export function assemblePrompt(type: ProgramType, answers: SurveyAnswers): string {
  const parts: string[] = [type.basePrompt];
  for (const step of visibleSteps(type, answers)) {
    for (const opt of selectedOptions(step, answers)) {
      if (opt.promptFragment) parts.push(opt.promptFragment);
    }
  }
  return parts.join(' ');
}

/** 게시판 저장/호환용 PlanFields. name=buildName, etc=선택 요약. */
export function surveyToPlan(type: ProgramType, answers: SurveyAnswers): PlanFields {
  const chosen = visibleSteps(type, answers).flatMap((s) =>
    selectedOptions(s, answers).map((o) => `${s.question} → ${o.label}`),
  );
  return {
    name: type.buildName(answers),
    look: '',
    usage: '',
    how: '',
    etc: `[${type.label}] 선택으로 만든 작품\n` + chosen.join('\n'),
  };
}

/** 진행률(노출 단계 기준). answered=답한 노출단계, total=전체 노출단계. */
export function surveyProgress(
  type: ProgramType,
  answers: SurveyAnswers,
): { answered: number; total: number } {
  const steps = visibleSteps(type, answers);
  const answered = steps.filter((s) => {
    const a = answers[s.id];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }).length;
  return { answered, total: steps.length };
}
```

- [ ] **Step 3: 자체점검 스크립트(미커밋)** — `scripts/selftest-survey.mjs`:
```js
import assert from 'node:assert';
import { visibleSteps, assemblePrompt, surveyToPlan, surveyProgress } from '../.selftest-build/lib/survey/assemble.js';

const type = {
  id: 't', label: '테스트', icon: '🧪',
  basePrompt: '기본설명.',
  buildName: (a) => '이름:' + (a.bg ?? '없음'),
  steps: [
    { id: 'bg', question: '배경?', options: [
      { id: 'white', label: '하양', promptFragment: '배경 하양.' },
      { id: 'dark', label: '어둠', promptFragment: '배경 어둠.' } ] },
    { id: 'glow', question: '빛나게?', showIf: (a) => a.bg === 'dark',
      options: [{ id: 'yes', label: '응', promptFragment: '네온처럼 빛나게.' }] },
  ],
};

// 조건부: bg=white면 glow 단계 숨김
assert.deepEqual(visibleSteps(type, { bg: 'white' }).map((s) => s.id), ['bg'], 'white→glow 숨김');
assert.deepEqual(visibleSteps(type, { bg: 'dark' }).map((s) => s.id), ['bg', 'glow'], 'dark→glow 노출');

assert.equal(assemblePrompt(type, { bg: 'dark', glow: 'yes' }), '기본설명. 배경 어둠. 네온처럼 빛나게.', '조립 순서');
assert.equal(assemblePrompt(type, { bg: 'white' }), '기본설명. 배경 하양.', '미답 단계 제외');

const plan = surveyToPlan(type, { bg: 'dark', glow: 'yes' });
assert.equal(plan.name, '이름:dark');
assert.ok(plan.etc.includes('배경? → 어둠') && plan.etc.includes('빛나게? → 응'), '요약');

assert.deepEqual(surveyProgress(type, { bg: 'dark' }), { answered: 1, total: 2 }, '진행률(분기 반영)');
assert.deepEqual(surveyProgress(type, { bg: 'white' }), { answered: 1, total: 1 }, '진행률(분기 숨김)');

console.log('SELFTEST_SURVEY_OK');
```

- [ ] **Step 4: 임시 tsconfig로 컴파일 → node 실행** — `ai-program-generator/.selftest-tsconfig.json` 생성(미커밋):
```json
{
  "compilerOptions": {
    "target": "es2020", "module": "es2020", "moduleResolution": "node",
    "baseUrl": ".", "paths": { "@/*": ["./*"] },
    "skipLibCheck": true, "rootDir": ".", "outDir": ".selftest-build"
  },
  "files": ["lib/survey/assemble.ts"]
}
```
`ai-program-generator/`에서:
```bash
./node_modules/.bin/tsc -p .selftest-tsconfig.json
node scripts/selftest-survey.mjs
rm -rf .selftest-build .selftest-tsconfig.json
```
Expected: `SELFTEST_SURVEY_OK`. (assemble.ts의 import는 전부 `import type`이라 emit 시 제거 → 단독 실행 가능.)

- [ ] **Step 5: 전체 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 6: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/lib/survey/types.ts ai-program-generator/lib/survey/assemble.ts
git commit -m "$(printf 'feat(survey): 설문 타입 + 순수 조립(visibleSteps/assemblePrompt/surveyToPlan/surveyProgress)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: 선택지 전용 시스템 프롬프트 + variant 라우팅

**Files:** Modify `lib/ai/prompts.ts`, `app/api/generate/route.ts`, `lib/client/generate.ts`.

- [ ] **Step 1: `lib/ai/prompts.ts`에 SURVEY 프롬프트 + 맵 추가** — 파일 끝(기존 `DEFAULT_SYSTEM_PROMPT` 아래)에 추가:
```ts
// 선택지형(저학년) 전용 시스템 프롬프트. 기존 제약을 계승하되, 빈약한 선택 입력을
// 합리적 기본값으로 풍부히 완성하도록 강하게 지시한다.
export const SURVEY_SYSTEM_PROMPT = `당신은 전문 웹 개발자입니다. 한국 초등학교 저학년 학생이 '선택지(설문)'로 설계한 간단한 의도를 받아, 웹페이지용 JSON 객체를 생성합니다. JSON 객체에는 "html", "css", "javascript" 세 개의 키가 있어야 합니다.
- "html": 바디(body)에 들어갈 HTML 콘텐츠. \`<html>\`, \`<head>\`, \`<body>\`, \`<style>\`, \`<script>\` 태그는 포함하지 마세요.
- "css": 깔끔하고 보기 좋은 모든 CSS. 어두운 배경이면 모든 텍스트를 밝은 색으로 해 대비를 확실히 하세요.
- "javascript": 상호작용에 필요한 모든 JavaScript.

**실행 환경 제약 (반드시 지킬 것)**:
1. \`alert\`, \`confirm\`, \`prompt\` 사용 금지 — 메시지·확인·입력은 화면 안의 HTML 요소로 구현하세요.
2. \`localStorage\`/\`sessionStorage\`는 try-catch로 감싸고, 실패하면 일반 변수(메모리)로 대체해 동작을 이어가세요.
3. \`while(true)\` 같은 블로킹 무한 루프 금지 — 반복 동작은 \`requestAnimationFrame\`/\`setInterval\` 사용.

**선택지 모드 핵심 지시 (가장 중요)**:
- 입력은 저학년이 '선택지'로 고른 간단한 의도라 빈약할 수 있습니다. 부족한 세부(레이아웃·예시 데이터·점수 규칙·색·문구 등)는 **합리적이고 안전한 기본값으로 풍부하게 채워, '켜자마자 바로 즐길 수 있는 완성형'으로** 만드세요. 빈 화면·설명만 있는 화면·미완성 결과는 금지합니다.
- 글씨와 버튼은 큼직하게, 색은 밝고 친근하게, 휴대폰에서도 잘 보이게 반응형으로. 조작은 단순하고 관대하게(클릭 위주, 실수해도 깨지지 않게). 화면의 모든 한국어는 저학년이 읽을 수 있는 아주 쉬운 말로.

**이미지/사운드**: 아이콘·캐릭터·간단한 그래픽은 외부 이미지 대신 **SVG**나 \`<canvas>\`/CSS로 코드로 그리세요. 소리는 외부 파일 대신 **Web Audio API**로 간단한 레트로풍 사운드를 생성하세요.

**코드 형식**: 사람이 읽고 배우기 좋게 들여쓰기·줄바꿈을 포함해 정돈되게(한 줄로 뭉치지 말 것). 각 항목 15만 자 이내.

최종 결과물은 세 부분을 합쳤을 때 완벽히 작동하는 하나의 웹페이지여야 합니다. 오직 순수한 JSON 객체만 출력하고, 다른 설명이나 마크다운은 추가하지 마세요.`;

export type SystemPromptVariant = 'default' | 'survey';

export const SYSTEM_PROMPTS: Record<SystemPromptVariant, string> = {
  default: DEFAULT_SYSTEM_PROMPT,
  survey: SURVEY_SYSTEM_PROMPT,
};
```

- [ ] **Step 2: `/api/generate`가 variant로 시스템 프롬프트 선택** — `app/api/generate/route.ts`:

import 교체:
```ts
import { SYSTEM_PROMPTS, type SystemPromptVariant } from '@/lib/ai/prompts';
```
(`DEFAULT_SYSTEM_PROMPT` import 줄은 제거.)

본문 파싱부(`const { prompt, mode } = ...`)를 variant 포함으로:
```ts
  // system 텍스트는 클라이언트가 보내도 무시(주입 차단). 대신 variant 키로 서버가 선택.
  const { prompt, mode, variant } = (body ?? {}) as {
    prompt?: unknown;
    mode?: unknown;
    variant?: unknown;
  };
  const promptVariant: SystemPromptVariant = variant === 'survey' ? 'survey' : 'default';
```

생성 호출의 system을 교체:
```ts
    const code = await provider.generate({ prompt, system: SYSTEM_PROMPTS[promptVariant], mode });
```

- [ ] **Step 3: `requestGenerate`에 variant 인자** — `lib/client/generate.ts`:
```ts
import { auth } from '@/lib/firebase/client';
import type { GeneratedCode, GenerateMode } from '@/lib/ai/types';
import type { SystemPromptVariant } from '@/lib/ai/prompts';

/** 클라이언트에서 /api/generate 를 호출하는 헬퍼 (로그인 필수) */
export async function requestGenerate(
  prompt: string,
  mode: GenerateMode,
  variant: SystemPromptVariant = 'default',
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
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
  }
  return data as GeneratedCode;
}
```
(기존 `requestGenerate(prompt, mode)` 호출부는 인자 기본값 덕에 변경 불필요.)

- [ ] **Step 4: 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 5: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/lib/ai/prompts.ts ai-program-generator/app/api/generate/route.ts ai-program-generator/lib/client/generate.ts
git commit -m "$(printf 'feat(ai): 선택지 전용 SURVEY_SYSTEM_PROMPT + variant 라우팅(서버 선택, 주입 차단 유지)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: 종류 설정 3종 + 레지스트리

**Files:** Create `lib/survey/programs/paint.ts`, `quiz.ts`, `card.ts`, `index.ts`.

> 작성 가이드: `promptFragment`는 명령형·구체·짧게, 서로 모순 없게. 각 종류 7~8단계 권장(일부 `showIf`). 아래는 **그대로 사용 가능한 완성 설정**이며, 더 풍부히 하려면 같은 패턴으로 옵션을 추가한다.

- [ ] **Step 1: 그림판** — `lib/survey/programs/paint.ts`:
```ts
import type { ProgramType } from '../types';

export const paint: ProgramType = {
  id: 'paint',
  label: '그림판',
  icon: '🎨',
  basePrompt:
    '마우스(또는 손가락)로 자유롭게 그림을 그릴 수 있는 그림판 웹 프로그램을 만들어줘. 색을 고르는 팔레트와 지우개, 전체 지우기 버튼을 포함해.',
  buildName: () => '나의 그림판',
  steps: [
    {
      id: 'bg',
      question: '어떤 종이에 그릴까?',
      options: [
        { id: 'white', label: '하얀 종이', icon: '🤍', promptFragment: '캔버스 배경은 하얀색.' },
        { id: 'board', label: '까만 칠판', icon: '🟩', promptFragment: '캔버스 배경은 어두운 칠판색이고 기본 그림색은 밝게.' },
        { id: 'sky', label: '하늘색', icon: '🩵', promptFragment: '캔버스 배경은 연한 하늘색.' },
      ],
    },
    {
      id: 'brush',
      question: '어떤 붓으로 그릴까?',
      options: [
        { id: 'pen', label: '얇은 펜', icon: '🖊️', promptFragment: '기본 붓은 얇은 펜.' },
        { id: 'crayon', label: '굵은 크레용', icon: '🖍️', promptFragment: '기본 붓은 굵은 크레용 느낌.' },
        { id: 'spray', label: '스프레이', icon: '💨', promptFragment: '기본 붓은 점이 퍼지는 스프레이.' },
      ],
    },
    {
      id: 'rainbow',
      question: '무지개 색도 넣을까?',
      showIf: (a) => a.brush === 'crayon',
      options: [
        { id: 'yes', label: '응, 알록달록!', icon: '🌈', promptFragment: '그릴 때 색이 무지개처럼 점점 바뀌는 무지개 모드 버튼을 추가해.' },
        { id: 'no', label: '아니, 한 색', icon: '🎯', promptFragment: '' },
      ],
    },
    {
      id: 'palette',
      question: '어떤 색들을 쓸까?',
      options: [
        { id: 'basic', label: '기본 색', icon: '🔴', promptFragment: '빨강·파랑·노랑·검정·흰색 기본 팔레트.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '연한 파스텔 색 팔레트.' },
        { id: 'neon', label: '형광', icon: '⚡', promptFragment: '쨍한 형광색 팔레트.' },
      ],
    },
    {
      id: 'size',
      question: '붓 굵기를 바꿀 수 있게 할까?',
      options: [
        { id: 'slider', label: '응, 조절 막대', icon: '🎚️', promptFragment: '붓 굵기를 바꾸는 슬라이더를 넣어.' },
        { id: 'fixed', label: '아니, 그대로', icon: '✋', promptFragment: '' },
      ],
    },
    {
      id: 'stamp',
      question: '도장 찍기도 넣을까?',
      options: [
        { id: 'star', label: '별 도장', icon: '⭐', promptFragment: '클릭하면 별이 찍히는 도장 버튼을 추가해.' },
        { id: 'heart', label: '하트 도장', icon: '💗', promptFragment: '클릭하면 하트가 찍히는 도장 버튼을 추가해.' },
        { id: 'none', label: '없어도 돼', icon: '🚫', promptFragment: '' },
      ],
    },
    {
      id: 'save',
      question: '내 그림을 저장하는 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 저장 버튼', icon: '💾', promptFragment: '그림을 이미지로 저장(다운로드)하는 버튼을 넣어.' },
        { id: 'no', label: '아니', icon: '🚫', promptFragment: '' },
      ],
    },
  ],
};
```

- [ ] **Step 2: 퀴즈** — `lib/survey/programs/quiz.ts`:
```ts
import type { ProgramType } from '../types';

export const quiz: ProgramType = {
  id: 'quiz',
  label: '퀴즈',
  icon: '❓',
  basePrompt:
    '문제를 하나씩 보여주고 보기 중에 답을 고르면 맞았는지 알려주는 퀴즈 게임 웹 프로그램을 만들어줘. 점수를 세고 마지막에 결과를 보여줘. 문제는 예시로 5개 정도 채워 넣어.',
  buildName: (a) => (typeof a.topic === 'string' ? `${a.topic} 퀴즈` : '나의 퀴즈'),
  steps: [
    {
      id: 'topic',
      question: '무엇에 대한 퀴즈일까?',
      options: [
        { id: 'animal', label: '동물', icon: '🐶', promptFragment: '동물에 대한 쉬운 퀴즈 문제로 채워줘.' },
        { id: 'food', label: '음식', icon: '🍎', promptFragment: '음식에 대한 쉬운 퀴즈 문제로 채워줘.' },
        { id: 'math', label: '숫자·더하기', icon: '➕', promptFragment: '한 자리 수 더하기·빼기 같은 쉬운 숫자 퀴즈로 채워줘.' },
        { id: 'mix', label: '이것저것', icon: '🎲', promptFragment: '동물·음식·생활 상식이 섞인 쉬운 퀴즈로 채워줘.' },
      ],
    },
    {
      id: 'answer',
      question: '답은 어떻게 고를까?',
      options: [
        { id: 'ox', label: 'O / X', icon: '⭕', promptFragment: '각 문제는 O/X 두 개 버튼으로 답해.' },
        { id: 'choice', label: '보기 중 고르기', icon: '🔢', promptFragment: '각 문제는 보기 3~4개 버튼 중에 답을 골라.' },
      ],
    },
    {
      id: 'feedback',
      question: '맞히면 어떤 반응을 줄까?',
      options: [
        { id: 'sound', label: '소리', icon: '🔊', promptFragment: '정답이면 기분 좋은 소리, 오답이면 부드러운 소리를 Web Audio로 내줘.' },
        { id: 'emoji', label: '큰 이모지', icon: '🎉', promptFragment: '정답이면 화면에 큰 축하 효과(이모지/색종이)를 잠깐 보여줘.' },
        { id: 'both', label: '둘 다!', icon: '✨', promptFragment: '정답이면 소리와 큰 축하 효과를 함께 보여줘.' },
      ],
    },
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        { id: 'yes', label: '응, 10초', icon: '⏱️', promptFragment: '각 문제에 10초 제한 시간과 줄어드는 시간 막대를 넣어.' },
        { id: 'no', label: '아니, 천천히', icon: '🐢', promptFragment: '시간 제한 없이 천천히 풀 수 있게 해.' },
      ],
    },
    {
      id: 'end',
      question: '다 풀면 무엇을 보여줄까?',
      options: [
        { id: 'score', label: '점수와 칭찬', icon: '🏆', promptFragment: '마지막에 점수와 칭찬 메시지, 다시하기 버튼을 보여줘.' },
        { id: 'medal', label: '메달', icon: '🥇', promptFragment: '마지막에 점수에 따라 금·은·동 메달과 다시하기 버튼을 보여줘.' },
      ],
    },
    {
      id: 'hard',
      question: '문제를 점점 어렵게 할까?',
      showIf: (a) => a.topic === 'math',
      options: [
        { id: 'yes', label: '응, 점점 크게', icon: '📈', promptFragment: '뒤로 갈수록 숫자가 조금씩 커지게 난이도를 올려줘.' },
        { id: 'no', label: '아니, 비슷하게', icon: '➖', promptFragment: '' },
      ],
    },
  ],
};
```

- [ ] **Step 3: 소개·인사 카드** — `lib/survey/programs/card.ts`:
```ts
import type { ProgramType } from '../types';

export const card: ProgramType = {
  id: 'card',
  label: '소개·인사 카드',
  icon: '💌',
  basePrompt:
    '나를 소개하거나 친구에게 인사를 전하는 예쁜 한 페이지 카드 웹 프로그램을 만들어줘. 화면 가운데에 카드가 보이고 꾸밈 요소가 어울리게 배치돼.',
  buildName: () => '나의 소개 카드',
  steps: [
    {
      id: 'kind',
      question: '어떤 카드를 만들까?',
      options: [
        { id: 'me', label: '내 소개', icon: '🙋', promptFragment: '내 이름·좋아하는 것을 소개하는 카드.' },
        { id: 'hello', label: '인사·축하', icon: '🎈', promptFragment: '친구에게 인사·축하를 전하는 카드.' },
      ],
    },
    {
      id: 'theme',
      question: '카드 분위기는?',
      options: [
        { id: 'cute', label: '귀엽게', icon: '🧸', promptFragment: '둥글둥글 귀여운 분위기와 파스텔 색.' },
        { id: 'cool', label: '멋있게', icon: '🦖', promptFragment: '쨍하고 멋있는 분위기와 진한 색.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '밤하늘·별·우주 분위기.' },
      ],
    },
    {
      id: 'deco',
      question: '무엇으로 꾸밀까?',
      multi: true,
      options: [
        { id: 'balloon', label: '풍선', icon: '🎈', promptFragment: '떠다니는 풍선 장식을 넣어.' },
        { id: 'star', label: '반짝이 별', icon: '✨', promptFragment: '반짝이는 별 장식을 넣어.' },
        { id: 'flower', label: '꽃', icon: '🌷', promptFragment: '꽃 장식을 넣어.' },
      ],
    },
    {
      id: 'motion',
      question: '움직임을 넣을까?',
      options: [
        { id: 'float', label: '둥둥 떠다니게', icon: '🫧', promptFragment: '장식이 천천히 둥둥 떠다니는 애니메이션을 넣어.' },
        { id: 'pop', label: '눌러서 효과', icon: '👆', promptFragment: '카드를 누르면 색종이가 터지는 효과를 넣어.' },
        { id: 'none', label: '조용하게', icon: '🤫', promptFragment: '' },
      ],
    },
    {
      id: 'music',
      question: '소리도 넣을까?',
      options: [
        { id: 'yes', label: '응, 짧은 멜로디', icon: '🎵', promptFragment: '카드를 열거나 누르면 Web Audio로 짧고 밝은 멜로디가 나게 해.' },
        { id: 'no', label: '아니', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'name',
      question: '카드에 이름을 적는 칸을 넣을까?',
      options: [
        { id: 'yes', label: '응, 적을래', icon: '✏️', promptFragment: '카드 위에서 직접 이름과 한 줄 메시지를 입력해 바꿀 수 있는 칸을 넣어.' },
        { id: 'no', label: '아니, 그림만', icon: '🖼️', promptFragment: '' },
      ],
    },
  ],
};
```

- [ ] **Step 4: 레지스트리** — `lib/survey/programs/index.ts`:
```ts
import type { ProgramType } from '../types';
import { paint } from './paint';
import { quiz } from './quiz';
import { card } from './card';

/** v1 종류 목록(순서 = 종류 선택 화면 노출 순서). 추가 종류는 여기에 import해 넣으면 됨. */
export const PROGRAM_TYPES: ProgramType[] = [paint, quiz, card];

export function getProgramType(id: string): ProgramType | undefined {
  return PROGRAM_TYPES.find((t) => t.id === id);
}
```

- [ ] **Step 5: 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 6: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/lib/survey/programs/
git commit -m "$(printf 'feat(survey): v1 종류 설정 3종(그림판/퀴즈/소개카드) + 레지스트리\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: 설문 UI 부품 (TypePicker · StepScreen · SurveySummary)

**Files:** Create `components/survey/TypePicker.tsx`, `StepScreen.tsx`, `SurveySummary.tsx`.

- [ ] **Step 1: 종류 선택** — `components/survey/TypePicker.tsx`:
```tsx
'use client';

import type { ProgramType } from '@/lib/survey/types';

export default function TypePicker({
  types,
  onPick,
}: {
  types: ProgramType[];
  onPick: (type: ProgramType) => void;
}) {
  return (
    <div className="anim-pop-in">
      <h2 className="text-center text-[26px]">무엇을 만들까?</h2>
      <p className="mt-1 mb-6 text-center text-[16px] text-muted">만들고 싶은 걸 골라요</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="press lift flex flex-col items-center gap-2 rounded-[var(--r-lg)] border-2 border-line bg-surface p-6 hover:border-brand/60"
          >
            <span className="text-[56px] leading-none" aria-hidden>{t.icon}</span>
            <span className="text-[18px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 한 단계 화면** — `components/survey/StepScreen.tsx`:
```tsx
'use client';

import type { SurveyStep } from '@/lib/survey/types';

export default function StepScreen({
  step,
  index,
  total,
  value,
  onChoose,
}: {
  step: SurveyStep;
  index: number; // 0-based 현재 단계
  total: number;
  value: string | string[] | undefined;
  onChoose: (optionId: string) => void; // 단일: 즉시 진행 / 다중: 토글
}) {
  const selected = (id: string) =>
    Array.isArray(value) ? value.includes(id) : value === id;

  return (
    <div className="anim-pop-in">
      {/* 진행 표시 */}
      <div className="mb-5 flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i <= index ? 'bg-brand' : 'bg-surface-2'}`}
          />
        ))}
        <span className="ml-2 shrink-0 text-[14px] text-muted">
          {index + 1} / {total}
        </span>
      </div>

      <h2 className="mb-5 text-[24px]">{step.question}</h2>
      {step.multi && <p className="mb-3 -mt-3 text-[14px] text-muted">여러 개 골라도 돼요</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChoose(o.id)}
            className={`press flex items-center gap-3 rounded-[var(--r-lg)] border-2 p-4 text-left ${
              selected(o.id)
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-surface hover:border-brand/50'
            }`}
          >
            {o.icon && <span className="text-[34px] leading-none" aria-hidden>{o.icon}</span>}
            <span className="text-[18px] font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: "내가 고른 것" 요약** — `components/survey/SurveySummary.tsx`:
```tsx
'use client';

import type { ProgramType, SurveyAnswers, SurveyStep } from '@/lib/survey/types';

export default function SurveySummary({
  type,
  steps,
  answers,
}: {
  type: ProgramType;
  steps: SurveyStep[]; // 현재 노출 단계
  answers: SurveyAnswers;
}) {
  const labelOf = (step: SurveyStep): string => {
    const a = answers[step.id];
    const ids = Array.isArray(a) ? a : a ? [a] : [];
    const labels = step.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
    return labels.join(', ');
  };

  return (
    <div className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
      <p className="mb-2 text-[14px] font-medium text-muted">🧺 내가 고른 것</p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-brand-soft px-3 py-1 text-[14px] text-brand-strong dark:text-brand">
          {type.icon} {type.label}
        </span>
        {steps.map((s) => {
          const v = labelOf(s);
          return (
            <span
              key={s.id}
              className={`rounded-full px-3 py-1 text-[14px] ${
                v ? 'bg-surface-2 text-ink' : 'border-2 border-dashed border-line text-muted'
              }`}
            >
              {v || '?'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 5: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/survey/TypePicker.tsx ai-program-generator/components/survey/StepScreen.tsx ai-program-generator/components/survey/SurveySummary.tsx
git commit -m "$(printf 'feat(survey): 설문 UI 부품(TypePicker·StepScreen·SurveySummary)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: 마법사 오케스트레이터 + /easy 라우트

**Files:** Create `components/survey/SurveyWizard.tsx`, `app/easy/page.tsx`.

- [ ] **Step 1: 마법사** — `components/survey/SurveyWizard.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw, Wand2 } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import type { ProgramType, SurveyAnswers } from '@/lib/survey/types';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import { visibleSteps, assemblePrompt, surveyToPlan } from '@/lib/survey/assemble';
import { requestGenerate } from '@/lib/client/generate';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginDialog from '@/components/auth/LoginDialog';
import UploadDialog from '@/components/board/UploadDialog';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import TypePicker from './TypePicker';
import StepScreen from './StepScreen';
import SurveySummary from './SurveySummary';

const EMPTY_CODE: GeneratedCode = { html: '', css: '', javascript: '' };

export default function SurveyWizard() {
  const [type, setType] = useState<ProgramType | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [stepIdx, setStepIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<GeneratedCode>(EMPTY_CODE);
  const [previewKey, setPreviewKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const steps = useMemo(() => (type ? visibleSteps(type, answers) : []), [type, answers]);
  const hasCode = Boolean(code.html || code.css || code.javascript);

  function pickType(t: ProgramType) {
    setType(t);
    setAnswers({});
    setStepIdx(0);
    setCode(EMPTY_CODE);
  }

  function choose(optionId: string) {
    if (!type) return;
    const step = steps[stepIdx];
    if (step.multi) {
      // 다중: 토글, 자동 진행 안 함
      setAnswers((prev) => {
        const cur = Array.isArray(prev[step.id]) ? (prev[step.id] as string[]) : [];
        const next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
        return { ...prev, [step.id]: next };
      });
      return;
    }
    // 단일: 선택 후 다음 단계로
    setAnswers((prev) => ({ ...prev, [step.id]: optionId }));
    setStepIdx((i) => i + 1);
  }

  function back() {
    if (stepIdx === 0) {
      setType(null);
      return;
    }
    setStepIdx((i) => Math.max(0, i - 1));
  }

  function reset() {
    setType(null);
    setAnswers({});
    setStepIdx(0);
    setCode(EMPTY_CODE);
  }

  async function generate() {
    if (!type) return;
    if (authLoading) return toast('잠깐만요, 준비 중이에요…');
    if (!user) {
      toast('로그인하면 만들 수 있어요!');
      setLoginOpen(true);
      return;
    }
    setBusy(true);
    try {
      const prompt = assemblePrompt(type, answers);
      const result = await requestGenerate(prompt, 'generate', 'survey');
      setCode(result);
      setPreviewKey((k) => k + 1);
      toast('우와! 멋진 걸 만들었어요!', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '만들다가 문제가 생겼어요. 다시 해볼까요?');
    } finally {
      setBusy(false);
    }
  }

  // 결과 화면
  if (hasCode && type) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-[22px]">{type.icon} {type.label} 완성!</h2>
          <div className="flex gap-2">
            <Button variant="soft" onClick={reset}><RotateCcw size={17} aria-hidden /> 새로 만들기</Button>
            <Button variant="primary" onClick={() => (user ? setUploadOpen(true) : setLoginOpen(true))}>
              자랑하기
            </Button>
          </div>
        </div>
        <FullscreenFrame
          frameKey={previewKey}
          code={code}
          title={type.label}
          className="min-h-[70vh] w-full overflow-hidden rounded-[var(--r-md)] border-2 border-line"
        />
        <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
        <UploadDialog
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          code={code}
          plan={surveyToPlan(type, answers)}
          prompt={assemblePrompt(type, answers)}
          defaultTitle={type.buildName(answers)}
        />
      </div>
    );
  }

  // 생성 중
  if (busy) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <LoadingDots label="고른 대로 만드는 중…" />
      </div>
    );
  }

  // 종류 선택
  if (!type) {
    return (
      <div className="mx-auto max-w-2xl">
        <TypePicker types={PROGRAM_TYPES} onPick={pickType} />
      </div>
    );
  }

  // 단계 진행 또는 "만들기"
  const onLastDone = stepIdx >= steps.length;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <button onClick={back} className="press inline-flex w-fit items-center gap-1 text-[15px] text-muted hover:text-ink">
        <ArrowLeft size={18} aria-hidden /> 뒤로
      </button>

      {onLastDone ? (
        <div className="anim-pop-in text-center">
          <h2 className="text-[24px]">다 골랐어요! 만들어 볼까요?</h2>
          <p className="mt-1 text-[16px] text-muted">고른 대로 AI가 만들어 줄 거예요</p>
          <Button variant="primary" size="lg" onClick={generate} className="mt-6">
            <Wand2 size={21} aria-hidden /> 만들기!
          </Button>
        </div>
      ) : (
        <>
          <StepScreen
            step={steps[stepIdx]}
            index={stepIdx}
            total={steps.length}
            value={answers[steps[stepIdx].id]}
            onChoose={choose}
          />
          {steps[stepIdx].multi && (
            <Button variant="primary" onClick={() => setStepIdx((i) => i + 1)} className="w-fit self-end">
              다음
            </Button>
          )}
        </>
      )}

      <SurveySummary type={type} steps={steps} answers={answers} />
    </div>
  );
}
```

> 참고: 단일 선택은 `choose`에서 자동으로 다음 단계로 넘어가고, 다중(`multi`) 단계만 "다음" 버튼으로 진행한다. `steps`는 답이 바뀔 때마다 `visibleSteps`로 재계산되어 조건부 분기가 자연히 반영된다. `stepIdx >= steps.length`면 "만들기" 화면.

- [ ] **Step 2: 라우트** — `app/easy/page.tsx`:
```tsx
import Header from '@/components/common/Header';
import SurveyWizard from '@/components/survey/SurveyWizard';

export default function EasyPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 sm:p-6">
        <SurveyWizard />
      </div>
    </main>
  );
}
```
(active 하이라이트는 Task 6에서 `active="survey"`로 연결 — 이 태스크는 `Header` 타입을 건드리지 않아 단독 tsc-green.)

- [ ] **Step 3: 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 4: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/survey/SurveyWizard.tsx ai-program-generator/app/easy/page.tsx
git commit -m "$(printf 'feat(survey): 마법사 오케스트레이터 + /easy 라우트(생성·미리보기·공유 재사용)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: 진입점 (헤더 "골라서 만들기" 링크)

**Files:** Modify `components/common/Header.tsx`.

- [ ] **Step 1: 헤더에 `/easy` 링크 추가 + active 타입 확장** — `components/common/Header.tsx`:

(a) lucide import에 아이콘 추가:
```ts
import { Wand2, LayoutGrid, MousePointerClick } from 'lucide-react';
```
(b) `active` prop 타입 확장:
```ts
export default function Header({ active }: { active?: 'creator' | 'board' | 'survey' }) {
```
(c) "만들기" `GlowNavLink` 다음에 추가:
```tsx
          <GlowNavLink href="/easy" active={active === 'survey'}>
            <span className="hover-wiggle grid place-items-center" aria-hidden>
              <MousePointerClick size={17} />
            </span>
            골라서 만들기
          </GlowNavLink>
```

- [ ] **Step 2: /easy 페이지가 active 하이라이트를 받도록** — `app/easy/page.tsx`의 `<Header />`를 `<Header active="survey" />`로 변경.

- [ ] **Step 3: 타입체크** — `./node_modules/.bin/tsc --noEmit` → 에러 없음.

- [ ] **Step 4: 커밋**
```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/common/Header.tsx ai-program-generator/app/easy/page.tsx
git commit -m "$(printf 'feat(survey): 헤더에 \"골라서 만들기\"(/easy) 진입 링크 + active 하이라이트\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 7: 빌드 + 브라우저 e2e + 생성 품질 확인 + 푸시

- [ ] **Step 1: 타입체크 + 프로덕션 빌드** (dev 중지 후):
```bash
cd C:/Users/amh47/Documents/test/ai-program-generator
./node_modules/.bin/tsc --noEmit
npm run build
```
Expected: 에러 0, 라우트 목록에 `/easy` 포함.

- [ ] **Step 2: 브라우저 e2e** — dev에서 헤더 "골라서 만들기" → `/easy`:
  - 종류 선택(🎨그림판) → 단계들이 한 화면씩 진행, 진행 표시·"내가 고른 것" 요약 갱신.
  - 조건부 확인: 그림판에서 붓 "굵은 크레용" 고르면 "무지개 색?" 단계가 나타나고, 다른 붓이면 안 나타남.
  - 다 고르면 "만들기!" → (로그인 안 했으면 로그인 유도) → 생성 → `FullscreenFrame`에 결과 표시.
  - "자랑하기" → UploadDialog → 게시판 업로드까지.
  - 콘솔 에러 0.

- [ ] **Step 3: 생성 품질 육안 확인** — 그림판·퀴즈·소개카드 각 1회 생성 → "켜자마자 즐길 수 있는 완성형"인지(빈 화면·미완성 아님) 확인. 부족하면 해당 종류 `basePrompt`/조각 또는 `SURVEY_SYSTEM_PROMPT` 문구를 다듬어 재생성.

- [ ] **Step 4: 푸시** (diff 검토 후):
```bash
cd C:/Users/amh47/Documents/test
git status && git log --oneline -8
git push -u origin feature/survey-coding
```

---

## 자체 점검 (작성자용 — 스펙 대비)
- 진입/배치(`/easy` 별도 라우트 + 헤더 링크): Task 5·6 ✓
- 데이터-주도 설문(종류=설정, 7~8단계, 조건부 showIf): Task 1(타입)·Task 3(설정) ✓
- 선택→프롬프트 조립→기존 파이프라인: Task 1(assemble)·Task 5(requestGenerate survey·FullscreenFrame·UploadDialog) ✓
- 선택지 전용 시스템 프롬프트 + variant 서버 선택(주입 차단): Task 2 ✓
- 저학년 UI(큰 카드·진행표시·요약·뒤로/다시): Task 4·5 ✓
- 인증(로그인 필수·일일한도 그대로): Task 5(로그인 유도), 기존 `/api/generate` ✓
- v1 종류 3개(그림판/퀴즈/소개카드), 나머지 점진: Task 3(레지스트리 확장점) ✓
- 검증(순수 자체점검·tsc·빌드·브라우저·variant·품질): Task 1·7 ✓
- 타입 일관성: `SurveyAnswers/SurveyOption/SurveyStep/ProgramType`, `assemblePrompt/visibleSteps/surveyToPlan/surveyProgress`, `requestGenerate(prompt,mode,variant)`, `SYSTEM_PROMPTS['survey']`, `PROGRAM_TYPES/getProgramType` — 전 태스크 동일 시그니처 ✓
