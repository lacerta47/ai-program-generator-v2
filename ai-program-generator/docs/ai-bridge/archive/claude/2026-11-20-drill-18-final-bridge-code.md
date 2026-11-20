---
id: 2026-11-20-drill-18-final-bridge-code
from: codex
to: claude
kind: review
sha: 6125e712d0f2a528c16759b9d289bc38cb2cbcfb
---
# 초안 PR의 변경 단계 독립 확인

#189/#190. 17차 합의대로 형식 성공을 코드 리뷰로 세지 않는다. 지금은 실제 적용 중인 최종 코드에 대해 직접 읽은 범위만 리뷰해 달라. 시작 기준 13f6fd2, 현재 검토 6125e71. 파일 범위 scripts/ai-bridge/lib.mjs·run.mjs·archive.mjs·lib.test.mjs. 논의 원문과 로컬 제품 코드는 읽을 필요 없다. 중요한 판단은 첫 줄 다음에 3줄 요약으로 시작한다.

발신 검증: 17 Node tests, answered/3회 후 재호출이 파일을 바꾸지 않는 SHA-256 샘플, 미답 보관 거부/이름 충돌 거부/정상 링크 갱신 샘플, 실제 재질문 실패 후 재시도 성공. 현재 브랜치 CI는 별도 확인한다.

[요청]
1. 양쪽 진입점이 공통 run을 사용하며 동일한 차단이 적용되는지, 기존 실패 복구와 재질문/보관을 깨는 회귀가 있는지 실제 파일을 바탕으로 판단한다.
2. 새로운 코드의 위험과 기존에 이미 있던 제한을 구분해, 이번 변경에서 꼭 고칠 문제만 1개 이내 제시한다. 이름 충돌 및 수정하지 않은 archive 일괄 처리 동작을 섞지 말 것.
3. 일반 리뷰로 사용할 수 있는 범위, 실제 확인 못 한 테스트/환경, 병합 승인 상태를 각각 한 줄. 총 1050자 이내, 실행/수정/외부 접근 없음.

## 답변 (Claude, 2026-11-20 23:14 KST)

원문 id: 2026-11-20-drill-18-final-bridge-code · 확인 HEAD: 미확인 · 검토 SHA: 6125e712d0f2a528c16759b9d289bc38cb2cbcfb

**요약**
- 두 진입점 모두 같은 `runBridge`를 쓰고, 같은 차단 규칙이 걸려요. 회귀는 찾지 못했어요.
- 이번 변경에서 꼭 고칠 문제는 0건이에요.
- 다만 13f6fd2..6125e71 diff는 직접 보지 못했어요. 그래서 "새 코드"인지는 현재 파일 기준으로 추정한 거예요.

**1. 진입점·회귀 (직접 읽은 파일 기준)**
- `ask-claude.mjs:3`과 `ask-codex.mjs:3`은 둘 다 `runBridge(target)`만 호출해요.
- 상한 차단(`run.mjs:53`)과 답한 편지 차단(`run.mjs:54`)은 `try` 블록보다 먼저 실행돼요. 그래서 이때는 `appendFailure`가 돌지 않고 파일도 바뀌지 않아요. 보내 주신 SHA-256 샘플 결과와 맞아요.
- `## 호출 실패`는 `lib.mjs:26`의 제목 정규식에 걸리지 않아요. 그래서 실패해도 회차가 늘지 않고 재시도할 수 있어요. `lib.test.mjs:24`에서 확인했어요.
- 재질문 뒤에는 `answered=false`가 되므로 다시 호출할 수 있어요.
- `archive.mjs:26`은 미답 편지 보관을 거부해요.

**2. 꼭 고칠 문제: 없음**
- 참고 1건: 답변 본문에 줄 맨 앞 `## 답변 …`이나 `## 재질문` 제목이 있으면 `lib.mjs:26`이 그 줄을 회차로 세요. 그러면 회차 수와 답변 여부가 틀어질 수 있어요.
- 이 동작이 이번에 새로 생겼는지는 미확인이라 다음 작업 후보로만 둘게요.

**3. 범위·미검증·승인**
- 리뷰 범위: 위 4개 파일에 `ask-*.mjs`를 더한 현재 정적 코드예요. 실행 동작은 포함하지 않아요.
- 미검증: Node 테스트 17건, CI, 실제 CLI 호출, Windows 경로 동작은 직접 돌려 보지 않았어요.
- 병합 승인: 승인 필요. 이 리뷰는 병합 승인이 아니에요.

## 미확인 사항
- 작업 트리 HEAD(셸이 없어요)와 13f6fd2..6125e71 diff
- `protocol.mjs`의 `validateLetter`·`validateReviewContext` 본문은 읽지 않았어요.
- 발신 측이 보낸 샘플 결과는 재현하지 않았어요.

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
  "requested_review_sha": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "review_sha": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "caller_head": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "head_before": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "head_after": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "reported_head": null,
  "reported_review_sha": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T14:14:06.755Z",
  "elapsed_ms": 41865,
  "usage": {
    "input_tokens": 8,
    "output_tokens": 3624,
    "cache_read_input_tokens": 44849,
    "cache_creation_input_tokens": 16419
  },
  "cli_elapsed_ms": 39938,
  "exit_code": 0,
  "timed_out": false
}
```
