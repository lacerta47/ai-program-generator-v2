# 선택 피드백 사운드 + 효과 설계

작성일: 2026-06-21 · 상태: 승인 대기

## 목표
저학년의 "장난감 같은 즐거움"을 위해, 선택지형 만들기(`/easy`)의 **선택 탭**과 앱 전역의 **생성·공유 성공** 순간에 가벼운 **소리 + 짧은 시각 효과**를 더한다. PRODUCT.md "모션은 반응이다"의 청각판. 외부 에셋 없이 Web Audio로 합성하고, 음소거 토글로 끌 수 있다.

## 결정 사항 (브레인스토밍 확정)
- **범위**: 선택음 = `/easy` 선택 탭. 성공음 = `/easy`·`/create` 생성·고치기 성공 + 게시판 올리기 성공.
- **음소거 의미**: 토글은 **우리가 넣은 피드백 사운드(선택·성공)만** 끈다. 페이지/생성 프로그램(미리보기 iframe) 소리는 무관.
- **기본 켜짐**: `DEFAULT_SOUND_ON = true`(상수 한 곳 — 나중에 기본 끔은 이 줄만 변경).
- **토글 위치**: 전역 `Header` 우측(ThemeToggle 옆) → `/create`·`/easy`·`/board` 어디서나 top-right.
- 외부 오디오 에셋 금지(시스템프롬프트 원칙과 동일, Web Audio 합성).

## 아키텍처

### 1) 사운드 모듈 — `lib/client/sound.ts`
- 지연 생성 싱글턴 `AudioContext`(`window.AudioContext ?? webkitAudioContext`). 첫 호출(=사용자 제스처) 시 생성·`resume()` → autoplay 정책 충족. SSR/미지원/예외는 안전하게 무시(try/catch, no-op).
- **상태**: `const KEY = 'app-sound-on'; const DEFAULT_SOUND_ON = true;`
  - `isSoundOn(): boolean` — `localStorage[KEY]`가 `'0'`이면 false, `'1'`이면 true, 없으면 `DEFAULT_SOUND_ON`. localStorage 차단 환경은 `DEFAULT_SOUND_ON` 폴백.
  - `setSoundOn(on: boolean): void` — `localStorage[KEY] = on ? '1' : '0'`(try/catch).
- **재생**(둘 다 `if (!isSoundOn()) return;` 선검사):
  - `playSelect()` — 짧은 "톡": 오실레이터(triangle) ~80ms, 살짝 상승 피치(예: 520→660Hz), 게인 빠른 attack/decay 엔벨로프(피크 ~0.12, 클릭팝 방지 위해 0에서 시작·0으로 감쇠).
  - `playSuccess()` — 상승 차임 3음(예: 523/659/784Hz=도미솔, 각 ~120ms, 순차), 부드러운 엔벨로프.
- 음량은 작게(피크 게인 ≤0.15) — 저학년이라도 과하면 역효과.

### 2) 음소거 토글 — `components/ui/SoundToggle.tsx`
- 클라 컴포넌트. `useState(isSoundOn())` + 마운트 후 동기화(SSR 하이드레이션: 초기엔 `DEFAULT_SOUND_ON`로 렌더, `useEffect`에서 실제 localStorage 값으로 보정 — `suppressHydrationWarning` 불필요하게).
- 버튼: `Volume2`(켜짐)/`VolumeX`(꺼짐) lucide 아이콘, `aria-label`("소리 켜기/끄기"), 탭타깃 ≥44px(`h-11 w-11` 또는 ThemeToggle와 동일 사이즈). 클릭 시 `setSoundOn(next)` + 로컬 상태 갱신. (선택: 켤 때 `playSelect()`로 미리듣기.)
- 배치: `Header` nav의 `<ThemeToggle />` 앞(또는 뒤)에 `<SoundToggle />`.

### 3) 연결 (재생 호출)
- **선택음**: `components/survey/SurveyWizard.tsx`의 `choose(optionId)` 진입부에서 `playSelect()`(단일·다중 모두).
- **성공음** `playSuccess()`:
  - `SurveyWizard.tsx`: `generate()` 성공(현재 `toast('우와! 멋진 걸 만들었어요!','success')` 자리), `handleSurveyModify()` 성공(`toast('원하는 대로 고쳐봤어요!','success')` 자리).
  - `components/creator/Creator.tsx`: 생성 성공(`toast('우와! 멋진 프로그램을 완성했어요!','success')` 자리, ~126행), 고치기 성공(~171행).
  - `components/board/UploadDialog.tsx`: 업로드 성공(`setDone({...})` 직전/직후, ~119행).
- 호출은 성공 토스트 옆 한 줄(`playSuccess();`). 실패/취소 경로엔 없음.

### 4) 시각 효과 ("효과")
- **성공 시 제목 톡 pop**: 결과 완성 화면 제목(`/easy` "…완성!", `/create` 결과 헤더)과 업로드 완료 "게시판에 올라갔어요!"에 1회 scale-bounce.
- `app/globals.css`에 키프레임 추가(기존 `anim-pop-in` 패턴 따라):
  ```css
  @keyframes pop-tada { 0%{transform:scale(0.9)} 60%{transform:scale(1.06)} 100%{transform:scale(1)} }
  .anim-pop-tada { animation: pop-tada 360ms ease-out both; }
  ```
  `@media (prefers-reduced-motion: reduce)` 블록(globals.css 기존)이 모든 애니메이션을 무효화하므로 추가 가드 자동 적용(기존 패턴 확인 후 동일하게).
- 선택은 사운드 중심(단일선택은 즉시 다음 단계 `anim-pop-in` 전환이라 per-option pop은 안 보임) — 추가 비주얼 없음. 파티클/컨페티 안 씀(YAGNI·과자극 방지).

## 접근성
- 사운드: 음소거 토글로 제어(prefers-reduced-sound 표준 부재). AudioContext는 첫 제스처에서 resume.
- 시각: 새 `anim-pop-tada`는 globals.css의 reduced-motion 가드로 무효화.
- 토글: 44px·`aria-label`·키보드 포커스.

## 데이터 흐름
탭/성공 → SurveyWizard·Creator·UploadDialog가 `sound.ts`의 play 호출 → `isSoundOn()` 통과 시 AudioContext로 합성 재생. 토글 → `setSoundOn` → localStorage. 새로고침/타 화면에서도 동일 설정 유지.

## 에러 처리 / 엣지
- AudioContext 미지원·생성 실패·localStorage 차단 → 전부 try/catch no-op(소리만 안 남, 기능 정상).
- 빠른 연타: 매 탭마다 짧은 노드 생성·자동 정지(`osc.stop`) — 노드 누수 없게 `onended`/짧은 수명. 동시 다발 재생은 짧아 무해.
- SSR: 모듈은 클라에서만 실제 동작(play는 컴포넌트 이벤트 핸들러에서 호출 → 항상 클라).

## 검증
- `tsc --noEmit` + 프로덕션 빌드.
- 브라우저(수동, Chrome 연결 시): `/easy` 선택 시 톡, 만들기 성공 시 차임 + 제목 pop; `/create` 생성 성공음; 게시판 올리기 성공음; Header 토글로 on/off 영구 반영; 음소거 시 우리 소리만 멈추고 미리보기 프로그램 소리는 유지. (사운드는 자동 self-test 어려워 육안/청취 위주.)

## 영향 파일
- 신규: `lib/client/sound.ts`, `components/ui/SoundToggle.tsx`.
- 수정: `components/common/Header.tsx`(토글 배치), `components/survey/SurveyWizard.tsx`(선택음+성공음), `components/creator/Creator.tsx`(성공음), `components/board/UploadDialog.tsx`(성공음+완료 pop), `app/globals.css`(anim-pop-tada).

## 범위 밖
랜딩(Dock)·기타 화면 사운드, 단계완료/뒤로 등 추가 지점, 볼륨 조절(켜짐/꺼짐만), 사운드 종류 커스터마이즈.
