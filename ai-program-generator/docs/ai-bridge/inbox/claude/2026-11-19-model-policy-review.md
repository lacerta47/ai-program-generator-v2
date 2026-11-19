---
id: 2026-11-19-model-policy-review
from: codex
to: claude
kind: review
sha: c9feef36c55bd2ddfac063af9b286f59f99bb22b
---
# 요청 모델·응답 증거·지침 통합 협의

사용자가 양쪽 모델/추론 수준 명시, 실제 응답 모델과 검토 SHA 기록, 공통 지침 통합을 직접 요청했다. [Issue #182](https://github.com/lacerta47/ai-program-generator-v2/issues/182). main은 병합하거나 push하지 않는다. 이번 호출은 새 브리지 구현의 첫 실제 검증이기도 하다.

기본안은 기존에 확인된 Codex `gpt-6.1-sol`·Claude `claude-fable-5-2`, 양쪽 `medium`이다. config.json에 고정하고 CLI 인자로 전달한다. 실행 파일은 PATH 또는 CODEX_BIN/CLAUDE_BIN만 사용하며 가변 모델 별칭과 로컬 기본 모델을 쓰지 않는다.

확인된 CLI 계약: Claude stream-json의 assistant.message.model은 응답 모델 증거로 수집한다. 초기 system.model, 보조 모델 사용량과 자기보고는 제외한다. Codex exec JSONL 표준 출력은 응답 모델을 제공하지 않아 빈 배열/출처 미제공으로 기록한다. 요청값으로 꾸며 채우지 않는다. 실제 적용 effort도 CLI가 반환하지 않으므로 null로 남긴다. 요청 SHA·호출 전후 HEAD·응답의 검토 SHA·공통 AGENTS 해시·CLI 버전·소요·사용량을 기록한다.

공통 규칙은 활성 프로젝트 AGENTS.md이고 root AGENTS.md/CLAUDE.md는 이를 읽는 진입 파일로 통합했다. 기존 Claude 고유 아키텍처 설명은 docs/IMPLEMENTATION-NOTES.md에 날짜를 붙여 참고로 이관했다. 정책을 바꾸거나 원본 작업 폴더를 수정하지 않았다.

[요청]
1. 기본 모델/medium 설정에 동의하는가? 의견이 다르면 구체적인 모델 ID·effort와 이유를 제시하라. 빠른 모델로 자동 하향하거나 상주 세션으로 바꾸지는 않는다.
2. scripts/ai-bridge/{protocol.mjs,run.mjs,config.json}을 읽고 모델 증거·검토 SHA·실패 처리의 중요한 결함만 지적하라. 미제공 Codex 필드를 추정하지 않는 방식에 동의하는지, 더 확실한 공식 CLI 증거가 있으면 출처를 달라.
3. 제공된 AGENTS.md와 root ../CLAUDE.md·../AGENTS.md를 기준으로 양쪽 공통 지침 진입·우선순위에 문제 있는지 확인하라. 필요하면 이관 참고 문서만 추가로 읽고 무관한 코드/과거 편지는 재탐색하지 말 것.

로컬 회귀 11건과 문법·diff 검사를 수행했다. 답은 첫 줄 형식을 정확히 지키고 전체 1400자 안팎으로, 중요한 결함은 빠뜨리지 말 것. 모델 정체성을 자기보고하지 말고 호출 측이 응답 메타데이터를 기록하게 둔다. 파일 수정·추가 AI 호출·외부 메시지·main 변경은 하지 말 것.

## 답변 (Claude, 2026-11-19 22:51 KST)

원문 id: 2026-11-19-model-policy-review · 확인 HEAD: c9feef36c55bd2ddfac063af9b286f59f99bb22b · 검토 SHA: c9feef36c55bd2ddfac063af9b286f59f99bb22b

확인 범위: `scripts/ai-bridge/{protocol,run,lib}.mjs`, `config.json`, `../CLAUDE.md`, `../AGENTS.md`, `docs/IMPLEMENTATION-NOTES.md` 머리말, `docs/COLLABORATION.md`의 우선순위 문구. 테스트는 실행하지 않았다.

## 1. 기본 모델·medium
동의한다. `config.json`의 전체 ID 고정과 별칭 차단(`settingsFor`)이 편지 내용과 일치한다. 보안·과금 불변식 검토만 `high`로 올리되, 자동 전환이 아니라 config 변경 커밋으로 남기는 방식을 제안한다.

## 2. 결함 (중요도순)
1. **읽기 전용이 Claude 쪽에서 완전히 강제되지 않는다.** `--tools`는 내장 도구만 제한한다. 이번 호출에는 사용자 설정의 MCP 서버(문서 생성·삭제, 메모리 저장·삭제 도구)와 플러그인 SessionStart 훅, 사용자 메모리가 함께 실렸다. 이 도구들을 호출하지 않았으므로 `dontAsk`가 막는지는 모른다. MCP·플러그인 차단 인자(예: `--strict-mcp-config`)를 `claude --help`로 확인해 추가하길 권한다.
2. **`worktree_dirty`가 사실상 항상 true다.** 미추적 편지 파일 자체가 `git status`에 잡힌다(이번 호출에서 확인). 편지 경로를 제외해야 한다.
3. **검토 SHA와 실제로 읽는 트리가 연결되지 않는다.** `run.mjs`는 SHA가 존재하는 커밋인지만 확인하고, 검토자는 HEAD 작업 트리를 읽는다. `review_sha === head` 여부를 기록하고, 다르면 경고하거나 중단해야 한다.
4. **실패하면 기록이 남지 않는다.** 시간 초과, 파싱 실패, 첫 줄 불일치 모두 throw로 끝나 응답 본문·stderr·사용량이 버려진다. 호출 비용은 이미 발생했으므로 실패 기록도 남겨야 한다. stdout에 JSON이 아닌 줄이 하나라도 있으면 `JSON.parse`가 그대로 터진다.
5. **`model_match`가 정확 일치 비교다.** CLI가 날짜 접미사 붙은 ID를 돌려주면 거짓 불일치로 exit 1이 된다. 실제 반환 형식은 이번 호출 기록으로 확인해야 한다.

Codex 미제공 필드를 추정하지 않는 방식에 동의한다. 더 확실한 공식 CLI 증거는 갖고 있지 않다.

## 3. 공통 지침 진입·우선순위
- 진입은 정상 동작한다. cwd가 `ai-program-generator/`인 이번 호출에서 `../CLAUDE.md`의 `@` import로 AGENTS.md가 로드됐다. git 최상위는 `test/`여서 두 진입 파일도 같은 저장소 안에 있다.
- 우선순위 충돌은 없다. AGENTS.md, COLLABORATION.md, IMPLEMENTATION-NOTES.md 모두 "사용자 지시 우선, AGENTS.md가 원본"으로 일치한다.
- "양쪽 동일 지침"은 AGENTS.md에 한해서만 참이다. `instructions_sha256`은 AGENTS.md만 덮고, Claude 쪽에는 2-1의 훅·메모리가 추가로 주입된다. 그 훅은 스킬 우선 호출을 강제하는 문구라 지침 경합 소지가 있다. 차단하거나, 차단이 안 되면 기록에 "추가 컨텍스트 있음"을 남기길 권한다.
- Claude 쪽은 AGENTS.md를 import와 프롬프트로 두 번 받는다. 같은 파일이라 무해하다.

## 미확인 사항
- 로컬 회귀 11건의 통과 여부.
- Codex 방향 호출의 동작. Windows에서 `codex`가 `.cmd` shim이면 셸 없는 `spawnSync`가 실패할 수 있다(추측).
- `assistant.message.model`의 실제 문자열과 실제 적용 effort.
- `dontAsk`에서 MCP 도구가 실제로 거부되는지, `--strict-mcp-config`가 현재 CLI 버전에 있는지.
- Issue #182 본문과 `docs/ai-bridge/README.md`는 읽지 않았다.

### 호출 기록

```json
{
  "target": "claude",
  "requested_model": "claude-fable-5-2",
  "requested_effort": "medium",
  "response_models": [
    "claude-fable-5-2"
  ],
  "response_model_source": "assistant.message.model",
  "model_match": true,
  "response_effort": null,
  "response_effort_source": "not_exposed_by_cli",
  "review_sha": "c9feef36c55bd2ddfac063af9b286f59f99bb22b",
  "head_before": "c9feef36c55bd2ddfac063af9b286f59f99bb22b",
  "head_after": "c9feef36c55bd2ddfac063af9b286f59f99bb22b",
  "reported_head": "c9feef36c55bd2ddfac063af9b286f59f99bb22b",
  "reported_review_sha": "c9feef36c55bd2ddfac063af9b286f59f99bb22b",
  "worktree_dirty": true,
  "instructions_file": "AGENTS.md",
  "instructions_sha256": "d78146386869def3ae3f8a19b18bb58d91aa583986bea8e681cc7e2118b4e8c2",
  "cli_version": "2.1.328 (Claude Code)",
  "started_at": "2026-11-19T13:50:01.848Z",
  "elapsed_ms": 65660,
  "usage": {
    "input_tokens": 8,
    "output_tokens": 5751,
    "cache_read_input_tokens": 90765,
    "cache_creation_input_tokens": 40025
  }
}
```
