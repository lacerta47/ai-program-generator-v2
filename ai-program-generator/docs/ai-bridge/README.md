# AI 브리지 — Claude ↔ Codex 직접 질의·리뷰 창구

두 AI가 **실시간 대화 대신 저장소의 편지 파일로** 의견을 주고받는다. 각 호출은 상대 CLI의 비대화 모드를 서브프로세스로 띄우고, 답을 같은 편지 파일에 덧붙인다. 파일이 곧 기록이다.

## 어디에 무엇이

| 경로 | 뜻 |
|---|---|
| `docs/ai-bridge/inbox/codex/*.md` | Claude가 Codex에게 보낸 편지 |
| `docs/ai-bridge/inbox/claude/*.md` | Codex가 Claude에게 보낸 편지 |
| `docs/ai-bridge/archive/` | 결론이 난 편지(결정은 `docs/decisions/`로 옮긴 뒤 이동) |
| `scripts/ai-bridge/ask-codex.mjs` | Claude 측 실행. `codex exec -s read-only --ephemeral` |
| `scripts/ai-bridge/ask-claude.mjs` | Codex 측 실행. `claude -p` + 읽기 도구만 허용 |

## 편지 형식

```markdown
---
id: 2026-11-19-foundation-cleanup
from: claude
to: codex
kind: question | review | proposal
sha: dac127b7…(전체 40자)   # 검토 기준 커밋의 전체 SHA(리뷰면 반드시)
---
# 제목

[배경] …
[요청]
1. …
2. …
```

답은 스크립트가 `## 답변 (Codex, 시각)` 절로 덧붙인다(호출된 쪽은 파일을 만들지 않고 본문만 반환). 답의 첫 줄에 **원문 id와 확인한 HEAD**, 끝에 **미확인 사항**을 적는다. 이어 물으려면 `## 재질문` 절을 손으로 쓰고 다시 실행한다. **왕복 1회 = 제안(재질문) 1건 + 답신 1건, 한 편지는 최대 3왕복** — 남은 쟁점은 Issue에 정리하고 사용자 판단이 필요한 것만 올린다.

편지는 **검토 기록**이다. 실행 승인이나 작업 선점을 대신하지 않는다(선점은 Issue, 승인은 사용자).

## 실행

```bash
node scripts/ai-bridge/ask-codex.mjs            # codex 편지함의 미답 편지 중 가장 오래된 것
node scripts/ai-bridge/ask-codex.mjs docs/ai-bridge/inbox/codex/2026-11-19-foo.md
node scripts/ai-bridge/ask-claude.mjs           # Codex가 쓰는 대칭 명령
```

환경: `CODEX_BIN`(codex.exe 경로, 기본값은 현재 설치 경로), `CLAUDE_BIN`, `BRIDGE_TIMEOUT_MS`(기본 10분).

## 안전선 (양쪽 대칭)

- 호출된 쪽은 **읽기 전용**: 파일 생성·수정·커밋 불가. 저장소를 읽고 `git log/diff/show` 정도로 확인만 한다.
- 세션 비저장(`--ephemeral`), 시간 제한, 왕복 상한 3.
- 유료 AI 생성·운영 데이터 변경·배포·정책 변경은 다리에서 하지 않는다. 답변에 "승인 필요"로만 표시.
- 비용은 답변 절의 주석에 남긴다(`tokens …`). 실측: 제안 1건 검토에 약 170초·2.9만 토큰. **변경 묶음당 제안 1회 + 리뷰 1회, 필요 시 재검토 1회**가 기준. 승인 경계·보안·작업 간 의존성처럼 판단이 필요한 때만 쓰고, 상태 공유·오탈자는 Issue·PR로.

## 구현은 각자 자기 세션에서

다리는 **질문·리뷰·의견** 전용이다. 구현·커밋·PR은 각 AI가 자기 세션에서 자기 브랜치에 한다. 선점은 GitHub Issue, 현황은 `docs/WORKBOARD.md`, 규칙 원본은 `AGENTS.md`, 결정은 `docs/decisions/`(기반 정리 작업에서 신설).
