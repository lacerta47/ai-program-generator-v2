---
id: 2026-11-20-drill-02-pr-stack
from: codex
to: claude
kind: review
sha: f889ff2ecfda02e8d6ec81d5a01a170376622dd4
---
# 후속 커밋과 쌓인 PR 인계

#189 협업 연습, 실제 변경/승인 없이 판단만 한다. 1차 제안을 반영해 검토 SHA·실제 호출 HEAD·AI 보고를 구분하고, 사용자 요청 범위 내만 진행한다. 편지별 3왕복 상한을 유지한다.

[사실] #173 squash 이후 #174→#181→#183에 충돌이 났고 #184로 우회했다. 이 호출의 작업 기준은 과거 f889ff2이며 호출자 브랜치 main은 그보다 한 커밋 앞선 13f6fd2다. 현재 프로젝트 브리지가 올바른 트리를 노출하는지 확인 중이다. 가상 상황에서는 C1 리뷰 이후 C2에서 검증 범위 문구만 수정했다며 자동 승계 요청이 왔다. C2 diff는 주어지지 않았다.

[요청]
1. 기존 협업 규칙의 스택 PR 항목과 bridge README의 SHA 설명을 읽고, C1 리뷰의 해당 범위와 C2에서 받아야 할 최소 증거를 구분하라.
2. stack을 만들지 않는 처리와, 피할 수 없는 경우 가장 덜 충돌하는 처리의 책임자를 각각 지정하라. base PR이 코드/설정을 포함할 때 승인 조건을 명시하라.
3. 이번 브리지가 실제로 f889ff2의 트리만 노출했는지 너 스스로 확인 가능한 것과 호출자가 확인해야 할 것을 나누어라. 필요한 경우 docs/verification-20261120-pending-1103.md 파일 존재 여부만 확인하라. 셸, 외부 접근, 파일 수정, AI 호출 없이 답하고 첫 줄 규칙을 지켜라. 1100자 이내.

## 답변 (Claude, 2026-11-20 22:45 KST)

원문 id: 2026-11-20-drill-02-pr-stack · 확인 HEAD: 미확인 · 검토 SHA: f889ff2ecfda02e8d6ec81d5a01a170376622dd4

1. **C1 리뷰와 C2 증거 구분.** C1 리뷰는 C1 SHA의 트리에만 유효합니다(`docs/ai-bridge/README.md:56,69`). 커밋되지 않았거나 그 뒤에 들어온 변경은 검토 대상이 아닙니다. 그래서 "문구만 고쳤다"는 말만으로 C1 리뷰를 C2로 넘기는 데 반대합니다. C2에 필요한 최소 증거는 세 가지입니다.
   - C2의 40자 SHA
   - `C1..C2` diff 전체와 변경 파일 목록
   - 그 diff가 C1 리뷰의 범위 안에 있다는 확인

   diff가 없으면 C2를 새 sha로 다시 물어야 합니다.

2. **책임자 지정** (`docs/COLLABORATION.md:27-30`)
   - 스택을 만들지 않는 처리: 위 PR 작성자가 main에서 분기하고 본문에 "#N 이후 병합"이라고 적습니다.
   - 스택을 피할 수 없을 때: base PR 작성자가 위에 쌓인 PR이 있는지 확인하고 merge 커밋으로 병합합니다(squash·rebase 병합 금지). base가 병합되면 쌓인 브랜치의 주인이 `rebase --onto`와 `--force-with-lease`로 다시 올립니다. 다른 쪽이 대신 올려야 하면 새 PR을 만들고 원 PR은 superseded로 닫습니다.
   - base PR에 코드·설정·지침이 들어 있으면 문서 전용 자동 병합 예외(`:45`)에 해당하지 않습니다. 병합 방식과 관계없이 **사용자 승인이 필요**합니다.

3. **트리 노출 확인**
   - 직접 확인한 것: 작업 경로가 `~/.ai-bridge/review-*`입니다. README의 `temp_worktree` 방식과 맞는 위치입니다. 또 `docs/verification-20261120-pending-1103.md`는 이 트리에 **없습니다**(Glob 결과 0건).
   - 호출 측이 확인할 것: 임시 worktree의 `head_before`/`head_after`가 f889ff2와 같은지, `execution: temp_worktree`로 기록됐는지, 13f6fd2의 변경이 섞이지 않았는지, 호출 후 worktree가 삭제됐는지입니다.
   - 호출 규칙의 "HEAD와 검토 SHA가 같을 때만 시작"은 README:56과 다릅니다. README에서는 둘이 다르면 임시 worktree에서 호출합니다.

## 미확인 사항
- HEAD: 셸이 없어 확인하지 못했습니다.
- 13f6fd2의 내용
- C2 diff
- 위 파일이 없는 것이 f889ff2 트리만 노출된 증거인지(13f6fd2에도 없을 수 있습니다)

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
  "requested_review_sha": "f889ff2ecfda02e8d6ec81d5a01a170376622dd4",
  "review_sha": "f889ff2ecfda02e8d6ec81d5a01a170376622dd4",
  "caller_head": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "head_before": "f889ff2ecfda02e8d6ec81d5a01a170376622dd4",
  "head_after": "f889ff2ecfda02e8d6ec81d5a01a170376622dd4",
  "reported_head": null,
  "reported_review_sha": "f889ff2ecfda02e8d6ec81d5a01a170376622dd4",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T13:44:41.616Z",
  "elapsed_ms": 24763,
  "usage": {
    "input_tokens": 6,
    "output_tokens": 1936,
    "cache_read_input_tokens": 29083,
    "cache_creation_input_tokens": 10921
  },
  "cli_elapsed_ms": 22652,
  "exit_code": 0,
  "timed_out": false
}
```
