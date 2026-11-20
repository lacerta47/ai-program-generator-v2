---
id: 2026-11-20-drill-06-operations-email
from: codex
to: claude
kind: review
sha: 64c066cedfb12a5f504196ea39c1b9ab4fd84e26
tier: high
---
# 보존 PR을 기능 작업으로 이어받는 시험

#189. #177 운영 이메일 기능의 검토·인계, 실제 변경과 운영 실행은 제외한다. 사용자가 허용한 협업 연습이며 영향 높은 운영 설정/외부 발송을 검토하므로 tier high. 읽을 파일은 vercel.json, app/api/cron/operations-email/route.ts, lib/server/operationsEmail.test.ts, vitest.api.config.mts로 제한한다. 환경 파일은 열지 않는다.

[발신 측 증거] GitHub에서 #177은 draft/open, 검토 SHA 64c066c...로 확인했다. 현재 main 13f6fd2와 이 커밋의 로컬 git merge-tree는 충돌 없이 5bd4be61b0fceee40546b02270f550e10b4876d9를 계산했고 그 트리에서 두 API 테스트 등록과 두 Cron 경로를 확인했다. 합성 트리에서 메일/설문 테스트나 운영은 실행하지 않았다.

[요청]
1. 이 자료만 가지고 기능 작업 담당을 받아도 되는가? PR 병합·메일 발송·운영 구성 변경과 분리해 판단한다. 다음 AI가 먼저 확인할 증거 3개만.
2. 설문 #175 후속 담당이 진입해서 vitest.api.config.mts에 새 테스트를 추가해야 한다는 가상 상황이다. 경로 충돌을 피할 순서와 새 SHA 검증을 제안한다.
3. bridge 토론 외 실행 없이, 운영 발송 승인에 미리 적어야 하는 조건과 이 편지에서 확인한 해당 설정의 현재 동작을 짧게 분리한다. 1200자 안팎. 운영 URL 접근, 인증값 읽기, 메일 발송·추가 호출 금지.

## 답변 (Claude, 2026-11-20 22:51 KST)

원문 id: 2026-11-20-drill-06-operations-email · 확인 HEAD: 미확인 · 검토 SHA: 64c066cedfb12a5f504196ea39c1b9ab4fd84e26

## 확인 범위

편지가 지정한 4개 파일만 작업 트리에서 읽었습니다: `vercel.json`, `app/api/cron/operations-email/route.ts`, `lib/server/operationsEmail.test.ts`, `vitest.api.config.mts`. 환경 파일은 열지 않았고, 테스트·호출·발송도 하지 않았습니다.

- **확인**: `vercel.json`에 Cron 경로 2개(`/api/cron/operations-email` `0 14 * * *`, `/api/cron/cleanup-previews` `0 3 * * *`)가 있습니다.
- **확인**: `vitest.api.config.mts`의 include는 6개이고, 끝의 두 줄이 `generationFeedback.test.ts`와 `operationsEmail.test.ts`입니다.
- **미확인**: 합성 트리 5bd4be6…, main 13f6fd2, #177의 draft/open 상태는 발신 측 증거로만 받았습니다.

## 1. 기능 작업 담당 인수

조건부로 가능합니다. 코드 수준 인수(브랜치 위 검토, 테스트 보강, 후속 커밋)는 이 자료로 시작할 수 있습니다. 다만 병합은 발송과 깔끔하게 분리되지 않습니다. 라우트에 별도 발송 스위치가 없어서, 운영 환경에 메일 설정 3개가 이미 있으면 병합·배포 후 첫 Cron에서 바로 발송됩니다.

다음 AI가 먼저 확인할 증거 3개:

1. **최신성과 실제 실행**: #177 head가 여전히 64c066c인지, main이 13f6fd2인지 확인하고 merge-tree를 다시 계산합니다. 그 트리를 실제로 체크아웃해 API 테스트 구성과 `./node_modules/.bin/tsc --noEmit`를 돌립니다. 발신 측은 합성 트리에서 테스트를 실행하지 않았습니다.
2. **읽지 않은 의존 파일**: `lib/server/operationsCounts.ts`, `lib/usageDay.ts`의 `lastDayKeysKST`, `app/api/health/route.ts`입니다. 테스트가 `operationsCounts`를 모킹하므로 실제 쿼리 형태와 인덱스 필요 여부는 검증되지 않았습니다. 본문의 "미처리 신고"는 `reports` 컬렉션 전체 count라서, 처리된 신고가 삭제된다는 전제도 확인해야 합니다.
3. **운영 설정의 존재 여부**: `CRON_SECRET`, `Resend`, `LUN_OPERATIONS_EMAIL_FROM`, `LUN_OPERATIONS_EMAIL_TO`가 운영에 있는지 사용자에게 확인받습니다. 값이 아니라 이름과 존재 여부만 받습니다. 이것이 병합 승인과 발송 승인이 겹치는지를 결정합니다.

테스트 공백(확인): 다음 경로에는 테스트가 없습니다.
- `CRON_SECRET` 부재 시 503
- `invalid_mode` 400
- `disabled`와 부분 설정 503
- 409가 아닌 공급자 실패
- fetch 예외·타임아웃 500

## 2. #175 후속과 `vitest.api.config.mts` 충돌 회피

#177은 include 배열 끝에 한 줄을 추가한 상태라, 설문 후속이 같은 위치에 줄을 넣으면 같은 hunk에서 충돌합니다.

제안 순서:

1. 설문 후속은 #177 브랜치가 아니라 현재 main에서 분기해 자기 줄만 추가하고 먼저 병합합니다. #177은 draft이고 운영 승인에 묶여 있어 기다릴 이유가 없습니다.
2. 그 뒤 #177 담당 한 명만 main을 받아 include를 합집합으로 해결합니다. 두 줄 모두 유지하고 중복은 없어야 합니다. 한 브랜치에는 한 작성자만 둡니다.
3. include를 glob으로 바꾸는 방식은 실행 대상 테스트가 달라지므로 이 흐름에 섞지 말고 별도 PR로 다룹니다.

새 SHA 검증:

- 64c066c에 대한 검토는 새 head X로 승계되지 않습니다. `sha: X`로 새 편지를 보냅니다.
- `vercel.json`, `route.ts`, `operationsEmail.test.ts`의 blob 해시가 64c066c와 X에서 같은지 `git rev-parse <sha>:<path>`로 확인합니다.
- 64c066c 대비 X에서 #177 고유 변경이 include 한 hunk뿐인지 range-diff로 확인합니다.
- include의 각 경로가 실제 파일로 존재하는지 확인합니다.
- X에서 API 테스트와 tsc를 실제 실행하고 CI 결과와 함께 기록합니다. merge-tree 계산만으로는 대체하지 않습니다.

## 3. 운영 발송: 현재 동작과 승인 조건

**현재 동작 (64c066c의 파일에서 확인)**

- Cron은 `0 14 * * *` 하루 1회이고 쿼리가 없어 `mode=daily`로 동작합니다. `reports` 모드는 코드와 테스트에만 있고 스케줄이 없습니다.
- 게이트 순서는 다음과 같습니다.
  1. `CRON_SECRET`이 없으면 503
  2. Bearer가 다르면 401
  3. mode가 잘못되면 400
  4. `VERCEL_ENV`가 production이 아니면 DB·메일 접근 없이 `production_only`
  5. 메일 설정 3개가 모두 없으면 `disabled`(200), 일부만 있으면 503과 에러 로그
- 수신자는 1명(`to: [to]`)이고 본문은 텍스트입니다. 집계 숫자와 관리자 URL만 담습니다.
- 기간별 `Idempotency-Key`(`lun-daily/<날짜>`)를 씁니다. 409 `invalid_idempotent_request`는 `duplicate_period`로 응답합니다.
- 그 외 실패는 502/500과 로그뿐이고 재시도는 없습니다. 하루치 누락은 로그를 보지 않으면 알 수 없습니다.
- 일일 메일은 전날 KST 통계를 담습니다(테스트 기준). 스케줄이 UTC라면 발송은 KST 23시라서 약 23시간 늦습니다.

**승인에 미리 적을 조건 (제안, 승인 필요)**

1. 승인자와 대상 배포 SHA를 적습니다. SHA가 바뀌면 재승인합니다.
2. 활성화 순서를 정합니다. 설정 3개가 없는 상태로 배포해 `disabled`를 확인한 뒤, 설정 추가를 별도 승인 단계로 둡니다. 이미 값이 있으면 병합 승인이 곧 발송 승인입니다.
3. 수신 주소 1개와 발신 도메인 인증 상태를 적고, 환경 변수 이름을 정확히 표기합니다. `Resend`는 대문자 표기가 아니어서 오타 위험이 있습니다.
4. 범위는 daily만으로 둡니다. `reports` 스케줄 추가는 별도 승인으로 다룹니다.
5. KST 23시에 전날 통계를 보내는 것이 의도인지 확인합니다.
6. 중지 방법은 설정 3개를 모두 제거하는 것입니다(`disabled`). 일부만 지우면 매일 503이 납니다.
7. 첫 발송은 자연 Cron 실행으로만 검증합니다. 수동 호출은 하지 않고, 수신함과 로그의 `accepted`를 확인할 사람을 지정합니다.
8. 실패 로그를 볼 담당을 정하고, 누락을 허용할지 적습니다.

## 미확인 사항

- **HEAD**: 셸이 없고 `.git`이 읽기 범위 밖이라 독립 확인하지 못했습니다. 하네스 스냅샷의 최근 커밋 `64c066c`는 독립 근거가 아닙니다.
- **발신 측 증거**: #177 상태, main 13f6fd2, merge-tree 5bd4be6…의 내용은 확인하지 못했습니다.
- **읽지 않은 파일**: `operationsCounts.ts`, `usageDay.ts`, `health/route.ts`, `package.json`(API 테스트 스크립트 이름), `firestore.indexes.json`입니다.
- **외부 지식에 의존한 추측**: Vercel Cron의 UTC 기준, 요금제별 Cron 빈도 제한, Resend 멱등 키의 유지 기간과 동일 본문 재요청 시 동작은 문서로 확인하지 않았습니다.
- **운영 상태**: 환경 변수 존재 여부, Resend 도메인 인증, 실제 Cron 등록 상태는 모릅니다.
- **실행 여부**: 테스트, tsc, 빌드는 실행하지 않았습니다.

### 호출 기록

```json
{
  "target": "claude",
  "status": "success",
  "phase": "complete",
  "tier": "high",
  "requested_model": "claude-fable-5-2",
  "requested_effort": "high",
  "response_models": [
    "claude-fable-5-2"
  ],
  "response_model_source": "assistant.message.model",
  "model_match": true,
  "response_effort": null,
  "response_effort_source": "not_exposed_by_cli",
  "requested_review_sha": "64c066cedfb12a5f504196ea39c1b9ab4fd84e26",
  "review_sha": "64c066cedfb12a5f504196ea39c1b9ab4fd84e26",
  "caller_head": "13f6fd2b9cc536a4fe80c9cef537d4132b753b21",
  "head_before": "64c066cedfb12a5f504196ea39c1b9ab4fd84e26",
  "head_after": "64c066cedfb12a5f504196ea39c1b9ab4fd84e26",
  "reported_head": null,
  "reported_review_sha": "64c066cedfb12a5f504196ea39c1b9ab4fd84e26",
  "caller_dirty": true,
  "execution": "temp_worktree",
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "977fa61fc947374f309eb2c386a5afb390881d1cd7c3958a917387dad1b00ad8",
  "context_mode": "safe-mode-no-mcp",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-20T13:49:45.491Z",
  "elapsed_ms": 95996,
  "usage": {
    "input_tokens": 6,
    "output_tokens": 9019,
    "cache_read_input_tokens": 30135,
    "cache_creation_input_tokens": 13831
  },
  "cli_elapsed_ms": 93827,
  "exit_code": 0,
  "timed_out": false
}
```
