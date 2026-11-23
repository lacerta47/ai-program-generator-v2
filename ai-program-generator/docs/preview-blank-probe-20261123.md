# 미리보기 빈 화면·실행 오류 자동 판정 — 작업 지시서

- 작성: Claude(2026-11-23), 기준 커밋 `1924def68d82c5570830f987541a3b7e156dc5cf`
- 담당: **Codex**(구현) → Claude(리뷰). 리뷰 등급 **높은 영향**(미리보기 격리 경로를 건드린다).
- 권장 브랜치: `codex/preview-blank-probe`. main 병합은 사용자 승인.
- 선점·진행 기록은 [Issue #201](https://github.com/lacerta47/ai-program-generator-v2/issues/201)에 남긴다. 이 문서는 범위와 완료 기준의 원본이다.

## 1. 왜 하나

- 생성 직후 코드 검사(`lib/ai/validateCode.ts`)는 문법 오류, 없는 요소 참조, 주석이 코드를 삼킨 경우처럼 "확실히 죽은 코드"만 거른다. 실행 중 오류나 "돌기는 도는데 화면이 비는" 경우는 못 잡는다. 파일 주석에도 이 한계가 적혀 있다.
- 오프라인 검사 도구(`scripts/inspect-quality-actions.mjs`, `lib/ai/quality-run.test.ts`)는 품질 실험용이다. 실제 아이가 보는 미리보기에는 아무 판정이 없다.
- 11-02에 Chrome에서 빈 미리보기가 보고됐지만 11-20 재검증에서 재현되지 않아 원인을 확정하지 못했다(`docs/verification-20261120-pending-1103.md`). 지금은 "문서가 안 왔다 / 스크립트가 안 돌았다 / 돌았는데 비었다"를 구분할 수단이 없다.
- 참고: 외부 프로젝트 craft-anything이 "만들기 → 원본과 비교 → 고치기" 순환에 화면 판정을 쓰는 데서 착안했다. 코드는 가져오지 않는다.

## 2. 결정된 방향(사용자 승인 2026-11-23: "코덱스에서 작업하게 문서로 만들어봐")

| 방법 | 결정 |
|---|---|
| 생성 서버에서 헤드리스 브라우저로 확인 | **하지 않는다.** Vercel 함수에 Chromium을 올리면 크기·지연(생성마다 2~5초)·비용이 든다 |
| 미리보기 문서 안의 검사 스크립트가 부모 화면에 결과를 보냄 | **1단계로 구현한다** |
| 같은 판정을 오프라인 검사 도구와 일일 통계에 추가 | 2단계. 1단계 병합 후 사용자 승인을 받고 진행한다 |

## 3. 1단계 범위

### 3-1. 검사 스크립트 주입(서버)

- `lib/program.ts`의 `buildPreviewDoc(code)`에 선택 인자를 추가한다. 예: `buildPreviewDoc(code, { probe: true })`. 기본값은 `false`로 두어 기존 호출(품질 실험 테스트 등)이 바뀌지 않게 한다.
- 검사 스크립트는 **두 미리보기 라우트에서만** 켠다.
  - `lib/preview-store.ts`의 `getPreview`. 즉석 생성 미리보기 `/api/preview/[id]`가 이 경로를 쓴다.
  - `app/api/preview/post/[id]/route.ts`. 게시물 미리보기다.
- ZIP 다운로드용 `buildIndexHtml`에는 넣지 않는다. 저장된 code와 게시물 데이터에도 넣지 않는다.
- 스크립트는 `<head>` 안, 생성 CSS·HTML·JS보다 **앞**에 둔다. 생성 코드의 초기 오류까지 잡기 위해서다.
- 스크립트 본문은 한 파일(예: `lib/preview/probeScript.ts`의 문자열 상수)에서만 관리한다. 2단계에서 오프라인 도구도 같은 판정을 쓰게 하기 위해서다.
- 보안 헤더(`lib/server/previewHeaders.ts`의 CSP `sandbox allow-scripts`, frame-ancestors)는 **바꾸지 않는다**. `postMessage`에는 추가 권한이 필요 없다.

### 3-2. 검사 스크립트가 하는 일(iframe 안)

1. 시작하자마자 `parent.postMessage({ type: 'lun-preview-probe', v: 1, phase: 'ready' }, '*')`를 보낸다. 미리보기가 출처 없는(opaque) 샌드박스라 대상 출처를 지정할 수 없어 `'*'`를 쓴다. 보내는 내용에는 개인정보나 코드 본문을 넣지 않는다.
2. `window.addEventListener('error')`와 `'unhandledrejection'`으로 오류 개수와 첫 메시지(최대 200자)를 모은다. `window.onerror` 대입은 생성 코드가 덮어쓸 수 있으니 쓰지 않는다.
3. 로드 후 **1.5초**에 판정한다. "비어 있음"이 나오면 **4초**에 한 번 더 본다(시작 화면이 페이드인하는 경우 대비). 결과는 한 번만 보낸다. `{ type, v: 1, phase: 'result', blank, errorCount, firstError, signals }`
4. **보수적 판정.** 아래가 **모두** 참일 때만 `blank: true`로 본다.
   - `document.body.innerText`가 공백뿐이다.
   - 보이는 콘텐츠 요소가 없다. 콘텐츠 요소는 크기(가로 × 세로 > 16px²)가 있고 `visibility`가 visible이며 `opacity`가 0보다 큰 요소 중에서, `img`·`svg`·`video`·`canvas`·`input`·`button`·`select`·`textarea`이거나 배경색(투명 제외)·배경 이미지·테두리가 있는 것이다.
5. **캔버스는 1단계에서 보이기만 하면 콘텐츠로 본다.** 픽셀 단색 판정은 판정에 쓰지 않고, 할 수 있는 경우에만 `signals.canvasUniform`으로 기록한다. 주의할 점이 둘 있다.
   - 컨텍스트가 없는 캔버스에 `getContext('2d')`를 부르면 그 캔버스가 2d로 고정돼, 생성 코드가 나중에 WebGL을 쓰려 할 때 망가진다. 절대 부르지 않는다. 기록이 필요하면 검사 스크립트가 만든 별도 캔버스에 `drawImage`로 복사해서 본다.
   - WebGL 캔버스는 `preserveDrawingBuffer` 없이 복사하면 비어 보일 수 있다. 그래서 판정에 쓰지 않는다.
6. 생성 코드가 `document.body.innerHTML`을 통째로 바꾸거나 타이머를 지워도 이미 등록된 리스너는 살아 있다. 다만 생성 코드가 일부러 가짜 메시지를 보낼 수 있으니, 결과는 **안내용으로만** 쓴다(권한·쿼터·저장 판단 금지).

### 3-3. 부모 화면(`components/ui/FullscreenFrame.tsx`)

- 새 선택 prop `onProbe?: (state: PreviewProbeState) => void`를 받는다. 넘기지 않으면 지금과 동작이 같다.
- `message` 이벤트 처리
  - `event.source === iframeRef.current?.contentWindow`이고 `data.type === 'lun-preview-probe' && data.v === 1`일 때만 받는다.
  - 출처(origin)로는 검증할 수 없다(`"null"`). source로 확인한다.
- 판정할 상태
  - `ok`
  - `blank`
  - `error`: 오류가 있지만 화면은 나온 경우
  - `blank-error`: 비었고 오류도 있는 경우
  - `not-loaded`: iframe `load`가 10초 안에 없음(**문서 미도착**)
  - `probe-silent`: `load`는 됐는데 3초 안에 `ready`가 없음(**스크립트가 안 돎**)

  미리보기 만료나 직접 탐색 차단 응답(404·403 HTML)도 `probe-silent`로 잡힌다. 이 응답에 같은 검사 스크립트를 넣어 `phase: 'unavailable'`을 보내게 할지는 구현자가 정하고, 정한 내용을 PR에 적는다.
- `src`나 `frameKey`가 바뀌면 상태와 타이머를 초기화한다. 언마운트할 때 리스너와 타이머를 정리한다.

### 3-4. 안내 카드(만들기 화면에서만)

- `components/creator/ResultPanel.tsx`와 `components/survey/SurveyWizard.tsx`에서만 `onProbe`를 연결한다.
- 게시판(`components/board/PostPreview.tsx`)과 작업 기록(`components/creator/WorkHistoryControls.tsx`)에서는 연결하지 않는다. 남의 작품에 "고쳐 볼까요?"를 띄우지 않기 위해서다.
- `blank`·`blank-error`·`error` 상태일 때 미리보기 아래에 작은 안내를 띄운다. 문구 예시는 다음과 같다(저학년 눈높이, 이모지 금지, 구현자가 다듬어도 됨).
  - 빈 화면: "화면이 비어 있는 것 같아요. 같이 고쳐 볼까요?"
  - 오류: "프로그램이 중간에 멈춘 것 같아요. 같이 고쳐 볼까요?"
- 버튼을 누르면 기존 "고쳐 줘!" 입력란을 **미리 채우고 포커스만 옮긴다.**
  - 지금은 어떻게 돼?(`modifyActual`): "화면에 아무것도 안 보여요" 또는 "중간에 멈춰요", 그리고 첫 오류 메시지를 쉬운 말로 짧게 덧붙인다.
  - 어떻게 되길 원해?(`modifyWant`): 비어 있을 때만 "처음 만들려던 화면이 보이게 해 줘"를 채운다.
- **AI를 자동으로 다시 부르지 않는다.** 실제 생성은 아이가 "고쳐 줘!"를 눌러야 시작된다.
- `not-loaded`·`probe-silent`는 아이에게 "고쳐 줘"를 권하지 않는다(코드 탓이 아니다). 기존 "다시 보기" 흐름처럼 "미리보기를 다시 불러올까요?" 버튼만 띄운다.
- 디자인은 기존 토큰과 컴포넌트(Button, `rounded-[var(--r-md)]`, `bg-surface-2` 등)를 쓰고 DESIGN.md를 따른다.

### 3-5. 하지 않는 것

- 쿼터·요금 정책 변경. 빈 화면을 고칠 때 쓰는 생성을 쿼터에서 빼는 문제는 **사용자 결정 대기**다. 1단계에서는 기존과 똑같이 센다.
- 서버 통계·Firestore 쓰기·규칙·스키마 변경(2단계)
- 생성 프롬프트·`validateCode` 변경
- 유료 AI 실호출. 검증은 무료 경로만 쓴다(4절).

## 4. 완료 기준과 검증

1. **단위 테스트(vitest)**
   - `buildPreviewDoc`이 `probe: true`일 때만 스크립트를 생성 코드보다 앞에 넣는지 확인한다.
   - 기본 호출과 `buildIndexHtml`이 바뀌지 않았는지 확인한다.
   - 판정 로직은 순수 함수로 떼어 신호 입력 → 상태 출력을 테스트한다.
   - 부모의 메시지 필터(다른 source, 다른 type·v 무시)를 테스트한다.
2. **오프라인 오판 측정**
   - 로컬 `output/`의 기존 생성물 묶음(예: `output/new-games-90-20261018/previews`, 미로·수족관 재검사 묶음)을 검사 스크립트를 켠 문서로 헤드리스 Edge에서 연다.
   - 기존 Playwright 경로를 재사용한다. 단, 이 도구는 미커밋 상태로 둔다.
   - 정상 작품을 "빈 화면"으로 판정한 건수(**목표 0**)와 오류 판정 분포를 PR 본문에 표로 남긴다.
   - 인위적으로 만든 빈 사례 4종이 모두 `blank` 또는 `blank-error`로 나와야 한다: 빈 body, 시작하자마자 throw, 최상위 `display:none`, 주석이 코드를 삼킨 경우.
3. **실제 브라우저**
   - 로컬 dev에서 fork 경로(`/create?fork=<게시물 id>`, AI 호출 없음)로 정상 작품과 인위적 빈 작품을 열어 상태와 안내 카드를 확인한다.
   - 폭 390과 1200 두 가지로 확인한다.
   - 다크 모드를 확인한다.
   - 게시판 미리보기에는 카드가 뜨지 않는지 확인한다.
   - 콘솔에 새 오류가 없는지 확인한다.
4. **공통 검사**
   - `npx tsc --noEmit`, `npm run build`, 기존 테스트 전체가 통과해야 한다.
   - CI 2잡이 통과해야 한다.
   - Vercel Preview에서 즉석 미리보기와 게시물 미리보기가 둘 다 뜨는지 확인한다(CSP 헤더 변경이 없는지 포함).
5. **리뷰**
   - Claude 리뷰를 `tier: high`로 받는다.
   - 미해결 쟁점은 Issue에 남긴다.

## 5. 2단계(별도 승인 후)

- 일일 통계 `gate` 섹션 옆에 `preview` 집계(`blank`·`error`·`not-loaded`·`probe-silent` 일별 건수)를 추가한다. 클라이언트 비콘이라 위조할 수 있으니 레이트 리밋을 걸고 참고용으로만 쓴다.
- 같은 스크립트를 `scripts/inspect-quality-actions.mjs`와 자동 예시 검사에 붙여, 빈 예시가 교육테스트 게시판에 올라가기 전에 거른다.
- 오프라인 측정 결과로 오판이 충분히 낮으면 캔버스 단색 판정을 판정에 넣을지 다시 본다.

## 6. 사용자 결정 대기

1. 빈 화면·오류를 고칠 때 쓰는 생성을 쿼터(일반 회원 평생 5회)에서 뺄지
2. 2단계 진행 여부
