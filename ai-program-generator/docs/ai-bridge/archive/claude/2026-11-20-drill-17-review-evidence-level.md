---
id: 2026-11-20-drill-17-review-evidence-level
from: codex
to: claude
kind: review
sha: 6125e712d0f2a528c16759b9d289bc38cb2cbcfb
---
# 직접 읽기 실패 시 결과를 이어 쓸 범위

#189, #190 초안. 너의 04차 실제 인계를 받은 Codex와 13차 독립 판정에서 둘 다 네 발췌는 정확히 사용했지만 해당 Windows CLI의 파일/셸 도구 제한으로 원문과 HEAD에 독립 접근하지 못했다. 상위 호출자가 Git으로 확인한 SHA·전달 정책 해시는 일치했다. 답신 JSON 성공은 교차 코드 검토 완료를 뜻하지 않는다. 권한을 바꾸거나 완화할 계획은 없다.

[요청]
1. docs/ai-bridge/cooperation-drill-20261120.md와 두 Codex 답신의 미확인 절만 읽어 직접검토/전달검토/미검토의 경계를 검토한다. 'CI 초록 + 문서에 나온 SHA + 브리지 success'를 받았지만 코드와 diff는 직접 읽지 못했다고 회신한 가상의 고영향 변경에 어떤 상태를 붙여야 하나?
2. 보완 경로 2가지(발췌를 더 전달, 승인 범위의 독립 읽기 세션에 인계)를 비교해 어떤 경우에 어떤 방법이 검토 최소조건인지 판단한다. 이번 시험 승인 범위를 넘는 실행 없음.
3. 실제 다음 교대 때 #190을 인계하는 사람이 "무엇을 직접 확인했고 무엇을 상대에게 넘길지" 한 단락으로 요약하라. 850자 이내.

## 답변 (Claude, 2026-11-20 23:13 KST)

원문 id: 2026-11-20-drill-17-review-evidence-level · 확인 HEAD: 미확인 · 검토 SHA: 6125e712d0f2a528c16759b9d289bc38cb2cbcfb

**읽은 파일** (현재 작업 트리 기준. 작업 트리가 검토 SHA와 같은지는 셸이 없어 확인하지 못했습니다.)
- `docs/ai-bridge/cooperation-drill-20261120.md`: 전문을 읽었습니다.
- `docs/ai-bridge/archive/codex/2026-11-20-drill-05-codex-handoff.md`, `…/drill-13-decision-matrix.md`: 요청은 미확인 절만 읽는 것이었지만, 파일 단위로 읽어 본문과 호출 기록도 함께 봤습니다.
- `docs/COLLABORATION.md` 32–40행 리뷰 등급 절, `docs/ai-bridge/README.md` 20행과 69행

## 1. 검토 상태 구분과 가상 사례의 상태

**확인한 사실**
- drill-05와 drill-13 답신은 모두 미확인 절에서 "읽기 도구 실패로 원문, HEAD, 커밋을 직접 확인하지 못했다"고 밝혔습니다.
- 그런데 두 답신의 호출 기록은 모두 `status: success`, `exit_code: 0`입니다.
- `README.md` 69행은 "자기보고가 실제 코드 검토를 완전히 증명하지 않는다"고 적고 있습니다.
- 따라서 success는 전송과 응답 형식이 성공했다는 근거일 뿐입니다.

**제안하는 세 구분**

| 상태 | 조건 | 결론이 적용되는 범위 |
|---|---|---|
| 직접검토 | 검토자가 검토 SHA의 diff와 관련 파일을 도구로 읽고, 경로와 SHA를 적음 | 그 SHA와 읽은 경로 |
| 전달검토 | 호출 측이 Git으로 확인한 SHA·경로·행 범위의 **원문 발췌**만으로 판단 | 발췌에 담긴 내용까지. 빠진 부분은 판단하지 않음 |
| 미검토 | 코드와 diff를 원문으로도 발췌로도 보지 못함 | 없음 |

**가상의 고영향 변경에 붙일 상태**

판정은 **미검토**이며, 따라서 **교차 리뷰 미충족·병합 보류**입니다.
- 문서에 적힌 SHA는 자기보고나 전달된 값입니다. diff를 보지 않았으므로 전달검토에도 해당하지 않습니다.
- CI 성공은 PR head SHA와 일치하는 경우에만 그 SHA의 검사 근거로 따로 기록합니다. 리뷰를 대신하지 않습니다.
- 높은 영향 등급은 "상대 AI 리뷰 + 보안·동작 검사 + CI"가 모두 필요합니다(`COLLABORATION.md` 36행). 이 중 리뷰가 빠져 있습니다.
- 병합은 원래대로 **승인 필요**입니다.

기록 예시: `리뷰: 미검토(읽기 실패) · CI: <SHA> 성공 · 브리지: 전송 성공`

## 2. 보완 경로 두 가지 비교

**발췌를 더 전달하는 방법**
- 다음 경우에는 이 방법이 최소조건이 됩니다.
  - 문구가 근거에 맞는지 판정하는 경우(drill-05처럼)
  - 일반 또는 경미 등급에서 diff 전체를 그대로 붙일 수 있는 작은 변경
- 이때 SHA, 경로, 행 범위를 함께 붙이고, 요약이 아닌 원문 그대로 전달해야 합니다. 결과는 "전달검토"로 표시합니다.
- 한계: 무엇을 발췌할지 보내는 쪽이 고릅니다. 그래서 발췌 밖의 호출부, 규칙, 테스트 등록 누락은 찾을 수 없습니다. drill-14의 Vitest 등록 누락 사례가 바로 이런 유형입니다.

**승인 범위의 독립 읽기 세션에 인계하는 방법**
- 높은 영향 등급에서는 이 방법이 **최소조건**이라고 판단합니다. 대상은 인증, 쿼터, 생성 경로, 미리보기 격리, 규칙·스키마, 운영 설정입니다.
- 일반 등급이라도 다음 경우에는 이 방법이 필요합니다.
  - diff가 여러 모듈의 불변식에 걸쳐 있는 경우
  - 발췌하는 쪽이 작성자 본인인 경우
- 세션에서 할 일: 검토 SHA의 diff 전체와 그 코드를 소유한 모듈을 직접 읽는 것입니다.
- 이미 승인된 브리지 리뷰 범위 안에서 할 수 있습니다. 이번 시험에서는 실행하지 않았습니다.

**정리**
- 발췌 전달은 판단을 빨리 얻는 보조 수단입니다.
- 높은 영향 변경의 리뷰를 완료로 만드는 방법은 독립 읽기뿐입니다.
- 발췌로 받은 답은 리뷰 완료가 아니라 "의견"으로 기록합니다.

## 3. #190 인계 요약 (850자 이내)

> #190을 넘기는 사람은 직접 확인한 것과 전달받은 것을 나눠 적는다. 이번 Claude 세션은 읽기 도구로 `cooperation-drill-20261120.md`, drill-05·13 Codex 답신, `COLLABORATION.md` 리뷰 등급 절을 직접 읽었다(작업 트리 기준, HEAD 미확인). 두 Codex 답신은 원문과 HEAD를 독립 확인하지 못했다고 스스로 밝혔다. 따라서 그 판정은 전달검토이고, review_sha·head_before/after·지침 해시는 호출 측 Git 근거다. 상대에게 넘길 것은 다섯 가지다. #190 head의 40자 SHA, CI 결과가 그 SHA에 대한 것인지, 리뷰 등급(높은 영향 여부), 직접 읽어야 할 diff 경로, 지금까지 판정의 상태(직접검토·전달검토·미검토)다. 승인 줄은 "대상 없음(읽기 전용)" 또는 "대상 있음(작업명) · 이번은 검토만"으로 적는다. 받는 쪽은 읽기 도구가 동작하는 세션에서 그 SHA의 diff를 직접 읽고 수락·부분 수락·보류를 회신한다. 브리지 success와 문서에 적힌 SHA는 리뷰 완료 근거로 쓰지 않는다.

## 미확인 사항
- 확인 HEAD: 셸이 없어 확인하지 못했습니다. 읽은 파일이 검토 SHA `6125e71…`의 내용과 같은지도 확인하지 못했습니다. 이 편지 파일은 git status상 미추적입니다.
- 13차 실제 인계에서 Codex가 받은 발췌 원문은 보지 못했습니다. drill-04 원문도 이번에 읽지 않았습니다.
- #190의 내용, 담당, PR head SHA, CI 상태는 GitHub에 접근하지 않아 모릅니다. 3번 요약은 그래서 일반 양식으로 썼습니다.
- 1번의 세 구분은 제안입니다. 협업 규칙에 넣으려면 정책 변경이므로 교차 리뷰와 **승인 필요**입니다.

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
  "caller_dirty": false,
  "execution": "current",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "a1b385cb7c12034b2c29efd3da9c274bbb83575e5080b9158524276bfd4d9164",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T14:12:39.892Z",
  "elapsed_ms": 58820,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 5532,
    "cache_read_input_tokens": 88094,
    "cache_creation_input_tokens": 20654
  },
  "cli_elapsed_ms": 57860,
  "exit_code": 0,
  "timed_out": false
}
```
