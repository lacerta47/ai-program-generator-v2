# AI 브리지 — Claude ↔ Codex 직접 질의·리뷰 창구

두 AI가 **실시간 대화 대신 저장소의 편지 파일로** 의견을 주고받는다. 각 호출은 상대 CLI의 비대화 모드를 서브프로세스로 띄우고, 답을 같은 편지 파일에 덧붙인다. 파일이 곧 기록이다.

양쪽은 [AGENTS.md](../../AGENTS.md)를 공통 규칙 원본으로 사용한다. 루트 `AGENTS.md`와 `CLAUDE.md`도 이 원본을 가리킨다. 브리지는 동일한 원본 내용을 두 방향의 프롬프트에 직접 전달하고 해시를 기록한다. 기존에 열려 있던 상대 세션의 기억이나 지침을 자동 갱신하지 않는다.

공통이라는 뜻은 프로젝트 규칙의 원본과 전달 내용이 같다는 뜻이다. 각 서비스의 시스템 지침·관리자 정책까지 동일하게 만든다는 뜻은 아니다. Claude는 safe/restricted mode·빈 MCP 설정·MCP 도구 차단으로 사용자 훅/플러그인/메모리의 추가 주입을 제한하고, Codex는 `--ignore-user-config`로 사용자 설정의 MCP 등을 로드하지 않는다. 필요한 공통 지침은 호출 측이 명시적으로 전달한다. 관리자 강제 정책은 여전히 적용될 수 있다.

## 고정된 요청 설정

`scripts/ai-bridge/config.json`이 양쪽 호출 설정의 원본이다.

| 호출 대상 | 요청 모델 ID | 요청 추론 수준 |
|---|---|---|
| Codex | `gpt-6.1-sol` | `medium` |
| Claude | `claude-fable-5-2` | `medium` |

각 CLI에 `--model`과 추론 설정(Codex `model_reasoning_effort`, Claude `--effort`)을 명시한다. `default`·`opus` 등 가변 별칭은 사용하지 않는다. 데스크톱 대화의 모델 선택이나 로컬 기본값을 그대로 따르는 방식이 아니다. 설정을 바꾸려면 이 파일을 수정하고 상대 리뷰·실제 호출 결과로 확인한다.

## 어디에 무엇이

| 경로 | 뜻 |
|---|---|
| `docs/ai-bridge/inbox/codex/*.md` | Claude가 Codex에게 보낸 편지 |
| `docs/ai-bridge/inbox/claude/*.md` | Codex가 Claude에게 보낸 편지 |
| `docs/ai-bridge/archive/` | 결론이 난 편지(결정은 `docs/decisions/`로 옮긴 뒤 이동) |
| `scripts/ai-bridge/ask-codex.mjs` | Claude 측 실행. `codex exec -s read-only --ephemeral` |
| `scripts/ai-bridge/ask-claude.mjs` | Codex 측 실행. `claude -p` + 읽기 도구·허용 Git 명령으로 제한 |

## 편지 형식

```markdown
---
id: 2026-11-19-foundation-cleanup
from: claude
to: codex
kind: question | review | proposal
sha: dac127b8ead99f9f6fce8b1d7ccfa0e285ddf0d6
---
# 제목

[배경] …
[요청]
1. …
2. …
```

답은 스크립트가 `## 답변 (Codex, 시각)` 절로 덧붙인다(호출된 쪽은 파일을 만들지 않고 본문만 반환). 첫 줄은 `원문 id: <id> · 확인 HEAD: <전체 SHA 또는 미확인> · 검토 SHA: <요청한 전체 SHA>`이며 끝에 미확인 사항을 적는다. id/HEAD/검토 SHA가 요청과 다르거나 최종 성공 응답이 없으면 정상 답신으로 저장하지 않는다. 모든 새 질문의 sha는 저장소에 존재하는 40자 커밋이어야 하며 이전 7자 편지는 재호출 전에 수정해야 한다.

**호출 HEAD와 검토 SHA가 같고 현재 편지 외 변경이 없어야 시작한다.** 다른 커밋은 해당 커밋의 별도 worktree에서 검토한다. 코드·지침·이전 답신을 먼저 커밋하고 편지를 작성한다. 재질문 때도 현재 검토 기준으로 sha를 갱신한다. 편지 자체만 dirty 판정에서 제외하며 성공 응답은 검토 커밋과 다른 미커밋 코드를 읽었다고 오해되지 않도록 한다.

이어 물으려면 `## 재질문` 절을 쓰고 다시 실행한다. **왕복 1회 = 제안(재질문) 1건 + 답신 1건, 한 편지는 최대 3왕복** — 남은 쟁점은 Issue에 정리하고 사용자 판단이 필요한 것만 올린다.

## 실제 호출 기록

답신 아래 `### 호출 기록`의 JSON에 다음을 남긴다. 원시 CLI 스트림이나 생각 내용은 파일에 저장하지 않는다.

- `requested_model`, `requested_effort`: config.json에서 CLI에 전달한 값.
- `response_models`, `response_model_source`, `model_match`: Claude는 stream-json의 `assistant.message.model`을 수집한다. 여러 모델이 관찰되면 모두 남긴다. 요청과 정확히 다르면 기록은 보존하고 종료 코드 1로 알린다. 날짜 접미사 차이도 자동으로 같다고 추정하지 않으며 실제 모델 변경인지 수동 확인한다. 초기화 시 선택 모델, 보조 모델 사용량, AI 자기보고로 실제 응답 모델을 대신하지 않는다.
- **현재 Codex exec JSONL에는 응답 모델이 없다.** `response_models: []`, 출처 `not_exposed_by_cli`, `model_match: null`로 기록한다. 이는 요청 모델과 동일하다는 확인이 아니다. 양쪽의 실제 적용 추론 수준도 현재 CLI가 반환하지 않아 `response_effort: null`로 기록한다.
- `status: success`는 CLI가 끝나고 본문·SHA 검사를 통과했다는 뜻이다. `model_match: null`이면 실제 응답 모델은 여전히 미확인이다.
- `review_sha`: 호출 측 Git이 확인한 검토 커밋. `head_before`/`head_after`는 실행 worktree의 HEAD, `reported_head`/`reported_review_sha`는 답신 첫 줄에서 확인한 AI의 보고값이다. 이들은 서로 다른 근거이며 자기보고가 실제 코드 검토를 완전히 증명하지 않는다.
- `worktree_dirty`: 현재 편지를 제외한 저장소 전체의 미커밋·미추적 변경 유무. true이면 호출 전에 중단한다.
- `instructions_sha256`, `context_mode`, `cli_version`, `started_at`, `elapsed_ms`, `cli_elapsed_ms`, `usage`: 전달한 지침과 추가 설정 제한 모드, 실행 버전·전체/CLI 호출 소요·제공 토큰 사용량. 제공하지 않는 사용량을 추정하지 않는다.

호출 중 HEAD·작업 트리·공통 지침·편지가 바뀌면 정상 답신을 저장하지 않는다. 시간 초과·비정상 종료·깨진 JSON·실패 결과·불완전한 결과도 정상 답신으로 저장하지 않는다. 편지를 읽은 뒤의 실패는 별도 `## 호출 실패` 절에 설정·단계·시간·얻을 수 있었던 사용량/모델 증거를 남긴다. 원시 stderr·불완전한 본문은 Git 기록에 저장하지 않으며 실패는 성공 왕복으로 세지 않는다. 두 방향에서 같은 구현을 사용한다.

편지는 **검토 기록**이다. 실행 승인이나 작업 선점을 대신하지 않는다(선점은 Issue, 승인은 사용자).

## 실행

```bash
node scripts/ai-bridge/ask-codex.mjs            # codex 편지함의 미답 편지 중 가장 오래된 것
node scripts/ai-bridge/ask-codex.mjs docs/ai-bridge/inbox/codex/2026-11-19-foo.md
node scripts/ai-bridge/ask-claude.mjs           # Codex가 쓰는 대칭 명령
```

환경: `CODEX_BIN`, `CLAUDE_BIN`, `BRIDGE_TIMEOUT_MS`(기본 10분).

두 실행 파일의 기본값은 PATH의 `codex`, `claude`다. 실행 파일 경로와 시간 제한만 환경변수로 바꿀 수 있으며, 요청 모델/추론 수준은 공통 설정 파일로 관리한다.

## 안전선 (양쪽 대칭)

- 호출된 쪽은 **읽기 전용**: 파일 생성·수정·커밋 불가. 저장소를 읽고 `git log/diff/show` 정도로 확인만 한다.
- 세션 비저장(Codex `--ephemeral`, Claude `--no-session-persistence`), 시간 제한, 왕복 상한 3.
- Claude에는 Read·Glob·Grep만 제공하고 셸·MCP·편집 도구는 제공하지 않는다. restricted mode로 파일 도구의 작업 디렉터리를 제한하고 `.env.local`·`serviceAccountKey.json`에 Read 차단 규칙도 전달한다. Git 검증은 호출 측의 고정 코드가 수행하며, AI가 HEAD를 독립 확인하지 못하면 reported_head는 null이다. 이 도구 제한은 OS 파일시스템 샌드박스와 동일한 보장은 아니다. 비밀 설정을 검증 worktree에 복사하지 않는다.
- 유료 AI 생성·운영 데이터 변경·배포·정책 변경은 다리에서 하지 않는다. 답변에 "승인 필요"로만 표시.
- 비용은 답변 절의 주석에 남긴다(`tokens …`). 실측: 제안 1건 검토에 약 170초·2.9만 토큰. **변경 묶음당 제안 1회 + 리뷰 1회, 필요 시 재검토 1회**가 기준. 승인 경계·보안·작업 간 의존성처럼 판단이 필요한 때만 쓰고, 상태 공유·오탈자는 Issue·PR로.

## 구현은 각자 자기 세션에서

다리는 **질문·리뷰·의견** 전용이다. 구현·커밋·PR은 각 AI가 자기 세션에서 자기 브랜치에 한다. 선점은 GitHub Issue, 현황은 `docs/WORKBOARD.md`, 규칙 원본은 `AGENTS.md`, 결정은 `docs/decisions/`(기반 정리 작업에서 신설).

검증: `node --test scripts/ai-bridge/*.test.mjs`는 모델·SHA·실패 처리의 로컬 회귀 검사다. 실제 CLI 호출은 사용자 승인된 협업 검토에서 따로 수행한다. CLI 메타데이터 형식은 [Codex 비대화 문서](https://developers.openai.com/codex/noninteractive), [Claude 비대화 문서](https://code.claude.com/docs/en/headless)를 기준으로 하고 설치된 버전의 실제 결과를 함께 확인한다.
