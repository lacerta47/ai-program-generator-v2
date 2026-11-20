---
id: 2026-11-20-drill-22-release-interruption
from: codex
to: claude
kind: proposal
sha: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21
---
# 출시 점검 중 담당 교대와 환경 확인

#189. 이 상황은 실행하지 않는 협업 사고실험이다. 두 변경을 테스트한다고 가정한다. A는 최신 main 기반의 Next.js staging 화면을 보던 Claude다. A가 잠시 중단하면서 "CI pass, preview OK, build 한 번 다시 돌려줘"만 남겼다. B는 새 Codex 세션이며 보고에 CI ref, 운영 여부, 브라우저 역할, 선생님/학생 교실 테스트 범위, dev 프로세스 작업 폴더, 최근 SHA가 없다. 사용자는 staging 읽기 점검만 허용했다고 Issue에 적혀 있다. 종료가 필요한 프로세스는 A의 것인지 아직 모른다.

[요청]
1. AGENTS의 build/.next 규칙과 README의 배포 전 점검 표를 읽고 지금 실행할 수 있는 확인과 부족한 근거 세 가지를 나눈다. 개발 서버 소유자 확인, broad process kill 방지, CI와 승인 구분 포함.
2. 새 담당 B가 A에 질문할 2가지와 동시에 진행 가능한 검증 1가지를 적는다.
3. '미리보기 정상'을 배포 완료로 바꾸려면 서버 응답 외에 무엇이 필요할지 환경·권한 포함 2줄. 850자 내, 실행/운영 접근 없음.

## 답변 (Claude, 2026-11-20 23:19 KST)

원문 id: 2026-11-20-drill-22-release-interruption · 확인 HEAD: 미확인 · 검토 SHA: 13f6fd2b9cc536a4fe80c9cef537d4132b753b21

확인한 파일: `AGENTS.md`의 Commands 절, `README.md:43-56`(배포 전 점검). 작업 트리의 `.git`을 읽지 못해 HEAD는 확인하지 못했습니다.

**1. 지금 할 수 있는 확인과 부족한 근거**
- 지금 할 수 있는 확인: 읽기 전용 staging 점검, 그리고 프로세스의 작업 폴더·PID 조회(조회만 하고 종료하지 않음). 빌드는 소유자가 확인된 dev 서버가 멈춘 뒤에만 돌립니다. 소유자를 모르면 빌드를 보류합니다. 넓은 범위의 `node` 종료는 하지 않습니다.
- 부족한 근거:
  1. A가 말한 CI pass가 어떤 커밋(ref/SHA)인지, 그 커밋에서 `test:api`와 `test:rules`가 통과했는지
  2. staging 환경 여부와 브라우저 역할, 교사·학생 반별 점검 범위
  3. 사용자 승인 범위. 승인은 staging 읽기 점검까지입니다. CI 통과는 배포나 프로세스 종료를 승인한 것이 아닙니다.

**2. B가 A에게 물을 것**
- 질문 1: CI가 통과한 SHA와 staging이 배포된 SHA가 같은가요?
- 질문 2: 실행 중인 dev 서버는 A가 띄운 것인가요? 작업 폴더와 PID는 무엇인가요?
- 동시에 할 검증: 승인 범위 안에서 `POST /api/preview`의 iframe `sandbox` 속성과 응답 CSP를 읽기만으로 확인합니다.

**3. '미리보기 정상'을 배포 완료로 바꾸려면**
- 같은 커밋에서 CI가 통과했다는 링크, 그리고 README의 네 점검 항목 결과(통과·실패·미확인)를 환경과 함께 배포 기록에 남겨야 합니다.
- 배포는 별도로 사용자 승인이 필요합니다(승인 필요). 미확인 항목이 하나라도 있으면 배포를 보류합니다.

## 미확인 사항
- 작업 트리 HEAD: 셸이 없고 `.git`도 읽지 못해 확인하지 못했습니다.
- A가 남긴 CI 결과와 staging SHA, dev 서버 소유자: 사고실험이라 실제 근거가 없습니다.

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
  "caller_head": "6125e712d0f2a528c16759b9d289bc38cb2cbcfb",
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
  "started_at": "2026-11-20T14:19:35.137Z",
  "elapsed_ms": 20173,
  "usage": {
    "input_tokens": 6,
    "output_tokens": 1343,
    "cache_read_input_tokens": 26519,
    "cache_creation_input_tokens": 8008
  },
  "cli_elapsed_ms": 17737,
  "exit_code": 0,
  "timed_out": false
}
```
