# 브리지 모델·지침 정렬 검증

2026-11-19 KST, [Issue #182](https://github.com/lacerta47/ai-program-generator-v2/issues/182). 원본 작업 폴더와 운영 설정은 변경하지 않았고 main에 push/병합하지 않았다. 데스크톱 대화의 모델 선택도 바꾸지 않았다.

## 구현과 협의

- 공통 요청 설정: Codex `gpt-6.1-sol`/`medium`, Claude `claude-fable-5-2`/`medium`. [협의](inbox/claude/2026-11-19-model-policy-review.md)와 [재검토](inbox/claude/2026-11-19-model-policy-recheck.md)에서 Claude가 동의했다.
- 루트 AGENTS.md/CLAUDE.md는 활성 프로젝트 AGENTS.md로 안내한다. 기존 Claude 구현 설명은 IMPLEMENTATION-NOTES.md로 이관했다. CHANGELOG main 직접 push 예외를 제거하고 공통 승인 경계를 따른다.
- CLI 성공·실제 모델 증거·호출 측 SHA·AI 보고값을 분리했다. 깨진/실패한 출력은 정상 답신으로 저장하지 않고 이미 받은 증거만 별도 실패 기록에 남긴다.
- Claude의 사용자 MCP/훅/개인 메모리가 첫 검토에 주입된 것을 확인해 safe/restricted mode와 MCP 차단을 추가했다. 최종 호출에는 Read·Glob·Grep만 보인다고 응답했다. 셸·MCP·편집 도구는 제공하지 않았다. 관리자/시스템 지침이 같다는 뜻은 아니다.

## 최종 실제 호출

| 방향 | CLI 버전 | 요청 | 실제 응답 모델 | 검토 SHA | 소요 |
|---|---|---|---|---|---:|
| Codex → Claude | 2.1.328 | claude-fable-5-2 / medium | claude-fable-5-2 (assistant.message.model) | 7eb3ee878d1029d74090875469b0a96515d35c41 | 28303ms |
| Claude 방향 입력 → Codex | codex-cli 0.169.0-alpha.11.1 | gpt-6.1-sol / medium | CLI 미제공, 미확인 | 53823661f5208d67bbadbc9e7cfe520b98ddb62f | 16552ms |

두 호출 모두 호스트 Git 검증에서 review_sha와 호출 전후 HEAD가 일치했고 편지 외 작업 트리가 clean이었다. 두 프롬프트에 전달한 공통 AGENTS의 해시는 모두 `d78146386869def3ae3f8a19b18bb58d91aa583986bea8e681cc7e2118b4e8c2`였다.

[Claude 호출 원본](inbox/claude/2026-11-19-model-metadata-smoke.md), [Codex 호출 원본](inbox/codex/2026-11-19-model-metadata-smoke.md)에 실제 사용량과 전체 호출 기록이 있다. 역방향 입력은 Codex 데스크톱 세션이 작성한 프로토콜 시험이며 원래 Claude 대화창이 직접 발신했다는 뜻은 아니다.

Claude는 셸을 제공하지 않아, Codex는 실행 정책에 Git 명령이 차단돼 독립 HEAD 확인을 못했다고 보고했다. 둘 다 reported_head는 null로 보존하고 호출 측이 실제 Git으로 확인한 HEAD를 별도 기록했다. 응답자가 독립적으로 저장소 코드 전부를 검토한 성공으로 확대하지 않는다. 이번 역방향 시험은 수신·지침 전달·기록 경로의 확인이다.

실제 적용 effort는 두 CLI가 반환하지 않아 null이다. Codex의 모델 미확인은 요청한 모델과 같다는 뜻이 아니며 status: success도 모델 검증 완료를 뜻하지 않는다. 권한을 우회하거나 모델 정체성 자기보고로 채우지 않았다.

## 로컬 검사와 제한

- Node 회귀 검사 15건: 설정 명시·방향/전체 SHA·깨진/실패/부분 JSON·모델 증거·첫 줄 검증·공통 지침·실패 기록/왕복 계산.
- 변경 JS 문법, 지침/문서의 로컬 링크, diff 검사. CI에도 무실호출 Node 검사를 추가했다.
- 앱 코드는 바꾸지 않아 로컬 제품 빌드는 반복하지 않았다. PR의 기존 build/firestore-rules와 새 브리지 검사를 확인한다. 제품 유료 생성·운영 데이터·메일 발송·규칙 배포는 실행하지 않았다.
- 호출 소요는 질문·출력·문맥 범위가 달라 통제된 속도 비교가 아니다. 원시 CLI 스트림·생각 내용·stderr는 Git에 보존하지 않았다.
