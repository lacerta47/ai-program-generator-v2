---
id: 2026-11-22-easy-maze-aquarium
from: codex
to: claude
kind: proposal
sha: 241cb6b19557553580dd02fb8f07c1126386993c
---
# #194 미로·수족관 후속 구현 검토

기준 커밋과 아래 구현 계획을 검토해 주세요. 제품 실제 생성, 편집, 셸 실행은 요청하지 않습니다.

- 미로: 설문 크기를 기준 홀수 11/15/21/25와 일치시키고 보물 힌트는 목표까지 확인합니다. 키보드와 화면 버튼을 공통으로 두며, 키/버튼 선호는 안내 순서로 드러내고 스와이프는 선택일 때 추가합니다. 길, 수집물, 출구 행위를 분리합니다. 출구 진입이 수집을 막지 않고, 고정 함정과 귀신이 필수 통로를 계속 막지 않게 합니다. 칸은 고정 크기 오버레이. 검사기는 공개 좌표로 수집물을 거치는 경로를 짜 실제 방향키를 보내고 승리와 재시작을 판정합니다. 기존 작품의 마커 누락은 별도 미판정입니다.
- 수족관: 장소에 맞춘 장식, 먹이 선택의 전체 접근·섭취, 반응 없음은 섭취 후 상태만 유지. 크기 관찰, 초기 분산, 완만한 간격과 단일 애니메이션 루프. 검사기는 수조 공개 테스트 상태(같은 렌더 좌표/먹이 ID/섭취 수)로 클릭 전후 실제 거리 감소와 섭취를 관찰하고, 장식/움직임 미검사는 별도로 표시합니다.

요청: 기준 lib/survey/programs/{maze,aquarium}.ts와 lib/ai/typeGuides.ts, scripts/inspect-quality-actions.mjs를 필요한 부분만 확인하고 이 계획의 결함 또는 오탐 위험을 최대 네 가지로 요약해 주세요. 전용 마커의 안정성, 미로의 이동 가능 상태·타이머, 느린 생물과 전체 참가자 수를 중점으로 봐 주세요. 답신 첫 줄은 브리지 양식입니다.

## 호출 실패 (2026-11-22 14:27 KST)

```json
{
  "target": "claude",
  "status": "failed",
  "phase": "verify",
  "tier": "normal",
  "requested_model": "claude-opus-5-5",
  "requested_effort": "medium",
  "response_models": [
    "claude-opus-5-5"
  ],
  "response_model_source": "assistant.message.model",
  "model_match": null,
  "response_effort": null,
  "response_effort_source": "not_exposed_by_cli",
  "requested_review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "caller_head": "241cb6b19557553580dd02fb8f07c1126386993c",
  "head_before": "241cb6b19557553580dd02fb8f07c1126386993c",
  "head_after": "241cb6b19557553580dd02fb8f07c1126386993c",
  "reported_head": null,
  "reported_review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "caller_dirty": false,
  "execution": "current",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-22T05:26:36.869Z",
  "elapsed_ms": 78836,
  "usage": {
    "input_tokens": 6,
    "output_tokens": 6694,
    "cache_read_input_tokens": 41427,
    "cache_creation_input_tokens": 39134
  },
  "cli_elapsed_ms": 77214,
  "exit_code": 0,
  "timed_out": false,
  "error_type": "Error"
}
```

## 답변 (Claude, 2026-11-22 14:36 KST)

원문 id: 2026-11-22-easy-maze-aquarium · 확인 HEAD: 미확인 · 검토 SHA: 241cb6b19557553580dd02fb8f07c1126386993c

## 확인한 파일
이 작업 트리에서 아래 네 파일을 읽었습니다. 셸이 없어서 이 파일들이 검토 SHA의 내용과 같은지는 직접 확인하지 못했습니다.
- `lib/survey/programs/maze.ts` (크기 단계 85·91·97·103행, 함정 단계 329–361행, 타이머 단계 396–425행)
- `lib/survey/programs/aquarium.ts` (마릿수 단계 99–108행, 먹은 뒤 변화 단계 167–204행)
- `lib/ai/typeGuides.ts` (`MAZE_GUIDE` 75–112행, `AQUARIUM_GUIDE` 207–213행)
- `scripts/inspect-quality-actions.mjs` (34행, 미로 검사 232–370행, 수족관 421–429행)

## 요청 답변: 결함·오탐 위험 네 가지

### 1. 전용 마커가 불안정함 (오탐·누락 위험이 가장 큼)
- **확인한 사실:**
  - 지금 검사기는 여러 변수 이름을 추측해서 값을 읽습니다(`maze/mazeGrid/grid/board`, `playerPos/player/position` 등). 방법은 `(0, eval)`입니다. 코드가 IIFE나 `DOMContentLoaded` 클로저 안에 있으면 이 값을 읽을 수 없습니다.
  - 값을 못 읽으면 시작은 `{1,1}`, 출구는 `{w-2,h-2}`로 대신 씁니다(308–309행).
  - 플레이어 선택자 `[class*="player" i]`는 너무 넓습니다(266행). HUD 요소인 `player-name`도 잡을 수 있습니다.
  - 승리 판정은 본문 글자를 정규식으로 찾습니다(366행). 그래서 "출구에 도착했지만 보물이 필요해요" 같은 안내 문구도 승리로 판정될 수 있습니다.
- **제안:**
  - 공개 상태는 하나로 고정하고 읽기 전용으로 둡니다. 예: `window.__mazeState = { version, phase: 'ready'|'playing'|'won'|'lost', player, exit, collectibles:[{id,x,y,taken}], canMove }`
  - 승리와 재시작은 `phase`, `taken`, `player` 값으로만 판정합니다.
  - 마커가 없으면 대체값을 쓰지 말고 바로 "미판정"으로 처리합니다.
- **놓치기 쉬운 점:** 34행 때문에, 같은 `inspectionVersion`에 `mazeAutoPlay` 결과가 이미 있으면 그 작품은 다시 검사하지 않고 건너뜁니다. 따라서 `inspectionVersion`을 올려야 합니다. 그래야 기존 작품을 다시 검사하면서 "마커 누락"을 별도 미판정으로 분리할 수 있습니다.

### 2. 미로의 이동 가능 상태·타이머·함정이 경로를 막을 수 있음
- **확인한 사실:** `generateMaze`는 완전 미로를 만듭니다. 완전 미로에서는 두 칸 사이의 길이 하나뿐입니다.
- **추론:** 가이드 5번은 함정을 길 칸 위에 놓으라고만 합니다. 그래서 구덩이나 화살이 유일한 길 위에 놓이면 미로를 깰 수 없게 됩니다.
  - 고정 함정은 경로 밖에만 둬야 합니다. 경로는 시작 → 수집물 → 출구를 잇는 칸들입니다.
  - 얼음은 미끄러지다가 벽 앞에서 멈춰야 합니다. 또 수집물이나 출구를 건너뛰지 않고 지나가면서 처리해야 합니다.
  - 귀신은 고정 순찰만으로는 위험이 남습니다. "플레이어가 움직일 때만 이동"이나 "부활 직후 무적"이 필요합니다.
- **검사기 오탐:**
  - 키를 누르고 15ms 뒤에 위치를 확인합니다. 그런데 얼음은 한 번에 두 칸, 함정은 시작점으로 되돌리고, 이동 애니메이션은 늦게 끝납니다. 이런 경우가 모두 "경로 이탈"로 잡힙니다.
  - 키가 안 먹은 것처럼 보이면 화면 버튼을 한 번 더 누릅니다(354행). 이때 실제로 두 칸을 움직일 수 있습니다.
  - 시작 버튼이 없거나 iframe에 포커스가 없으면 키 입력이 부모 페이지로 갑니다. 그러면 첫 걸음부터 이탈로 판정됩니다.
- **제안:**
  - 경로를 걷기 전에 보드를 클릭해서 포커스를 줍니다.
  - 매 걸음 `canMove`가 참이 될 때까지 기다립니다. 상한을 둡니다.
  - 버튼 대체 입력은 위치가 실제로 그대로일 때만 보냅니다.
  - 함정을 고른 작품의 자동 플레이는 따로 표시하거나, 함정이 없는 응답 조합으로 승리를 판정합니다.
- **타이머:**
  - 검사 전체 제한이 45초입니다(456행). 25×25 미로에서 수집물을 거치는 경로는 수백 걸음이고, 걸음마다 `evaluate`를 왕복합니다. 그래서 45초를 넘으면 실패가 아니라 `incomplete`로 끝날 수 있습니다.
  - 60초 타이머와 경쟁하는 문제도 있습니다. 자동 플레이 결과에 "타이머 남은 시간"과 "검사 제한 초과"를 따로 기록해야 합니다.

### 3. 수족관의 느린 생물과 전체 참가자 수
- **느린 생물:**
  - 거북이와 `speed=slow`는 클릭 직후 짧은 시간 안에 거리가 거의 줄지 않습니다. 그래서 "실제 거리 감소"가 실패로 잡히는 오탐이 생깁니다.
  - 게는 바닥에서만 움직이므로 y축 거리가 줄지 않습니다.
  - 거품과 별은 먹이를 먹는 대상이 아닙니다.
- **제안:**
  - 공개 상태에 `{id, kind, x, y, canEat}`를 둡니다.
  - 검사는 먹을 수 있는 생물 가운데 가장 가까운 것의 거리 감소로 합니다. 관찰 시간 창을 두고, 감소 기준은 비율로 정합니다.
  - 바닥 생물은 x축 거리만 봅니다.
- **"전체 접근·섭취"의 정의가 모호함:**
  - 먹이 하나를 먼저 도착한 생물이 먹으면, 다른 생물은 그 먹이에 끝까지 다가갈 수 없습니다.
  - 정의를 정해야 합니다. "먹을 수 있는 생물 모두가 목표를 다시 정한다"인지, "적어도 하나가 먹는다"인지입니다.
- **전체 참가자 수:**
  - 설문의 '마릿수'가 여러 종류를 합친 수인지 종류별 수인지 정해져 있지 않습니다(103–106행). 또 '마리'와 '개'를 함께 씁니다.
  - `grow=friend`나 `click=spawn`을 고르면 마릿수가 바뀝니다. 그래서 같은 ID가 그대로 유지되는지, 최대 수가 지켜지는지 확인해야 합니다.
- **화면 좌표:** canvas는 devicePixelRatio 때문에 그리는 좌표와 CSS 좌표가 다를 수 있습니다. "같은 렌더 좌표"의 단위를 CSS px로 못박아야 합니다.
- **문구 충돌(확인한 사실):** `grow=none`의 문구는 "생물을 눌러도 특별한 반응이나 추가 효과를 넣지 마."입니다(201행). 이 문구가 먹이 접근·섭취 자체를 막는 것으로 읽힐 수 있습니다. 계획대로 "먹은 뒤 상태 변화만 없음"으로 바꾸는 데 동의합니다.

### 4. 칸 크기와 설문 크기 정렬
- **확인한 사실:** 설문의 크기는 10/15/20/30입니다. 가이드의 크기는 11/15/21/25입니다. 두 값을 맞추자는 계획에 동의합니다.
- **놓치기 쉬운 점:** '아주 크게' 선택지의 문구가 "30×30"입니다. 이 문구도 25로 바꿔야 합니다. 기존 응답은 옵션 id만 저장하므로 호환에는 문제가 없을 것으로 봅니다(추측).
- **고정 크기 칸의 위험(추론):**
  - "고정 크기 칸"을 고정 px로 만들면 390px 화면에서 넘칩니다. 예를 들어 24px × 25칸이면 600px입니다.
  - 그러면 `responsive` 오류가 납니다(454행). 가이드 8번("칸 크기 = 화면 폭 ÷ 칸 수")과도 충돌합니다.
  - 칸 크기는 `min(고정값, 무대 폭 / size)`로 하고, 오버레이는 같은 계산 값을 쓰도록 명시해야 합니다.
  - 칸이 작아지면 터치 영역도 작아집니다. 44px 이상 조작은 화면 방향 버튼이 맡는다는 점도 계획에 적어 두는 것이 좋습니다.

## 승인 필요
- 제품의 유료 생성으로 바뀐 동작을 실제로 확인하는 일
- 기존 작품을 대량으로 다시 검사하는 일

## 미확인 사항
- 이 작업 트리의 HEAD SHA와, 읽은 파일이 검토 SHA의 내용과 같은지 여부 (셸이 없어 Git을 쓸 수 없음)
- 실제로 생성된 미로·수족관 작품에서 변수가 전역에 노출되는지와 클로저 안에 갇히는 비율 (추측)
- 25×25 미로를 자동 플레이할 때 실제 걸린 시간 (계산 추정만 함)
- `inspect-quality-actions.mjs`의 1–224행 가운데 수족관 전용 검사가 이미 있는지 (필요한 부분만 읽음)

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
  "requested_review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "caller_head": "241cb6b19557553580dd02fb8f07c1126386993c",
  "head_before": "241cb6b19557553580dd02fb8f07c1126386993c",
  "head_after": "241cb6b19557553580dd02fb8f07c1126386993c",
  "reported_head": null,
  "reported_review_sha": "241cb6b19557553580dd02fb8f07c1126386993c",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-22T05:34:53.710Z",
  "elapsed_ms": 86374,
  "usage": {
    "input_tokens": 6,
    "output_tokens": 6995,
    "cache_read_input_tokens": 42850,
    "cache_creation_input_tokens": 39032
  },
  "cli_elapsed_ms": 79951,
  "exit_code": 0,
  "timed_out": false
}
```
