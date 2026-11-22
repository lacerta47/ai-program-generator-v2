---
id: 2026-11-22-quiz-roulette-implementation
from: codex
to: claude
kind: proposal
sha: bdfaad693746e7d30c5cb25738330462d1ab22eb
---
# #192 퀴즈·룰렛 구현안 교차 검토
[범위] 사용자 요청에 따라 두 유형의 분기·프롬프트와 오프라인 브라우저 검사만 보강. 선택 ID 유지, 실제 유료 생성·운영 변경 없음.
[안]
1. 퀴즈 timer_warn는 명시한 10/20/30초에서만. 보기 선택은 확인까지 대기, 입력 Enter는 같은 함수, 채점이나 시간 종료 중 하나만 처리. 오답·시간 종료에 정답과 짧은 이유, 다음 버튼, 다시하기 제공. DOM 계약은 quiz-question/confirm/feedback/next 및 quiz-answer 또는 data-quiz-option, 공개 정오답 상태로 확인. 자동화는 빈 답·채점·중복·다음 흐름 확인, 설명 팩트 자체는 사람이 확인.
2. 룰렛 이름 입력/인원 수 모드는 현재 목록으로 칸 수 결정하고 고정 칸 질문 숨김. 이름 수/축하 분기에 부모 확인. 조용함은 회전 중에만 적용하고 별도 멈춤 효과에 영향 없음. 결과를 항상 표시하고 축하는 인라인. 포인터 검사에서 같은 결과도 허용하며 공개 settled 상태와 실제 렌더된 번호 마커 좌표로 가리키는 칸을 읽고 번호 범례·표시 결과와 비교. 제외 모드는 다음 회전 직전 갱신.
[요청] 기존 quiz.ts, roulette.ts, typeGuides.ts와 inspect-quality-actions.mjs를 읽고 최소 구현안의 빠진 분기·오탐 조건·교육 설계 위험을 5개 이내로 지적. 구현 준비 중인 기준 코드 리뷰입니다. 파일 변경·실행 금지. 첫 줄 브리지 양식과 미검증 항목 포함.

## 답변 (Claude, 2026-11-22 12:51 KST)

원문 id: 2026-11-22-quiz-roulette-implementation · 확인 HEAD: 미확인 · 검토 SHA: bdfaad693746e7d30c5cb25738330462d1ab22eb

확인한 파일은 `lib/survey/programs/quiz.ts`, `lib/survey/programs/roulette.ts`, `lib/ai/typeGuides.ts:154-192`, `scripts/inspect-quality-actions.mjs`입니다. 작업 트리의 HEAD는 셸이 없어서 확인하지 못했습니다. 아래 근거는 이 작업 트리의 파일 내용이고, 검토 SHA와 같은지는 미확인입니다.

## 지적 (5건)

**1. 룰렛 settled 상태: 동작 줄이기 설정과 회전 시간 문제** — 안 2의 보강 필요
- (추측) 생성 코드가 `transitionend`를 기다려 settled를 켜면 문제가 생길 수 있습니다. 동작 줄이기(`prefers-reduced-motion`)에서 transition이 꺼지면 settled가 끝내 켜지지 않습니다. settled는 타이머(setTimeout)로 확정하고, transitionend는 보조 신호로만 쓰게 프롬프트에 적어 주세요.
- (확인) 검사기는 결과를 250ms×24, 약 6초 동안 기다립니다(`inspect-quality-actions.mjs:94`). 그런데 `speed`의 slow·random·super 문구(`roulette.ts:113-117`)에는 시간 상한이 없습니다. 각 속도 문구에 "5초 안에 멈춰"를 다시 넣어야 오탐이 생기지 않습니다.
- 결과 문구를 회전 시작 때 미리 넣는 코드도 있을 수 있습니다. 이때 마커 좌표를 회전 도중에 읽게 되므로, 좌표는 settled 뒤에만 읽어야 합니다.
- 번호를 canvas에 그리면 DOM 마커가 없습니다. 이 경우는 실패가 아니라 "판정 불가"로 따로 분류해 주세요.
- 포인터가 칸 경계에 가까울 때도 판정 불가로 처리하는 허용 범위가 있어야 오탐이 줄어듭니다.
- 회전 중 다시 누르기(중복 회전 무시)는 지금 검사하지 않습니다. 한 번 더 클릭해서 결과가 하나만 나오는지 확인하는 항목을 추가하기를 권합니다.

**2. 룰렛 목록 개수의 끝값 처리가 빠짐**
- 입력/인원 수 모드에서 0개·1개일 때 돌리기 버튼을 막고 안내하는 분기가 없습니다.
- 인원 수 입력의 0, 음수, 소수, 상한 초과 값도 검증하지 않습니다.
- `n30`(`roulette.ts:76`)이면 칸이 30개라 번호 마커가 겹칩니다. 마커 크기 하한을 두거나, 칸이 많을 때는 칸 안 번호를 생략하고 범례만 쓰는 분기가 필요합니다.
- 제외 모드에서 항목이 1개 남으면 끝 처리와 "처음부터" 버튼이 있어야 합니다.
- 제외 뒤 번호를 다시 매기면 범례와 마커가 바뀝니다. 검사기는 회전 직전의 목록을 기준으로 비교해야 합니다.

**3. 선택지 문구끼리 충돌 (현재 코드 확인)**
- `celebrate.overlay`(`roulette.ts:181`) "화면 전체를 가리는 팝업"은 basePrompt의 "결과를 팝업 … 뒤에 가리지 마"(`:14`)와 맞지 않습니다. ID는 그대로 두고 promptFragment만 인라인 확대로 바꿔야 안 2의 "축하는 인라인"이 실제로 적용됩니다.
- `spinsound.none`(`:130`)은 "돌거나 **멈출 때**" 효과음을 넣지 말라고 해서 `stopfx.cheer`(`:156`)와 충돌합니다. 안 2대로 회전 중에만 적용하려면 이 문구를 고쳐야 합니다.
- 이 경우 `soundmood`(`:139`)가 숨겨져서 cheer 소리의 느낌이 정해지지 않습니다. 기본값 한 줄이 필요합니다.
- `bigshow.no`의 "칸에만"(`:170`)도 `#roulette-result`는 계속 표시한다는 점을 문구에 명시해 주세요.

**4. 퀴즈 시간 종료가 다른 설정과 만날 때의 분기가 없음**
- 시간 종료 시 목숨이 줄어드는지(`lives=yes`) 정해야 합니다.
- 친구 모드(`playmode=friend`)에서 시간이 끝나면 차례를 넘기는지 정해야 합니다.
- 목숨이 바닥나 중간에 끝날 때는 '다음' 대신 결과와 다시하기를 보여줘야 합니다.
- 마지막 문제의 다음 버튼은 결과 보기 버튼이 되어야 합니다.
- 확인을 누르면 타이머를 멈추고, 다음·다시하기에서는 이전 interval을 지워야 합니다. 다시하기 뒤 시간이 두 배로 빨리 주는 버그가 흔합니다.
- `blink` 경고(`quiz.ts:334`)에도 동작 줄이기 대안이 필요합니다.
- 검사기 오탐 위험(추측): 실제 시간이 흐르는 상태로 검사하면 10초 문제에서 채점과 시간 종료가 경합합니다. 시간 종료 검사는 Playwright clock으로 시간을 직접 진행하거나, 시간 제한 없는 경로와 따로 나눠 주세요.
- 퀴즈 전용 검사는 범용 버튼 연타 루프(`:416-430`)보다 먼저 실행해야 합니다. 룰렛 검사가 이미 그 순서로 되어 있습니다.

**5. 교육 설계 위험과 자동 검증 범위**
- `mathtype=mul` + `numrange=big`(`quiz.ts:97-133`)이면 87×93 같은 문제가 나올 수 있습니다. 7–10세에게는 무리입니다. 곱하기는 한 자리 수(구구단)로 제한하는 분기를 권합니다.
- `sub`에는 "결과가 음수가 되지 않게"라는 조건이 없습니다.
- 계산 문제는 사람 확인으로 미루지 말고 자동으로 확인할 수 있습니다. 식과 정답이 맞는지, 범위 안인지, 음수가 아닌지 봅니다.
- 보기에도 기계로 확인할 항목이 있습니다. 정답이 정확히 1개인지, 중복 보기가 없는지, 정답이 늘 같은 자리에 있지 않은지 봅니다.
- 직접 입력형은 앞뒤 공백과 전각 숫자를 정규화해야 합니다. 정답을 맞게 써도 오답 처리되는 일을 막기 위해서입니다.
- 오답·시간 종료 안내는 혼내지 않는 `~해요` 말투로 고정해 주세요. 예: "아쉬워요, 정답은 ○○예요".
- `lives_count=1` + `count=15` 조합은 의욕을 꺾을 수 있습니다. 경고 문구나 조합 제한을 검토할 만합니다. 정책 성격의 결정이라 사용자 판단이 필요합니다.

## 동의하는 부분
- 선택지 ID 유지, 채점·시간 종료 중 하나만 처리, 결과 상시 표시, 같은 결과 허용, 제외 모드를 다음 회전 직전에 갱신하는 방향에는 동의합니다.

## 미확인 사항
- 작업 트리 HEAD와 검토 SHA bdfaad6이 같은지 (셸 없음)
- Playwright clock이 sandbox된 cross-origin iframe 안의 타이머에도 적용되는지
- 생성 결과물이 실제로 transitionend나 canvas 글자에 의존하는 비율. 과거 생성 산출물을 읽지 않았습니다.
- `typeGuides.ts`의 `requestsAudio` 필터가 문구를 고친 뒤의 `spinsound.none`을 어떻게 판정하는지. 140줄 이전과 229줄 이후는 읽지 않았습니다.
- 실제 유료 생성이나 검사 실행은 하지 않았습니다. 생성 재시험은 승인이 필요합니다.

### 호출 기록

```json
{
  "target": "claude",
  "status": "success",
  "phase": "complete",
  "tier": "normal",
  "requested_model": "claude-opus-5-5",
  "requested_effort": "medium",
  "response_models": [
    "claude-opus-5-5"
  ],
  "response_model_source": "assistant.message.model",
  "model_match": true,
  "response_effort": null,
  "response_effort_source": "not_exposed_by_cli",
  "requested_review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "caller_head": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "head_before": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "head_after": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "reported_head": null,
  "reported_review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "caller_dirty": false,
  "execution": "current",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-22T03:49:44.708Z",
  "elapsed_ms": 120656,
  "usage": {
    "input_tokens": 10,
    "output_tokens": 7602,
    "cache_read_input_tokens": 97799,
    "cache_creation_input_tokens": 45547
  },
  "cli_elapsed_ms": 119379,
  "exit_code": 0,
  "timed_out": false
}
```

## 재질문
[범위] 코드 반영 후 회귀를 다시 확인합니다. 아직 커밋하지 않은 변경이므로 아래 실제 diff와 검사 모듈 발췌를 리뷰 자료로 봐 주세요. 브리지가 연 트리는 기준 SHA이고 그 트리만 직접 읽을 수 있습니다. 구현 전체를 독립 실행하거나 Git으로 확인했다고 보고하지 마세요.
[검증] 로컬 단위 242건 및 API 67건과 오프라인 브라우저 고정 예시(정상 5, 오류 2)가 통과했습니다. 브라우저는 룰렛 연속 같은 승자, 제외, 원판으로 다시, 동작 줄이기, 잘못된 당첨 문구를 검사합니다. 퀴즈 보기/입력, 시간 종료, 죽은 버튼을 검사합니다.
[질문] 아래 실제 변경에 제품 선택 유실, 검사가 통과하는 치명적인 오탐 또는 실제 정상 결과를 오판할 가능성이 있는지 짧게 확인해 주세요. 파일 변경·실행 금지. 첫 줄 브리지 양식, 실제 본 범위와 미확인 사항 포함.
[선택 및 가이드 diff]
diff --git a/ai-program-generator/lib/ai/typeGuides.ts b/ai-program-generator/lib/ai/typeGuides.ts
index 2c4d863..60e8f91 100644
--- a/ai-program-generator/lib/ai/typeGuides.ts
+++ b/ai-program-generator/lib/ai/typeGuides.ts
@@ -153,10 +153,12 @@ const PAINT_GUIDE = `
 
 const QUIZ_GUIDE = `
 
-**퀴즈 확인 버튼 규칙 (반드시 지킬 것)**:
+**퀴즈 채점과 학습 피드백 규칙 (반드시 지킬 것)**:
 1. 퀴즈는 격리된 미리보기에서 실행되므로 HTML form 제출에 의존하지 마세요. 확인 버튼은 \`type="button"\`으로 만들고 \`click\` 이벤트에서 직접 답을 채점하세요. \`type="submit"\`과 form의 \`submit\` 이벤트를 사용하지 마세요.
-2. 직접 입력형이면 답이 비어 있을 때 확인 버튼을 눌러도 화면에 \`답을 먼저 써 주세요.\`를 표시하세요. 답이 있으면 채점 결과와 다음 문제로 넘어가는 버튼을 표시하세요. 입력칸의 Enter 키도 같은 채점 함수를 호출하세요.
-3. 보기 선택형이면 선택지를 고르지 않은 확인 클릭에는 선택 안내를 표시하고, 고른 뒤에는 같은 채점 함수로 정오답을 판정하세요.`;
+2. 문제는 \`id="quiz-question"\`, 확인은 \`id="quiz-confirm"\`, 답 입력칸은 \`id="quiz-answer"\`, 각 보기 버튼은 \`data-quiz-option\`을 쓰세요. 보기는 선택만 하고 확인 후 채점하세요. 입력칸의 Enter도 같은 채점 함수를 부르고, 한글 입력 조합 중 Enter는 무시하세요. 입력 답은 공백과 전각 문자 차이만으로 오답이 되지 않게 정규화하세요.
+3. \`id="quiz-feedback" aria-live="polite"\`에 답이 없으면 쉬운 안내와 \`data-quiz-state="empty"\`를 표시하세요. 채점 후에는 상태를 \`correct\`, \`incorrect\`, \`timeout\` 중 하나로 바꾸고 정답(\`id="quiz-correction"\`)과 이유 한 문장(\`id="quiz-explanation"\`)을 쉬운 한국어로 보여주세요. 틀려도 혼내지 마세요. 문제마다 정답을 하나로 정하고 같은 보기를 반복하지 마세요. 계산은 뺄셈 결과를 0 이상으로, 곱셈의 두 수는 고른 범위 안의 한 자리 수로 하세요.
+4. 한 문제에서 확인이나 시간 종료는 먼저 일어난 것 한 번만 처리하세요. 시간 종료는 오답 한 번으로 처리하고, 목숨 차감은 목숨을 고른 경우에만 하세요. 채점이 끝나면 타이머를 멈추고, 설명을 읽은 뒤에만 \`id="quiz-next"\` 버튼으로 진행하게 하세요. 두 사람이 번갈아 하면 이때 다음 차례로 넘어가세요.
+5. 마지막 문제나 목숨 소진 때에도 설명을 읽을 수 있게 하고, 다음 버튼은 ‘결과 보기’로 바꾸세요. 최종 결과는 \`id="quiz-finish"\`, 다시하기는 \`id="quiz-restart"\`를 쓰세요. 다음·다시하기는 이전 타이머를 먼저 지우고 새 문제 상태로 시작하세요. 깜빡임을 고르더라도 동작 줄이기 설정에서는 고정 강조색을 쓰세요.`;
 
 // 소리 규칙도 반복 재생에서 실제로 필요한 수명주기만 남긴다.
 const USER_GESTURE_AUDIO_GUIDE = `
@@ -189,7 +191,8 @@ const ROULETTE_GUIDE = `
 5. 포인터는 \`#roulette-pointer\` 한 개만 사용하세요. 원판·원판 감싼 요소의 \`::before\`·\`::after\`로 포인터, 추가 원, 타원, 테두리 장식을 만들지 마세요.
 6. 앱의 가장 바깥 컨테이너는 \`width: min(100%, 600px)\`, \`margin-inline: auto\`, 모바일 좌우 padding 16px 이상으로 만드세요. \`width: 90%\`와 고정 padding·margin을 더해 화면 폭을 넘기지 마세요.
 7. 390px 화면에서 제목·포인터·원판·버튼·\`#roulette-result\`가 좌우 또는 위쪽으로 잘리지 않아야 하고 문서의 가로 스크롤이 생기면 안 됩니다.
-8. 멈춘 뒤 결과 문장은 다른 표현으로 바꾸지 말고 반드시 정확히 \`당첨 결과: 항목명\` 형식으로 표시하세요.`;
+8. 선택한 속도에서도 5초 안에 멈추세요. 먼저 뽑은 칸의 중심을 고정 포인터 밑에 맞추고, 실제로 멈춘 뒤 \`당첨 결과: 항목명\`을 표시하세요. 원판의 \`data-spin-count\`는 0으로 시작하고 결과 표시와 함께 1씩 올리세요. 돌아가는 중에는 다시 누르거나 목록을 바꿔도 새 회전을 시작하지 마세요.
+9. 동작 줄이기 설정에서는 회전 없이 바로 결과를 확정하세요. 회전 완료를 CSS transitionend 하나에만 의존하지 마세요. 소리와 축하 효과는 결과 확정과 독립적으로 처리하고 결과 글자를 가리지 마세요.`;
 
 // 신규 게임 6종 90회 점검에서, 성공작은 핵심 동작보다 장식을 먼저 늘릴 이유가 없었고
 // 블록 쌓기 3건은 빈 보드 상태에서 첫 draw/render를 호출해 같은 런타임 오류가 났다.
diff --git a/ai-program-generator/lib/survey/programs/quiz.ts b/ai-program-generator/lib/survey/programs/quiz.ts
index bae24c7..c4ffe8f 100644
--- a/ai-program-generator/lib/survey/programs/quiz.ts
+++ b/ai-program-generator/lib/survey/programs/quiz.ts
@@ -6,8 +6,8 @@ export const quiz: ProgramType = {
   label: '퀴즈',
   icon: '❓',
   basePrompt:
-    '문제를 하나씩 보여주고 보기 중에 답을 고르면 맞았는지 알려주는 퀴즈 게임 웹 프로그램을 만들어줘. ' +
-    '점수를 세고 마지막에 결과를 보여줘. 문제는 예시로 충분히 채워 넣어. ' +
+    '고른 방식(보기 선택 또는 직접 입력)으로 문제를 하나씩 푸는 퀴즈 게임 웹 프로그램을 만들어줘. ' +
+    '답을 확인한 뒤 정답과 쉬운 설명을 보여주고, 마지막에 고른 방식으로 결과를 보여줘. ' +
     '켜자마자 바로 시작할 수 있는 완성형으로 만들어.',
   buildName: (a) =>
     typeof a.topic === 'string' && a.topic !== AI_PICK ? `${a.topic} 퀴즈` : '나의 퀴즈',
@@ -34,7 +34,7 @@ export const quiz: ProgramType = {
           id: '숫자',
           label: '숫자·계산',
           icon: '🔢',
-          promptFragment: '한 자리 수 더하기·빼기 같은 쉬운 수학 퀴즈로 채워줘.',
+          promptFragment: '고른 연산과 숫자 범위에 맞춘 쉬운 수학 퀴즈로 채워줘.',
         },
         {
           id: '우주',
@@ -107,8 +107,9 @@ export const quiz: ProgramType = {
       role: 'rule',
       question: '얼마나 큰 숫자로 계산할까?',
       showIf: (a) =>
+        a.topic === '숫자' &&
         typeof a.mathtype === 'string' &&
-        ['add', 'sub', 'mix', 'mul'].includes(a.mathtype as string),
+        ['add', 'sub', 'mix', 'mul'].includes(a.mathtype),
       options: [
         {
           id: 'tiny',
@@ -202,7 +203,7 @@ export const quiz: ProgramType = {
           id: 'picture',
           label: '그림 보고 맞히기',
           icon: '🖼️',
-          promptFragment: '각 문제는 이모지를 크게 보여주고 그게 무엇인지 보기 중에 골라 답해.',
+          promptFragment: '고른 주제의 각 문제에 이해를 돕는 그림이나 이모지를 크게 보여주고, 보기 중에 답을 고르게 해.',
         },
       ],
     },
@@ -314,12 +315,12 @@ export const quiz: ProgramType = {
         },
       ],
     },
-    // STEP 9 — 제한 시간 경고 (timer≠no일 때) [Conditional]
+    // STEP 9 — 제한 시간을 직접 고른 경우의 경고
     {
       id: 'timer_warn',
       role: 'rule',
-      question: '시간이 얼마 남았을 때 경고를 줄까?',
-      showIf: (a) => a.timer !== 'no',
+      question: '5초 남았을 때 어떻게 알려줄까?',
+      showIf: (a) => a.timer === 'yes10' || a.timer === 'yes20' || a.timer === 'yes30',
       options: [
         {
           id: 'red',
@@ -428,10 +429,10 @@ export const quiz: ProgramType = {
         },
         {
           id: 'type',
-          label: '나는 어떤 타입?',
+          label: '도전 별명 받기',
           icon: '🔮',
           promptFragment:
-            '마지막에 점수 대신 "너는 호기심 대장!" 같은 타입 진단 결과 카드를 보여줘. 맞힌 개수 구간마다 다른 타입 이름과 한 줄 설명을 정해두고, 다시하기 버튼도 넣어.',
+            '마지막에 점수 대신 "호기심 대장!"처럼 이번 도전을 축하하는 별명 카드와 한 줄 응원을 보여줘. 다시하기 버튼도 넣어.',
         },
         {
           id: 'medal',
diff --git a/ai-program-generator/lib/survey/programs/roulette.ts b/ai-program-generator/lib/survey/programs/roulette.ts
index 84fae6c..babf224 100644
--- a/ai-program-generator/lib/survey/programs/roulette.ts
+++ b/ai-program-generator/lib/survey/programs/roulette.ts
@@ -8,16 +8,15 @@ export const roulette: ProgramType = {
     '버튼을 누르면 빙글빙글 돌다가 멈추며 하나를 뽑아주는 룰렛 웹 프로그램을 만들어줘. 칸에는 예시 항목을 미리 채워 넣고, 아이들이 켜자마자 바로 돌릴 수 있게 완성형으로 만들어.\n' +
     // 회전 텍스트·포인터 방향·결과 가시성이 자주 깨진다. 가장 단순한 고정 계약으로 유도하고 자동 검사도 같은 ID를 사용한다.
     '**룰렛 표시와 당첨 계약 — 반드시 지킬 것**:\n' +
-    '- 회전하는 원판은 `id="roulette-wheel"`, 고정 포인터는 `id="roulette-pointer"`, 결과 영역은 `id="roulette-result"`를 사용해. 세 요소를 모두 반드시 만들어.\n' +
+    '- 회전하는 원판은 `id="roulette-wheel"`, 고정 포인터는 `id="roulette-pointer"`, 결과 영역은 `id="roulette-result"`, 돌리기 버튼은 `id="roulette-spin"`으로 만들어.\n' +
     '- 포인터는 원판 바깥 12시 방향 가운데에 고정하고 원판과 함께 회전시키지 마. 삼각형 끝이 아래쪽, 즉 원판 중심을 정확히 향해야 해. CSS 삼각형이면 위쪽 테두리(border-top)에 색을 넣어 아래를 향하게 하고 `data-direction="down"`도 붙여.\n' +
     '- 당첨 칸 계산은 포인터가 가리키는 12시 방향을 기준으로 해. 눈에 보이는 칸과 계산된 결과가 반드시 같아야 해.\n' +
     '- 결과 영역에는 처음에 짧은 안내를 보여주고, 5초 안에 회전을 끝낸 뒤 `당첨 결과: 항목명`을 24px 이상의 큰 글자로 바꿔 보여줘. `aria-live="polite"`를 붙여. 결과를 팝업이나 색종이 뒤에 가리지 마.\n' +
     '- 원판 크기는 `min(72vw, 42vh, 320px)` 안에서 반응형으로 잡고, 작은 화면에서도 제목·원판·돌리기 버튼·결과가 보이게 해. `body`에 `overflow: hidden`을 쓰지 마.\n' +
     '**룰렛 한글 글자 배치 — 반드시 지킬 것**:\n' +
     '- 항목 이름은 절대 회전시키지 마. 모든 글자는 똑바로(수평으로) 읽혀야 해. 이게 가장 중요해.\n' +
-    '- 가장 안전한 방법(권장): 원판 칸은 색(원하면 1,2,3… 번호)만 넣어 단순하게 그리고, 항목 이름 전체는 원판 옆이나 아래에 번호와 함께 세로로 나열한 가로 목록(범례)으로 보여줘. 예: "① 김밥  ② 라면  ③ 피자 …". 그리고 룰렛이 멈추면 뽑힌 항목을 화면에 큰 글씨로 똑바로 보여줘.\n' +
-    '- 칸 안에 직접 이름을 넣고 싶으면, HTML 글자를 각 칸 위치(중심에서 바깥쪽)에 놓되 회전(transform: rotate)을 쓰지 말고 수평 그대로 둬. 여러 칸 글자가 겹치거나 중앙에 뭉치지 않게 해.\n' +
-    '- canvas에 글자를 회전시켜 그리지 마.',
+    '- 원판에는 색과 번호만 쓰고, 항목 이름은 수평으로 읽을 수 있는 범례에 표시해. 칸 중심 방향의 번호를 원판과 함께 도는 실제 DOM/SVG 요소로 그려 번호 N에 `data-roulette-slot="N"`을 붙여. `id="roulette-legend"` 목록의 각 줄에 `data-roulette-item="N"`을 붙이고 이름만 담은 안쪽 요소에 `data-roulette-label`을 붙여. 번호는 회전마다 1부터 연속으로 배정해.\n' +
+    '- 고정 칸 모드의 예시 항목 수는 고른 칸 수에 맞춰 줄이거나 보충해. 명단을 바꾸는 모드는 실제 항목 수에 맞춰 칸·번호·범례를 함께 갱신해. 원판 위 글자와 번호는 겹치지 않게 해.',
   buildName: (a) => {
     const labels: Record<string, string> = {
       lunch: '점심 메뉴 룰렛',
@@ -58,22 +57,22 @@ export const roulette: ProgramType = {
       showIf: (a) => a.use === 'name',
       options: [
         { id: 'preset', label: '미리 적혀있게', icon: '📝', promptFragment: '이름은 미리 적힌 예시 이름을 사용해.' },
-        { id: 'type', label: '직접 타이핑', icon: '⌨️', promptFragment: '이름을 직접 타이핑해서 추가하고 삭제할 수 있는 입력 칸을 넣어줘.' },
-        { id: 'count', label: '숫자로 인원 수', icon: '🔢', promptFragment: '인원 수를 숫자로 입력하면 번호가 자동으로 칸에 채워지게 해줘.' },
+        { id: 'type', label: '직접 타이핑', icon: '⌨️', promptFragment: '이름을 입력해 추가하거나 삭제할 수 있게 해. 예시 이름으로 시작하고 실제 명단의 사람 수에 맞춰 칸을 다시 그려. 두 명 미만이면 먼저 이름을 더 넣으라고 알려줘.' },
+        { id: 'count', label: '숫자로 인원 수', icon: '🔢', promptFragment: '2부터 30까지의 정수로 인원 수를 받으면 숫자 1부터 입력한 수까지 칸에 채워. 처음에는 예시 인원으로 시작하고 범위 밖이나 소수에는 쉬운 안내를 보여줘.' },
       ],
     },
 
-    // Step 3 — 몇 명 (Chain B: namemethod==='type' 일 때) [2-level chain 완성]
+    // Step 3 — 직접 입력 명단의 최대 인원
     {
       id: 'namecount',
       role: 'goal',
-      question: '보통 몇 명을 뽑아?',
-      showIf: (a) => a.namemethod === 'type',
+      question: '이름을 몇 명까지 넣을까?',
+      showIf: (a) => a.use === 'name' && a.namemethod === 'type',
       options: [
-        { id: 'n5', label: '5명 이하', icon: '🖐️', promptFragment: '이름 칸은 최대 5개까지 입력할 수 있게 해줘.' },
-        { id: 'n10', label: '6~10명', icon: '🔟', promptFragment: '이름 칸은 최대 10개까지 입력할 수 있게 해줘.' },
-        { id: 'n20', label: '11~20명', icon: '2️⃣', promptFragment: '이름 칸은 최대 20개까지 입력할 수 있게 해줘.' },
-        { id: 'n30', label: '20명 이상', icon: '🏫', promptFragment: '이름 칸은 최대 30개까지 입력할 수 있게 해줘.' },
+        { id: 'n5', label: '최대 5명', icon: '🖐️', promptFragment: '이름 칸은 최대 5개까지 입력할 수 있게 해줘.' },
+        { id: 'n10', label: '최대 10명', icon: '🔟', promptFragment: '이름 칸은 최대 10개까지 입력할 수 있게 해줘.' },
+        { id: 'n20', label: '최대 20명', icon: '2️⃣', promptFragment: '이름 칸은 최대 20개까지 입력할 수 있게 해줘.' },
+        { id: 'n30', label: '최대 30명', icon: '🏫', promptFragment: '이름 칸은 최대 30개까지 입력할 수 있게 해줘.' },
       ],
     },
 
@@ -82,6 +81,7 @@ export const roulette: ProgramType = {
       id: 'slots',
       role: 'appearance',
       question: '칸을 몇 개 만들까?',
+      showIf: (a) => a.use !== 'name' || a.namemethod === 'preset',
       options: [
         { id: 's4', label: '4칸 (적게)', icon: '4️⃣', promptFragment: '룰렛 칸을 4개로 만들어.' },
         { id: 's6', label: '6칸 (보통)', icon: '6️⃣', promptFragment: '룰렛 칸을 6개로 만들어.' },
@@ -127,7 +127,7 @@ export const roulette: ProgramType = {
         { id: 'tick', label: '틱틱 소리', icon: '🎵', promptFragment: '룰렛이 돌아갈 때 Web Audio로 틱틱 소리가 나게 해.' },
         { id: 'whirl', label: '윙~ 소리', icon: '💨', promptFragment: '룰렛이 돌아갈 때 Web Audio로 윙윙 소리가 나게 해.' },
         { id: 'drum', label: '두구두구 소리', icon: '🥁', promptFragment: '룰렛이 돌아갈 때 Web Audio로 두구두구 드럼 소리가 나게 해.' },
-        { id: 'none', label: '조용하게', icon: '🔇', promptFragment: '룰렛이 돌거나 멈출 때 음악·효과음을 넣지 마.' },
+        { id: 'none', label: '도는 동안 조용하게', icon: '🔇', promptFragment: '룰렛이 도는 동안에는 음악·효과음을 넣지 마.' },
       ],
     },
 
@@ -136,7 +136,7 @@ export const roulette: ProgramType = {
       id: 'soundmood',
       role: 'sound',
       question: '어떤 느낌 소리가 좋아?',
-      showIf: (a) => a.spinsound !== 'none',
+      showIf: (a) => a.spinsound === 'tick' || a.spinsound === 'whirl' || a.spinsound === 'drum',
       options: [
         { id: 'fun', label: '신나게', icon: '🥳', promptFragment: 'Web Audio 효과음을 신나고 경쾌한 느낌으로 만들어.' },
         { id: 'tense', label: '긴장감 있게', icon: '😬', promptFragment: 'Web Audio 효과음을 긴장감 있고 스릴 있는 느낌으로 만들어.' },
@@ -163,11 +163,11 @@ export const roulette: ProgramType = {
     {
       id: 'bigshow',
       role: 'output',
-      question: '뽑힌 사람 이름을 크게 보여줄까?',
+      question: '당첨 결과에 축하 효과를 더할까?',
       showIf: (a) => a.use === 'name',
       options: [
-        { id: 'yes', label: '응, 크게!', icon: '🎤', promptFragment: '뽑힌 이름을 화면 한가운데에 아주 크게 잠깐 보여줘.' },
-        { id: 'no', label: '아니, 칸에만', icon: '🙂', promptFragment: '뽑힌 이름을 화면 가운데에 별도로 크게 펼쳐 보이지 마.' },
+        { id: 'yes', label: '응, 축하해요!', icon: '🎤', promptFragment: '당첨 결과를 가리지 않는 곳에 이름과 축하 효과를 함께 보여줘.' },
+        { id: 'no', label: '결과만 볼래요', icon: '🙂', promptFragment: '당첨 결과는 항상 보여주고, 이름을 따로 보여주는 축하 화면은 만들지 마.' },
       ],
     },
 
@@ -176,9 +176,9 @@ export const roulette: ProgramType = {
       id: 'celebrate',
       role: 'output',
       question: '축하를 어떻게 보여줄까?',
-      showIf: (a) => a.bigshow === 'yes',
+      showIf: (a) => a.use === 'name' && a.bigshow === 'yes',
       options: [
-        { id: 'overlay', label: '화면 전체에 크게', icon: '📺', promptFragment: '뽑힌 이름을 화면 전체를 가리는 팝업에 크게 보여줘.' },
+        { id: 'overlay', label: '결과를 더 크게', icon: '📺', promptFragment: '당첨 결과 영역 안에서 뽑힌 이름 글씨를 더 크게 보여줘. 화면을 가리는 팝업은 넣지 마.' },
         { id: 'banner', label: '위에서 배너로', icon: '🎏', promptFragment: '뽑힌 이름이 위에서 아래로 내려오는 배너 형태로 보여줘.' },
         { id: 'emoji', label: '이모지 폭탄', icon: '🎆', promptFragment: '뽑힌 이름 주위에 이모지와 별이 폭발하듯 터지는 효과를 넣어.' },
         { id: 'glow', label: '빛나는 글씨', icon: '💡', promptFragment: '뽑힌 이름이 빛나고 커졌다 작아지는 애니메이션으로 보여줘.' },
@@ -191,8 +191,8 @@ export const roulette: ProgramType = {
       role: 'output',
       question: '다시 돌리기 버튼을 넣을까?',
       options: [
-        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '결과 아래에 다시 돌리기 버튼을 넣어.' },
-        { id: 'exclude', label: '뽑힌 건 빼고 다시', icon: '❌', promptFragment: '결과 아래에 "다시 돌리기" 버튼을 넣어. 뽑힌 항목은 자동으로 제외돼.' },
+        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '결과 아래에 다시 돌리기 버튼(id="roulette-again")을 넣어. 같은 항목도 다시 뽑힐 수 있어.' },
+        { id: 'exclude', label: '뽑힌 건 빼고 다시', icon: '❌', promptFragment: '결과 아래에 다시 돌리기 버튼(id="roulette-again")을 넣어. 다음 회전을 시작할 때 직전 당첨 항목 하나를 빼고 원판과 범례를 다시 만들어. 마지막 항목까지 뽑으면 종료 안내와 처음부터 버튼을 보여줘.' },
         { id: 'no', label: '룰렛 다시 누르면 돌아가요', icon: '👆', promptFragment: '별도의 다시 돌리기 버튼을 넣지 말고, 룰렛 자체를 다시 누르면 돌아가게 해.' },
       ],
     },
[브라우저 검사 모듈]
// These probes run only in the local sandboxed preview. They use what the
// student can see and click, without executing the generated app in Node.
const action = { timeout: 900 };
const read = { timeout: 600 };
const quizTimerSeconds = { yes10: 10, yes20: 20, yes30: 30 };
export const hasQuizTimer = (answers) => Boolean(quizTimerSeconds[answers.timer]);

async function visibleText(locator) {
  return await locator.isVisible() ? (await locator.innerText(read)).trim() : '';
}

async function waitUntil(page, predicate, timeout = 1000) {
  const deadline = Date.now() + timeout;
  do {
    if (await predicate()) return true;
    await page.waitForTimeout(40);
  } while (Date.now() < deadline);
  return false;
}

export async function inspectQuiz(frame, page, answers, fail) {
  const question = frame.locator('#quiz-question');
  const confirm = frame.locator('#quiz-confirm');
  const feedback = frame.locator('#quiz-feedback');
  const next = frame.locator('#quiz-next');
  const input = frame.locator('#quiz-answer');
  const options = frame.locator('[data-quiz-option]:visible');
  const finish = frame.locator('#quiz-finish');
  const restart = frame.locator('#quiz-restart');
  const record = { graded: [], restarted: false };

  if (!(await question.isVisible()) || !(await confirm.isVisible()) || await feedback.count() !== 1) {
    fail('contract', '문제·확인 버튼·채점 안내 영역이 필요함');
    return record;
  }
  const first = await visibleText(question);
  const firstInput = await input.isVisible();
  const expectedOptions = { ox: 2, choice2: 2, choice4: 4 }[answers.answer];
  if ((answers.answer === 'type' && !firstInput)
      || (['ox', 'choice2', 'choice4', 'picture'].includes(answers.answer) && firstInput)) {
    fail('input', '선택한 답 입력 방식과 실제 조작이 다름');
  }

  await confirm.click(action);
  if (!(await waitUntil(page, async () => (await feedback.getAttribute('data-quiz-state', read)) === 'empty'))
      || !(await visibleText(feedback)) || await visibleText(question) !== first || await next.isVisible()) {
    fail('empty', '답을 비운 채 확인하면 안내만 보여야 함');
    return record;
  }

  for (let round = 0; round < 15; round++) {
    const before = await visibleText(question);
    const typed = await input.isVisible();
    const optionCount = await options.count();
    if (!before || (!typed && optionCount < 2)) {
      fail('question', '문제나 조작 가능한 답 입력이 없음');
      return record;
    }
    if (!typed && expectedOptions && optionCount !== expectedOptions) fail('input', '고른 보기 개수가 아님');
    if (typed) {
      const type = await input.getAttribute('type', read);
      await input.fill(type === 'number' || await input.getAttribute('inputmode', read) === 'numeric' ? '987654321' : '확인용오답987654321', action);
    } else {
      const labels = (await options.allInnerTexts()).map(label => label.trim());
      if (labels.some(label => !label) || new Set(labels).size !== optionCount) {
        fail('options', '보기에 빈 항목이나 중복 답이 있음');
        return record;
      }
      await options.first().click(action);
    }
    if (await next.isVisible()) {
      fail('confirm', '보기 선택만으로 문제를 채점함');
      return record;
    }
    if (typed && round === 1) await input.press('Enter', action);
    else await confirm.click(action);

    await waitUntil(page, async () => ['correct', 'incorrect', 'timeout'].includes(await feedback.getAttribute('data-quiz-state', read)));
    const state = await feedback.getAttribute('data-quiz-state', read);
    const message = await visibleText(feedback);
    const explanation = await visibleText(frame.locator('#quiz-explanation'));
    const correction = await visibleText(frame.locator('#quiz-correction'));
    if (!(typed ? state === 'incorrect' : ['correct', 'incorrect'].includes(state)) || !message
        || !explanation || !correction || !(await next.isVisible()) || await visibleText(question) !== before) {
      fail('grade', '확인 후 같은 문제에서 정오답·정답·설명·다음 버튼이 함께 보여야 함');
      return record;
    }
    if (answers.topic === '숫자') {
      const equation = before.match(/^(?:[0-9]+[.)]\s*)?(\d+)\s*([+−\-×*])\s*(\d+)\s*(?:=\s*\?)?\s*\??$/);
      const answer = correction.match(/(?:^|정답\s*[:：]\s*)(-?\d+)\s*$/);
      if (equation && answer) {
        const [, left, op, right] = equation;
        const a = Number(left), b = Number(right);
        const expected = op === '+' ? a + b : op === '×' || op === '*' ? a * b : a - b;
        if (expected < 0 || Number(answer[1]) !== expected) fail('math', '표시한 정답이 계산식과 맞지 않음');
      }
    }
    record.graded.push(state);
    if (await confirm.isVisible() && await confirm.isEnabled()) {
      await confirm.click(action);
      if (await visibleText(question) !== before || await visibleText(feedback) !== message
          || await feedback.getAttribute('data-quiz-state', read) !== state) {
        fail('repeat', '같은 답을 다시 확인했을 때 문제나 채점 결과가 바뀜');
        return record;
      }
    }
    await next.click(action);
    if (!(await waitUntil(page, async () => await finish.isVisible() || (await visibleText(question)) !== before))) {
      fail('next', '다음 버튼을 눌러도 문제나 결과 화면으로 넘어가지 않음');
      return record;
    }
    if (await finish.isVisible()) {
      const count = Number(answers.count);
      if (count > 0 && (record.graded.length > count || (answers.lives !== 'yes' && answers.lives !== 'aichoose' && record.graded.length !== count))) {
        fail('count', '선택한 문제 수와 실제로 푼 문제 수가 다름');
      }
      if (!(await visibleText(finish)) || !(await restart.isVisible())) {
        fail('finish', '결과나 다시하기 버튼이 없음');
        return record;
      }
      await restart.click(action);
      record.restarted = await waitUntil(page, async () => await question.isVisible() && await confirm.isVisible()
        && !(await finish.isVisible()) && !(await next.isVisible()));
      if (!record.restarted) {
        fail('restart', '다시하기 후 첫 문제를 새로 풀 수 없음');
      } else if (hasQuizTimer(answers)) {
        const afterRestart = await visibleText(question);
        await page.clock.runFor(quizTimerSeconds[answers.timer] * 1000 + 750);
        record.timeout = await feedback.getAttribute('data-quiz-state', read) === 'timeout'
          && await visibleText(question) === afterRestart && await next.isVisible()
          && Boolean(await visibleText(frame.locator('#quiz-correction')))
          && Boolean(await visibleText(frame.locator('#quiz-explanation')));
        if (!record.timeout) fail('timer', '시간이 끝나도 같은 문제에 정답·설명과 다음 버튼이 나타나지 않음');
      }
      return record;
    }
  }
  fail('finish', '15문제를 풀어도 결과 화면이 나오지 않음');
  return record;
}

async function readRoulette(frame) {
  return frame.evaluate(() => {
    const wheel = document.querySelector('#roulette-wheel');
    const pointer = document.querySelector('#roulette-pointer');
    const result = document.querySelector('#roulette-result');
    if (!wheel || !pointer || !result) return null;
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const { visibility, display, opacity } = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && visibility === 'visible' && display !== 'none' && Number(opacity) > 0;
    };
    const center = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const origin = center(wheel);
    const angle = (el) => {
      const c = center(el);
      return Math.atan2(c.x - origin.x, origin.y - c.y);
    };
    const pointerAngle = angle(pointer);
    const distance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const markers = [...wheel.querySelectorAll('[data-roulette-slot]')].map(el => ({
      number: Number(el.getAttribute('data-roulette-slot')),
      text: el.textContent.trim(),
      distance: distance(angle(el), pointerAngle),
      visible: visible(el),
    })).sort((a, b) => a.distance - b.distance);
    const legend = [...document.querySelectorAll('#roulette-legend [data-roulette-item]')].map(el => {
      const label = el.querySelector('[data-roulette-label]');
      return { number: Number(el.getAttribute('data-roulette-item')), label: label?.textContent.trim() || '', visible: !!label && visible(label) };
    });
    return {
      count: Number(wheel.getAttribute('data-spin-count') ?? Number.NaN),
      markers,
      legend,
      result: result.innerText.trim(),
      resultVisible: visible(result),
    };
  });
}

export async function inspectRouletteSpins(frame, page, answers, fail) {
  const before = await readRoulette(frame);
  const spins = [];
  if (!before || before.count !== 0) {
    fail('contract', '회전 원판에 완료한 회전 횟수 data-spin-count=0이 필요함');
    return spins;
  }
  const spin = frame.locator('#roulette-spin');
  if (!(await spin.isVisible())) {
    fail('trigger', '돌리기 버튼이 없음');
    return spins;
  }
  const dynamic = answers.use === 'name' && answers.namemethod !== 'preset';
  const expectedCount = dynamic ? null : ({ s4: 4, s6: 6, s8: 8, s10: 10 })[answers.slots];
  if (before.legend.length < 2 || (expectedCount && before.legend.length !== expectedCount)) {
    fail('count', '처음에 돌릴 수 있는 항목이나 고른 고정 칸 수가 맞지 않음');
    return spins;
  }
  let previous = before;
  let previousWinner = '';
  for (let turn = 0; turn < 2; turn++) {
    const target = turn === 0 ? spin : answers.again === 'no'
      ? frame.locator('#roulette-wheel') : answers.again === 'yes' || answers.again === 'exclude'
      ? frame.locator('#roulette-again') : spin;
    if (!(await target.isVisible())) {
      fail('trigger', '고른 방식으로 다시 돌릴 조작이 없음');
      return spins;
    }
    if (turn === 1) await page.emulateMedia({ reducedMotion: 'reduce' });
    await target.click(action);
    if (turn === 0) {
      await target.evaluate((button, count) => {
        const wheel = document.querySelector('#roulette-wheel');
        if (Number(wheel?.getAttribute('data-spin-count')) === count) button.click();
      }, previous.count);
    }
    let current;
    if (!(await waitUntil(page, async () => {
      current = await readRoulette(frame);
      return current?.count === previous.count + 1;
    }, 5800))) {
      fail('settle', '회전을 시작한 뒤 6초 안에 한 번의 당첨이 확정되지 않음');
      return spins;
    }
    const { markers, legend, result, resultVisible } = current;
    const count = markers.length;
    const winner = legend.find(item => item.number === markers[0]?.number)?.label;
    const expectedNumbers = Array.from({ length: count }, (_, index) => index + 1).join(',');
    if (!count || count > 30 || legend.length !== count
        || markers.some(m => !m.visible || m.text !== String(m.number))
        || legend.some(item => !item.label || !item.visible)
        || markers.map(m => m.number).sort((a, b) => a - b).join(',') !== expectedNumbers
        || legend.map(item => item.number).sort((a, b) => a - b).join(',') !== expectedNumbers) {
      fail('legend', '원판의 번호와 읽을 수 있는 범례가 1:1로 대응하지 않음');
      return spins;
    }
    if (markers[0].distance > (2 * Math.PI / count) * 0.4 || !winner
        || result !== '당첨 결과: ' + winner || !resultVisible) {
      fail('result', '포인터가 가리킨 칸·범례·당첨 결과가 일치하지 않음');
      return spins;
    }
    if (turn === 0 && previous.legend.length !== count) {
      fail('count', '첫 회전에서 시작 항목 수가 바뀜');
      return spins;
    }
    if (turn === 1 && answers.again !== 'exclude'
        && legend.map(item => item.label).join('\n') !== previous.legend.map(item => item.label).join('\n')) {
      fail('count', '일반 재회전에서 후보가 바뀜');
      return spins;
    }
    if (turn === 1 && answers.again === 'exclude') {
      const remaining = previous.legend.map(l => l.label);
      remaining.splice(remaining.indexOf(previousWinner), 1);
      if (remaining.sort().join('\n') !== legend.map(l => l.label).sort().join('\n')) {
        fail('exclude', '두 번째 회전에 직전 당첨 항목 하나만 제외돼야 함');
        return spins;
      }
    }
    spins.push({ count, winner, slot: markers[0].number });
    previous = current;
    previousWinner = winner;
  }
  return spins;
}

## 답변 (Claude, 2026-11-22 13:02 KST)

원문 id: 2026-11-22-quiz-roulette-implementation · 확인 HEAD: 미확인 · 검토 SHA: bdfaad693746e7d30c5cb25738330462d1ab22eb

## 실제 본 범위
- 기준 트리에서 읽은 파일: `lib/survey/programs/quiz.ts`, `lib/survey/programs/roulette.ts`, `lib/survey/assemble.ts`, `lib/survey/types.ts:9`(`AI_PICK = 'aichoose'`), `lib/ai/typeGuides.ts:220-247`
- 편지에 붙은 diff와 검사 모듈 발췌는 자료로만 봤습니다. 반영된 트리와 새 검사 모듈 파일은 읽지 못했습니다.
- 실행한 것은 없습니다.

## 결론
- 검사가 통과하는데 실제로는 치명적인 결함이 있는 경우(치명적 오탐)는 찾지 못했습니다.
- 대신 정상 결과를 실패로 판정할 수 있는 조건이 4건 있습니다(1~4).
- 선택이나 문구가 충돌하는 곳이 1건 있습니다(5).
- 가볍게 통과시키는 곳이 1건 있습니다(6).

## 지적

**1. 룰렛 결과를 한 번만 읽어서 생기는 경합 (오판 가능)**
- `data-spin-count`가 +1 되는 순간 `readRoulette`를 한 번만 읽고 결과 문구를 비교합니다.
- 생성 코드가 개수를 먼저 올리고 문구를 다음 프레임에 쓰면 `result` 실패가 납니다.
- 권장: count가 올라간 뒤 300ms 정도 `result === '당첨 결과: ' + winner`를 `waitUntil`로 다시 확인하세요.

**2. 룰렛 표기 형식 때문에 생기는 실패 (오판 가능)**
- 번호 마커 문구:
  - 검사는 `m.text !== String(m.number)`이면 실패로 봅니다.
  - 그런데 프롬프트는 "번호"라고만 쓰고, 이전 문구에는 "①" 예시가 있었습니다.
  - 그래서 "①"이나 "1번"을 쓴 정상 결과가 `legend` 실패가 됩니다.
  - 프롬프트에 "아라비아 숫자만"을 명시하거나, 검사에서 숫자를 정규화해 비교하세요.
- 결과 영역 문구:
  - 검사는 `#roulette-result`의 `innerText`가 정확히 같아야 통과입니다.
  - 그런데 `bigshow.yes`의 "이름과 축하 효과를 함께"와 `celebrate.overlay`의 "결과 영역 안에서"는 결과 영역 안에 "축하해요!"를 덧붙이게 유도합니다.
  - "`#roulette-result`에는 그 문장만 두고 축하 요소는 형제 요소로"라고 명시하세요.

**3. AI 선택(`aichoose`) 분기 (오판 가능)**
- `again`이 `aichoose`일 때:
  - 검사는 `#roulette-spin`을 누르고 후보 목록이 그대로이기를 기대합니다.
  - AI가 제외 방식을 고르면 "일반 재회전에서 후보가 바뀜"으로 실패합니다.
  - 이 경우 두 번째 회전 비교는 건너뛰거나, "그대로이거나 하나만 빠짐"을 둘 다 허용하세요.
- 퀴즈 `playmode=friend`일 때:
  - `count=5`가 전체 5문제인지 1인당 5문제인지 정해져 있지 않습니다.
  - 1인당으로 만들면 푼 문제가 10개가 되어 `count` 실패가 납니다.
  - 가이드에 "문제 수는 두 사람 합계"처럼 한 줄 넣으세요.
  - 이름 입력이나 차례 화면이 먼저 뜨면 restart 판정도 실패할 수 있습니다(추측).

**4. 퀴즈 시간 종료 검사의 전제 조건 (미확인)**
- `page.clock.runFor`는 그전에 `clock.install()`이 불려 있어야 합니다.
- 기준 트리의 `inspect-quality-actions.mjs`에서는 install 호출을 찾지 못했습니다(Grep: `clock` 결과가 clock 유형 검사뿐).
- 새 진입부에서 프레임을 불러오기 전에 install하는지 확인해 주세요.
  - install이 없으면 실패 처리가 아니라 예외가 나서 멈춥니다.
  - install이 페이지 로드 뒤에 되면, 이미 잡힌 interval에는 적용되지 않을 수 있습니다.

**5. 선택지 문구끼리 충돌 (선택 유실은 아님)**
- `namecount=n5`인데 `use=name`의 예시 이름은 6명(`roulette.ts:43`)입니다. 최대 5명과 맞지 않습니다.
  - "예시 이름은 최대 인원 이하로"를 `type`의 문구에 넣으세요.
- `timer=aichoose`이면 이제 `timer_warn`이 숨겨집니다. 의도한 변경이면 괜찮습니다.
  - 다만 과거에 저장한 답을 다시 조립하면 `slots`와 `timer_warn` 조각이 빠집니다(`assemble.ts:27`의 `visibleSteps` 필터).
  - 기존 작품의 계획 요약이 달라질 수 있으니 알고 넘어가면 됩니다.

**6. 가볍게 통과시키는 곳 (치명적이지 않음)**
- 퀴즈 계산 검사:
  - 정규식이 식만 있는 문제와 "정답: N" 꼴만 잡습니다.
  - "3 + 4는 얼마일까요?"나 "정답은 7이에요" 같은 일반적인 문장은 조용히 건너뜁니다.
  - 곱셈이 한 자리 수인지도 검사하지 않습니다.
- 보기형 퀴즈:
  - 늘 첫 보기만 누르므로 정답 자리가 늘 같아도 잡지 못합니다.
  - correct 비율을 기록해 두기를 권합니다.
- 룰렛 가림:
  - `visible()`은 결과 요소 자체의 스타일만 봅니다.
  - 배너나 이모지 효과가 결과를 덮어도 통과합니다.
  - `elementFromPoint`로 결과 중심을 확인하는 항목을 추가하기를 권합니다.

## 문제없음으로 본 부분
- `spinsound.none`의 새 문구는 `requestsAudio`의 제외 패턴(`typeGuides.ts:229`, `효과음.*넣지 마`)에 걸립니다. `stopfx.cheer`만 오디오 가이드를 켭니다.
- `soundmood`와 `celebrate`의 showIf는 `aichoose`일 때도 일관됩니다.
- `slots` 숨김과 검사기의 `dynamic` 판정이 같은 조건(`namemethod !== 'preset'`)을 씁니다.

## 미확인 사항
- 작업 트리 HEAD와 검토 SHA가 같은지는 셸이 없어 확인하지 못했습니다.
- 새 검사 모듈의 진입부는 읽지 못했습니다. `clock.install` 시점, reduced-motion 에뮬레이션이 뒤쪽 검사에 남는지, 정상 5와 오류 2 예시의 내용이 여기에 해당합니다.
- Playwright clock이 sandbox된 cross-origin iframe의 타이머에 적용되는지
- 반영된 트리의 `typeGuides.ts`와 `quiz.ts`/`roulette.ts` 전체는 diff로만 봤습니다.
- 실제 생성 재시험(유료)은 하지 않았습니다. 하려면 승인이 필요합니다.

### 호출 기록

```json
{
  "target": "claude",
  "status": "success",
  "phase": "complete",
  "tier": "normal",
  "requested_model": "claude-opus-5-5",
  "requested_effort": "medium",
  "response_models": [
    "claude-opus-5-5"
  ],
  "response_model_source": "assistant.message.model",
  "model_match": true,
  "response_effort": null,
  "response_effort_source": "not_exposed_by_cli",
  "requested_review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "caller_head": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "head_before": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "head_after": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "reported_head": null,
  "reported_review_sha": "bdfaad693746e7d30c5cb25738330462d1ab22eb",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-22T04:00:44.445Z",
  "elapsed_ms": 107756,
  "usage": {
    "input_tokens": 8,
    "output_tokens": 9282,
    "cache_read_input_tokens": 127717,
    "cache_creation_input_tokens": 47695
  },
  "cli_elapsed_ms": 105492,
  "exit_code": 0,
  "timed_out": false
}
```
