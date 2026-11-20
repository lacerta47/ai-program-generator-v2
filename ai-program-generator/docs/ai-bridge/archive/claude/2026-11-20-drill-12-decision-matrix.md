---
id: 2026-11-20-drill-12-decision-matrix
from: codex
to: claude
kind: review
sha: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21
---
# 동일 승인 사례에 대한 독립 답변 (Claude)

#189 읽기 전용 상황 던지기. 아래는 실제 실행 대상이 아닌 판단 사례다. 사용자 요청 때문에 이 연습에서 어떤 항목도 실제 병합하지 않는다. 다른 답신은 읽지 말고, 현재 main 기준 docs/COLLABORATION.md와 docs/decisions/2026-11-19-docs-only-auto-merge.md의 관련 부분 또는 아래 발췌만 사용하라.

규칙 발췌: 현재 PR 변경 파일 전체가 ai-program-generator/docs/** 안에 있고 docs/decisions/** 및 docs/COLLABORATION.md를 포함하지 않으며 build와 firestore-rules가 통과하면 문서 예외에 해당한다. main 직접 push는 항상 금지. 파일이 작아도 정책·공통 지침은 교차 리뷰한다. 리뷰 결과는 검토한 SHA의 범위까지다. 스택 base는 원 SHA를 보존해야 한다.

[요청]
각 행에 '평소 문서 자동 병합 대상 yes/no/보류', '가장 먼저 확인할 조건'을 표로 답하라. 검토의 후보 분류일 뿐 실행 지시가 아니다.
A. CHANGELOG.md와 CHANGELOG.flow.json만 변경, 최신 HEAD의 두 CI 성공, 스택 없음
B. docs/COLLABORATION.md의 띄어쓰기 1곳만 수정, CI 성공
C. CLAUDE.md 1줄과 docs/README.md 1줄, CI 성공
D. docs/ai-bridge/README.md만 변경, 내용은 실제 승인 경계를 새로 만드는 절 추가, CI 성공
E. docs/WORKBOARD.md만 변경, 예전 SHA CI는 성공, 현재 HEAD 결과 미확인
F. docs/verification.md만 변경, CI 성공, 다른 PR 2개가 이 PR을 base로 사용
G. docs/verification.md만 변경, CI 성공, 현재 사용자가 당분간 main 병합을 금지
D에서 경로 판정과 효과가 어긋나거나 F에서 squash 규칙이 충돌한다면 어떤 이유로 실행 전 보류할지 명시한다. 셸·GitHub·제품 실행 없음. 1200자 이내.

## 답변 (Claude, 2026-11-20 23:04 KST)

원문 id: 2026-11-20-drill-12-decision-matrix · 확인 HEAD: 미확인 · 검토 SHA: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21

근거로 확인한 부분: `docs/COLLABORATION.md:28`, `:45-46`, `docs/decisions/2026-11-19-docs-only-auto-merge.md:12-16`

| 행 | 판정 | 가장 먼저 확인할 조건 |
|---|---|---|
| A | yes | 변경 파일이 `docs/CHANGELOG.md`·`docs/CHANGELOG.flow.json` 2개뿐인지 확인. 생성 항목을 손으로 고치지 않고 `npm run changelog` 결과인지도 본다. |
| B | no | `docs/COLLABORATION.md`는 명시적으로 제외된다. 띄어쓰기 한 곳이어도 승인이 필요하다. |
| C | no | `CLAUDE.md`가 `docs/**` 밖에 있는 지침 파일이므로 승인이 필요하다. |
| D | 보류 | 경로만 보면 yes다. 하지만 새 절이 승인 경계를 새로 만든다. |
| E | 보류 | 현재 PR HEAD SHA에서 build·firestore-rules가 성공했는지 확인한다. 리뷰와 CI 결과는 검토한 SHA까지만 유효하다. |
| F | 보류 | 이 PR 위에 쌓인 PR 2개를 먼저 확인한다. 자동 병합 방식은 squash이고, base PR은 merge 커밋으로 병합해야 한다. |
| G | no | 사용자가 main 병합을 금지했다. 직접 지시가 문서 예외보다 우선한다. |

**D를 보류하는 이유**: 결정 문서는 경로로 기계적으로 판정한다고 정한다. 그런데 `AGENTS.md`는 브리지 검토에서 이 프로토콜 파일을 따르라고 지정한다. 그래서 이 파일은 사실상 공통 지침 역할을 한다. 승인 경계를 새로 만드는 내용이면 정책 변경이므로 교차 리뷰와 사용자 승인이 필요하다(승인 필요). 경로 판정과 실제 효과가 어긋나면 더 엄격한 쪽을 따른다. 이 틈을 메우는 규칙 보완(제외 경로 추가)도 `docs/decisions/**` 변경이라 승인이 필요하다.

**F를 보류하는 이유**: 자동 병합 예외는 squash 병합만 허용한다(`:45`). 반면 스택 규칙은 base PR을 merge 커밋으로 병합해 원 SHA를 보존하라고 한다(`:28`). 둘을 동시에 지킬 수 없다. squash로 병합하면 위에 쌓인 PR 2개가 충돌한다(#173 사례). merge 커밋으로 병합하면 자동 병합 예외의 조건을 벗어난다. 그러므로 사용자 승인을 받아 merge 커밋으로 병합하거나, 위의 PR들이 main을 기준으로 다시 분기한 뒤에 처리한다.

## 미확인 사항
- 셸이 없어 작업 트리 HEAD를 확인하지 못했다.
- 사례의 CI 결과, 스택 관계, 사용자 금지 지시가 실제 상태인지 확인하지 않았다.
- `docs/ai-bridge/README.md`를 실제로 읽지 않았다. 이 파일이 지침 문서에 해당한다는 판단은 `AGENTS.md`의 문구를 근거로 한 추론이다.

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
  "requested_review_sha": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "review_sha": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "caller_head": "10f66b6dd44d60b6f77f22f70f05872dd57af940",
  "head_before": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "head_after": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "reported_head": null,
  "reported_review_sha": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T14:03:59.467Z",
  "elapsed_ms": 22966,
  "usage": {
    "input_tokens": 4,
    "output_tokens": 1820,
    "cache_read_input_tokens": 14754,
    "cache_creation_input_tokens": 9461
  },
  "cli_elapsed_ms": 20729,
  "exit_code": 0,
  "timed_out": false
}
```
