# 협업 작업판

2026-11-19 KST 기준. 선점·진행 상태의 원본은 GitHub Issue이고 이 파일은 해당 브랜치 시점의 스냅샷이다. main 병합 금지 기간에는 이 표만 바꿔 공용 상태가 갱신됐다고 판단하지 않는다. 상세 로그와 완료 항목을 계속 누적하지 않는다.

| 작업 | 담당 | 브랜치 | 상태 | 다음 행동·막힘 | Issue / PR |
|---|---|---|---|---|---|
| 브리지 모델·응답 증거·공통 지침 | Codex·Claude | main | #184·#186 반영 | 일반·높은 영향 호출 설정과 검토 SHA별 작업 트리는 활성화. Codex의 실제 응답 모델은 CLI 미제공 | [#184](https://github.com/lacerta47/ai-program-generator-v2/pull/184) · [#186](https://github.com/lacerta47/ai-program-generator-v2/pull/186) |
| 협업·작업 교대 연습 | Codex ↔ Claude | codex/claude-cooperation-drill | 연습 중 | 변경된 SHA·승인 범위·검사 환경을 인계별로 확인 | [#189](https://github.com/lacerta47/ai-program-generator-v2/issues/189) |
| 원본 다섯 작업 폴더 조사·로컬 보존 | Codex | codex/cooperation-rules | 백업 검증 완료 | 원본 전환·삭제는 범위 밖. 로컬 전용 자료는 유지 | [#176](https://github.com/lacerta47/ai-program-generator-v2/issues/176) |
| 운영 메일 보존 | Codex | codex/preserve-operations-email | 초안 PR에 보존 | 로컬 테스트·타입·빌드 통과, 실제 발송 안 함 | [#177](https://github.com/lacerta47/ai-program-generator-v2/pull/177) |
| 과거 운영 검증 기록 보존 | Codex | codex/preserve-validation-records | 초안 PR에 보존 | 2026-11-02~03 기록이며 현재 정상 판정 아님 | [#178](https://github.com/lacerta47/ai-program-generator-v2/pull/178) |
| 미로·수족관 품질 후속 보존 | Codex | codex/preserve-maze-aquarium | 초안 PR에 보존 | 로컬 검사 통과, 새 지침 실제 생성 효과는 미검증 | [#179](https://github.com/lacerta47/ai-program-generator-v2/pull/179) |
| 모델 배정 연구 메모 보존 | Codex | codex/preserve-model-routing-notes | 초안 PR에 보존 | 역사적 가격·후보이며 운영 정책 미적용 | [#180](https://github.com/lacerta47/ai-program-generator-v2/pull/180) |
| 협업 규칙·결정 형식 | Codex → Claude 리뷰 | codex/cooperation-rules | 초안 PR에 보존 | 리뷰 지적 반영, 병합은 하지 않음 | [#181](https://github.com/lacerta47/ai-program-generator-v2/pull/181) |
| 계정별 설문 후속 | 별도 기존 세션 | codex/survey-profile-access | 별도 경로에서 병합됨 | 22:15 KST main 반영 확인. 이번 세션은 해당 폴더·main을 변경하지 않음 | [#175](https://github.com/lacerta47/ai-program-generator-v2/pull/175) |
| CHANGELOG 재생성·기본 폴더 전환 | Claude 담당으로 전달됨 | 미확인 | 이번 작업 범위 밖 | 지침 통합은 새 사용자 지시로 #182에서 구현. 전환 전 보존 확인 필요 | [#173](https://github.com/lacerta47/ai-program-generator-v2/pull/173) 원 제안 |

갱신 시 각 행에 담당·브랜치·상태·다음 행동·Issue/PR을 기록한다. 종료된 행은 Issue에 결과를 남긴 뒤 다음 정리 때 제거한다. 멈춘 작업에는 막힌 이유를 쓰고, 다른 세션의 작업 상태를 추측해 변경하지 않는다.
