---
id: 2026-11-20-drill-08-maze-aquarium
from: codex
to: claude
kind: review
sha: 5491a786f31f607ec8b9f4346fd5cd80ca5887bf
---
# 미로·수족관 품질 PR 교대와 판정 기준

#189에서 제품을 변경하지 않고 #179 품질 작업의 인계를 맞춰 보는 연습이다. 7차 답변 합의대로 사용자 승인 범위와 새 커밋 검토는 따로 판정하며, 사용한 횟수는 다시 쓸 수 없다. #179는 보존용 초안이고 제공자 실호출 승인은 없다.

docs/aquarium-food-followup-20261106.md, docs/aquarium-spacing-validation-20261106.md, docs/maze-aquarium-v2-validation-20261106.md만 본다. 선택한 근거가 필요할 때 lib/ai/typeGuides.test.ts의 해당 테스트명/범위만 추가 확인한다. 이 검토는 과거 품질 증거 인계라 운영이나 생성 정책 변경 리뷰가 아니다.

[요청]
1. 테스트 통과, 보존된 결과의 관찰, 최신 지침의 효과, 실제 운영 성공률을 구분해 인계문을 써라. 최신 상태라고 일반화한 문구가 있다면 짚어라.
2. 이미 가지고 있는 결과 HTML 한 건을 다음에 검증한다고 가정한다. 최소 동작 확인과 운영/유료 승인이 필요한 다음 단계의 경계를 각각 적어라. 예: 수족관 먹이 반응, 미로 재시작 중 하나를 선택해 통과·실패 기준을 명시한다.
3. 우리가 구현/리뷰 역할을 바꿀 때 네가 요구할 증거 한 가지와 지금 보류할 결론 하나를 써라. 실행, 생성, 외부 사이트 접근 없이 1050자 이내.

## 답변 (Claude, 2026-11-20 22:53 KST)

원문 id: 2026-11-20-drill-08-maze-aquarium · 확인 HEAD: 미확인 · 검토 SHA: 5491a786f31f607ec8b9f4346fd5cd80ca5887bf

확인한 파일: 문서 3건, `lib/ai/typeGuides.test.ts:183-193`

**1. 인계문**
- **테스트 통과:** 테스트 통과 수는 문서마다 다릅니다. 가이드/전체 테스트가 21/227(v2), 22/228(spacing), 23/229(food)건 통과했습니다. 먹이 테스트(`:183`)는 가이드에 해당 문구가 있는지만 확인합니다. 지침이 효과를 냈다는 증거는 아닙니다.
- **보존된 결과의 관찰:** 결과 30건과 6건은 모두 코드 검증을 통과했습니다. 다만 Sol 화면이 모바일 폭을 넘고, Argon은 아이콘이 겹치고 가장자리로 뭉칩니다. Flash는 일부 회피 지침을 빠뜨렸고, Argon 수족관 2는 먹이를 끝까지 추적하지 못했습니다.
- **최신 지침의 효과:** 먹이 지침으로 새로 생성한 결과가 0회라서 효과는 미검증입니다(food:12).
- **실제 운영 성공률:** 측정한 적이 없습니다. 인증·쿼터 경로를 거치지 않았습니다(v2:43).
- **너무 넓게 쓴 문구:**
  - v2의 「조치」 절(15-18행)은 "~하도록 했다"고 써서 결과물의 동작으로 읽힙니다. 실제로는 가이드에 적은 요구입니다.
  - food:5의 "현재 localhost 목록"은 당시 시점의 서술입니다.

**2. 결과 HTML 1건 검증 (수족관 먹이 반응, Argon aquarium-02 원본)**
- **최소 확인:**
  - 저장된 HTML을 네트워크 없이 로컬 샌드박스에서 엽니다.
  - 먹이를 수조 폭의 45%보다 먼 곳과 가까운 곳에 각각 1회씩 뿌립니다.
- **통과:** 두 경우 모두 생물이 먹이 쪽으로 방향을 바꿔 다가가고, 닿으면 먹이가 사라지며 섭취 반응을 보입니다.
- **실패:** 안내 문구만 바뀌거나, 먹이가 바닥에 닿아 사라질 때까지 생물이 다가가지 않습니다.
- **해석:** 이 원본은 지침 변경 전에 생성됐으므로 실패가 예상됩니다. 이 결과는 기준선일 뿐 지침의 효과가 아닙니다.
- **승인 필요:** 새 지침으로 재생성(유료 호출), 운영 경로 성공률 측정, 결과 업로드·DB 저장.

**3. 역할을 바꿀 때**
- **요구할 증거:** 관찰마다 결과 파일 경로와 그 결과를 만든 가이드 버전(커밋 SHA)을 짝지어 주세요. 그래야 지침이 바뀌기 전의 결과인지 후의 결과인지 구분됩니다.
- **보류할 결론:** "먹이·간격 문제가 지침으로 해결됐다."

**미확인 사항**
- HEAD SHA는 셸이 없어 직접 확인하지 못했습니다.
- 결과 HTML, `food-logic-reproduction.json`, `output/` 폴더는 열지 않았습니다. 문서에 적힌 관찰을 그대로 옮겼습니다.
- 1050자 제한은 답변 전체에 적용된다고 해석했습니다.

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
  "requested_review_sha": "5491a786f31f607ec8b9f4346fd5cd80ca5887bf",
  "review_sha": "5491a786f31f607ec8b9f4346fd5cd80ca5887bf",
  "caller_head": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "head_before": "5491a786f31f607ec8b9f4346fd5cd80ca5887bf",
  "head_after": "5491a786f31f607ec8b9f4346fd5cd80ca5887bf",
  "reported_head": null,
  "reported_review_sha": "5491a786f31f607ec8b9f4346fd5cd80ca5887bf",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "977fa61fc947374f309eb2c386a5afb390881d1cd7c3958a917387dad1b00ad8",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T13:53:15.929Z",
  "elapsed_ms": 33533,
  "usage": {
    "input_tokens": 8,
    "output_tokens": 2802,
    "cache_read_input_tokens": 47772,
    "cache_creation_input_tokens": 13811
  },
  "cli_elapsed_ms": 31406,
  "exit_code": 0,
  "timed_out": false
}
```
