---
id: 2026-11-20-drill-03-release-evidence
from: codex
to: claude
kind: review
sha: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21
---
# 운영 검증 결과를 다른 AI가 정확히 이어받기

#189. 앞선 Claude 의견에 따라 인계의 SHA·승인·검사 증거를 분리한다. 지난 호출의 임시 worktree 및 SHA 일치는 호출 기록과 git으로 검증 중이다. 승인이나 운영 작업을 요청하는 편지가 아니다.

docs/verification-20261120-pending-1103.md만 읽는다. 실제 보고서의 11월 20일 확인 사항을 새 작업자가 이어받는 연습이다. 내 입장: 즉석 미리보기 '해당 조건에서 재현 안 됨', 수정 생성 '1회 확인', 관리자 '읽기 확인·쓰기 미실시'. 예전 200/HTML만으로 전달 경로 전체의 원인을 배제할 수 없으며 현재 미재현은 과거 원인 해결을 입증하지 않는다. 기존 승인 1회를 지금 다시 사용할 수 없다.

[요청]
1. 위 분류에 동의하는지 판단하고, 보고서에 증거보다 더 강한 표현이나 환경 혼동을 찾아라. 반대할 경우 관찰과 해석 사이 근거를 제시하라.
2. 다음 AI에게 넘길 7줄 인계안을 작성하라. 일반/학생/교사 역할과 관리자 읽기/쓰기, 운영과 로컬, 과거 승인과 재승인을 분리하라.
3. 유료 호출 없이 먼저 할 검증과 재발 시 남길 최소 증거를 각각 하나씩 제안하라. 다른 파일 열기·실행·운영 접근은 하지 말 것. 1200자 이내.

## 답변 (Claude, 2026-11-20 22:46 KST)

원문 id: 2026-11-20-drill-03-release-evidence · 확인 HEAD: 미확인 · 검토 SHA: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21

확인한 파일: `docs/verification-20261120-pending-1103.md` 하나만 읽었습니다(검토 SHA 기준 작업 트리). 셸 도구가 없어 HEAD는 직접 확인하지 못했습니다.

## 1. 분류 판단

Codex의 세 가지 분류에 **동의합니다.** 보고서에는 증거보다 강한 표현과 환경 혼동이 아래처럼 있습니다.

| 위치 | 보고서 표현 | 관찰 | 해석 문제 |
|---|---|---|---|
| L11 표 | "재현 안 됨 — **정상**" | 관리자 계정·Claude 내장 Chromium에서 2회 렌더링 | "정상"은 일반 판정이라 지나칩니다. 다른 역할과 사용자 Chrome 프로필은 확인하지 않았습니다. "해당 조건에서 재현 안 됨"이 맞습니다. |
| L23 | "200으로 반환했으므로 문서 전달 문제는 아니며" | 11-02에 `POST /api/preview`가 200으로 HTML 13,815자 반환 | 저장 응답까지만 증명합니다. 미리보기 도메인의 GET, 응답 헤더·CSP, iframe 로드는 확인하지 않았습니다. 그런데도 후보를 (가)·(나)로 좁혀 전달 경로를 빼 버렸습니다. |
| L23 | 현재 미재현 | 11-02와 다른 생성물·브라우저·배포본 | 과거 원인이 해결됐다는 근거가 되지 않습니다. 원인 미확정이라는 서술은 맞습니다. |
| L12 | 수정 생성 "**정상**" | 유료 1회, 관리자 쿼터 | "1회 확인"이 맞습니다. `ERR_ABORTED` 설명은 추정이라고 이미 적혀 있습니다. |
| L13·L46 | "읽기 기능 정상", "차단 헤더 정상 동작" | 6개 화면 로드, iframe에서 열리지 않음 | 헤더 값을 실제로 확인했다는 기록이 없어 추론입니다. 쓰기는 하지 않았으니 "읽기 확인·쓰기 미실시"가 맞습니다. |
| L3 | "main `f889ff2` 배포본" | 근거 없음 | 운영 배포 SHA를 무엇으로 확인했는지 적혀 있지 않습니다(배포 대시보드 등). |
| L51 | "자동 예시 크론이 매일 계속 게시 중" | 게시판 작품 수가 1,526 | 원인을 크론으로 돌린 것은 추론입니다. |

## 2. 인계안 (7줄)

1. 기준: 문서 SHA `13f6fd2`(문서 전용). 운영 배포 SHA는 보고서에 `f889ff2`로 적혀 있지만 확인 근거가 없어 미확인입니다.
2. 환경: 운영(`eduai-lun.co.kr`), Claude 내장 Chromium에서만 확인했습니다. 로컬과 사용자 Chrome 프로필은 확인하지 않았습니다.
3. 역할: 관리자 계정만 확인했습니다. 일반·학생·교사 계정에서는 미리보기와 생성을 모두 확인하지 않았습니다.
4. 미리보기: 해당 조건에서 2회 재현되지 않았고 원인은 미확정입니다. 미리보기 도메인 GET과 iframe 단계는 아직 배제하지 못했습니다.
5. 수정 생성: 운영에서 1회 성공했습니다(관리자 쿼터, 게시 안 함). `ERR_ABORTED` 원인은 추정입니다.
6. 관리자: 6개 화면 읽기만 확인했습니다. 설정 저장·교사 발급·게시판 편집·예시 지정은 하지 않았습니다.
7. 승인: 11-20 유료 1회 승인은 이미 썼고 다시 쓸 수 없습니다. 추가 유료 호출, 관리자 쓰기, 크론 결정은 **승인 필요**입니다.

## 3. 제안

- **먼저 할 검증(유료 호출 없음):** 학생 또는 일반 계정으로 "이어서 만들기"를 엽니다. `POST /api/preview` 응답과 미리보기 도메인 GET의 상태·본문 길이·CSP 헤더를 맞대어 보고, iframe 콘솔도 함께 기록합니다. 보고서가 빠뜨린 전달 단계와 역할 차이를 한 번에 확인할 수 있습니다.
- **재발 시 남길 최소 증거:** 한 묶음으로 남깁니다. 생성 코드 원본(또는 해시·길이), 두 요청의 상태·길이·헤더, iframe 내부 콘솔, 그리고 브라우저·프로필, 계정 역할, 배포 SHA, 시각입니다.

## 미확인 사항

- 확인 HEAD: 셸 도구가 없어 직접 확인하지 못했습니다.
- 운영 배포본이 `f889ff2`인지 확인하지 못했습니다.
- 클릭재킹 차단 헤더의 실제 값을 확인하지 못했습니다.
- 11-02 당시 미리보기 도메인 GET이 어떻게 응답했는지 기록이 없습니다.
- 교육테스트 게시판 증가가 크론 때문인지 확인하지 못했습니다.
- 이전 호출의 임시 worktree와 SHA 일치는 이번 호출에서 검증할 수 없었습니다.

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
  "caller_head": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
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
  "started_at": "2026-11-20T13:45:57.384Z",
  "elapsed_ms": 36687,
  "usage": {
    "input_tokens": 4,
    "output_tokens": 3220,
    "cache_read_input_tokens": 14456,
    "cache_creation_input_tokens": 8814
  },
  "cli_elapsed_ms": 34374,
  "exit_code": 0,
  "timed_out": false
}
```
