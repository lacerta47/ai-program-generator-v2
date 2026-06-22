# 선택 피드백 사운드 + 효과 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/easy` 선택 탭과 앱 전역의 생성·공유 성공 순간에 가벼운 소리(Web Audio 합성) + 짧은 시각 효과를 더하고, Header의 음소거 토글로 *우리 피드백 사운드만* 끌 수 있게 한다.

**Architecture:** `lib/client/sound.ts`가 AudioContext 싱글턴 + 합성 사운드(`playSelect`/`playSuccess`) + 음소거 상태(localStorage)를 캡슐화. 클라 컴포넌트들이 이벤트 핸들러에서 play 호출. 음소거는 우리 사운드만(미리보기 iframe 무관). 시각 효과는 globals.css `anim-pop-tada`(전역 reduced-motion 가드가 자동 무효화).

**Tech Stack:** Web Audio API(외부 에셋 0), React 클라 컴포넌트, localStorage, Tailwind. 테스트 프레임워크 없음 — 검증은 `tsc --noEmit` + `npm run build` + 브라우저 청취/육안.

**공통:** 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`. git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. tsc `./node_modules/.bin/tsc --noEmit`. dev 실행 중엔 build 금지(.next 공유). 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 브랜치 `feat/sound-feedback`.

---

### Task 1: 사운드 모듈 `lib/client/sound.ts`

**Files:** Create `ai-program-generator/lib/client/sound.ts`

- [ ] **Step 1: 모듈 생성.**
```ts
// 우리 앱의 피드백 사운드(선택·성공)만 담당. Web Audio 합성(외부 에셋 없음).
// 음소거 토글은 우리 사운드만 끈다 — 페이지/미리보기 프로그램(iframe) 소리는 무관.
// 모든 함수는 SSR·미지원·차단 환경에서 안전하게 no-op.

const KEY = 'app-sound-on';
/** 기본 소리 상태. 나중에 기본 끔으로 바꾸려면 이 한 줄만 false. */
const DEFAULT_SOUND_ON = true;

export function isSoundOn(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return DEFAULT_SOUND_ON;
  } catch {
    return DEFAULT_SOUND_ON;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* localStorage 차단 — 무시 */
  }
}

let ctx: AudioContext | null = null;

/** 지연 생성 + resume(첫 사용자 제스처에서 호출되므로 autoplay 정책 충족). 실패 시 null. */
function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 단음 톤 하나를 짧게 재생(클릭팝 방지 위해 게인 엔벨로프). */
function tone(c: AudioContext, freq: number, startAt: number, dur: number, peak: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/** 선택 탭: 짧게 살짝 상승하는 "톡". */
export function playSelect(): void {
  if (!isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.07);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch {
    /* 재생 실패 무시 */
  }
}

/** 성공: 상승 차임 3음(도·미·솔). */
export function playSuccess(): void {
  if (!isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    tone(c, 523, t, 0.14, 0.13);
    tone(c, 659, t + 0.12, 0.14, 0.13);
    tone(c, 784, t + 0.24, 0.2, 0.13);
  } catch {
    /* 재생 실패 무시 */
  }
}
```

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/client/sound.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(sound): Web Audio 피드백 사운드 모듈(playSelect/playSuccess + 음소거)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 음소거 토글 + Header 배치

**Files:** Create `ai-program-generator/components/ui/SoundToggle.tsx`; Modify `ai-program-generator/components/common/Header.tsx`

- [ ] **Step 1: SoundToggle 생성.** (ThemeToggle과 동일 사이즈/룩: `h-11 w-11 border-2 border-line rounded-full`.)
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundOn, setSoundOn, playSelect } from '@/lib/client/sound';

export default function SoundToggle() {
  // SSR/하이드레이션: 초기엔 기본(on)으로 렌더, 마운트 후 실제 저장값으로 보정.
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(isSoundOn());
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundOn(next);
    if (next) playSelect(); // 켤 때 미리듣기
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? '소리 끄기' : '소리 켜기'}
      aria-pressed={on}
      title={on ? '소리 끄기' : '소리 켜기'}
      className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-line bg-surface text-ink hover:border-brand/50"
    >
      {on ? <Volume2 size={19} aria-hidden /> : <VolumeX size={19} aria-hidden />}
    </button>
  );
}
```

- [ ] **Step 2: Header에 배치.** `components/common/Header.tsx`:
  - import 추가: `import SoundToggle from '@/components/ui/SoundToggle';`
  - `<ThemeToggle />` 바로 앞에 `<SoundToggle />` 추가:
    ```tsx
          <SoundToggle />
          <ThemeToggle />
          <AuthButton />
    ```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/components/ui/SoundToggle.tsx ai-program-generator/components/common/Header.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(sound): Header에 음소거 토글(우리 피드백 사운드만)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 성공 시각 효과 키프레임 (globals.css)

**Files:** Modify `ai-program-generator/app/globals.css`

- [ ] **Step 1: 키프레임 + 유틸 추가.** `app/globals.css`에서, 기존 `@keyframes`/애니메이션 유틸이 모인 구역(예: `anim-pop-in` 정의 근처)에 추가:
```css
@keyframes pop-tada {
  0% { transform: scale(0.9); }
  60% { transform: scale(1.06); }
  100% { transform: scale(1); }
}
.anim-pop-tada { animation: pop-tada 360ms ease-out both; }
```
(별도 reduced-motion 가드 불필요 — globals.css의 전역 `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: 0.01ms !important; … } }`가 이미 무효화함.)

- [ ] **Step 2: 타입체크(빌드 영향 없음 확인).** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/globals.css
git -C "C:/Users/amh47/Documents/test" commit -m "feat(sound): 성공 톡 효과 키프레임 anim-pop-tada

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 사운드·효과 연결 (survey / creator / upload)

**Files:** Modify `components/survey/SurveyWizard.tsx`, `components/creator/Creator.tsx`, `components/board/UploadDialog.tsx`

- [ ] **Step 1: SurveyWizard — 선택음 + 성공음.** `components/survey/SurveyWizard.tsx`:
  - import 추가:
    ```ts
    import { playSelect, playSuccess } from '@/lib/client/sound';
    ```
  - `function choose(optionId: string) {` 본문 첫 줄(현재 `if (!type) return;` 앞)에 `playSelect();` 추가:
    ```ts
    function choose(optionId: string) {
      playSelect();
      if (!type) return;
    ```
  - `generate()` 성공부 — `toast('우와! 멋진 걸 만들었어요!', 'success');` 바로 앞 줄에 `playSuccess();` 추가.
  - `handleSurveyModify()` 성공부 — `toast('원하는 대로 고쳐봤어요!', 'success');` 바로 앞 줄에 `playSuccess();` 추가.
  - 결과 화면 제목에 효과: `<h2 className="text-[22px]">{type.icon} {type.label} 완성!</h2>` 를 `<h2 className="anim-pop-tada text-[22px]">{type.icon} {type.label} 완성!</h2>` 로.

- [ ] **Step 2: Creator — 성공음.** `components/creator/Creator.tsx`:
  - import 추가:
    ```ts
    import { playSuccess } from '@/lib/client/sound';
    ```
  - 생성 성공부 — `toast('우와! 멋진 프로그램을 완성했어요!', 'success');`(~126행) 바로 앞에 `playSuccess();`.
  - 고치기 성공부 — `toast('원하는 대로 고쳐봤어요!', 'success');`(~171행) 바로 앞에 `playSuccess();`.

- [ ] **Step 3: UploadDialog — 성공음 + 완료 효과.** `components/board/UploadDialog.tsx`:
  - import 추가:
    ```ts
    import { playSuccess } from '@/lib/client/sound';
    ```
  - 업로드 성공부 — `setDone({ postId, categoryId });`(~119행) 바로 앞 줄에 `playSuccess();`.
  - 완료 화면 제목에 효과: `<p className="text-[19px]">게시판에 올라갔어요!</p>` 를 `<p className="anim-pop-tada text-[19px]">게시판에 올라갔어요!</p>` 로.

- [ ] **Step 4: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/components/survey/SurveyWizard.tsx ai-program-generator/components/creator/Creator.tsx ai-program-generator/components/board/UploadDialog.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(sound): 선택음(/easy) + 성공음(easy·create 생성/고치기·업로드) + 완료 톡 효과

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 검증 (tsc + 빌드 + 브라우저 청취)

**Files:** 없음(검증만)

- [ ] **Step 1: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 2: 프로덕션 빌드.** dev 정지 후:
  Run: `rm -rf .next && npm run build`
  Expected: 빌드 성공(`.next/BUILD_ID`). (빌드 후 dev로 돌아갈 땐 `.next` 충돌 방지 위해 `rm -rf .next` 후 dev 재시작 — CLAUDE.md 함정.)

- [ ] **Step 3: 브라우저 청취/육안 체크(수동, dev 재시작 후).** (사운드는 자동 self-test 불가 — 청취 위주.)
  - `/easy`: 선택지 탭마다 "톡" 소리, "만들기!" 성공 시 차임 + "완성!" 제목 톡 pop.
  - `/create`: 생성 성공 시 차임.
  - 게시판 올리기: 완료 시 차임 + "게시판에 올라갔어요!" 톡 pop.
  - Header **스피커 토글**: 끄면 우리 소리 멈춤·새로고침 후에도 유지, 켜면 다시 남(켤 때 미리듣기 톡). **미리보기 프로그램이 내는 소리는 토글과 무관하게 유지**(우리 사운드만 음소거).
  - 시스템 reduced-motion 켜면 톡 pop 미적용(소리는 토글로 별도 제어).

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- sound.ts(playSelect/playSuccess/isSoundOn/setSoundOn/DEFAULT_SOUND_ON, try/catch no-op, lazy AudioContext) → Task 1. ✓
- SoundToggle(Volume2/VolumeX·44px·aria·useEffect 동기화) + Header 배치 → Task 2. ✓
- anim-pop-tada + reduced-motion 자동 가드 → Task 3. ✓
- 선택음(/easy choose) + 성공음(easy generate/modify, create generate/modify, upload) + 완료/완성 pop → Task 4. ✓
- 음소거=우리 사운드만 → sound.ts 설계(Task 1) + 검증 Task 5 Step 3. ✓
- 검증(tsc·build·브라우저) → Task 5. ✓
- 범위 밖(랜딩/추가지점/볼륨) → 플랜에 없음. ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 코드 블록 완전. "~126행/~171행/~119행"은 앵커 토스트 문자열로 정확 위치 지정(읽고 찾으면 유일). ✓

**3. Type consistency:**
- `playSelect()`/`playSuccess()`/`isSoundOn()`/`setSoundOn(boolean)` — Task1 정의, Task2(toggle)·Task4(연결) 호출 시그니처 일치. ✓
- `anim-pop-tada` 클래스명 — Task3 정의, Task4(survey·upload)에서 동일 사용. ✓
- localStorage 키 `'app-sound-on'` — sound.ts 내부 일관(외부 미참조). ✓
- SoundToggle default export — Task2 정의, Header import 일치. ✓
