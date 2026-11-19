# 작업 폴더 보존 보고서

2026-11-19 KST. [Issue #176](https://github.com/lacerta47/ai-program-generator-v2/issues/176) 범위. 원본 폴더 전환·수정·삭제나 main 병합을 수행하지 않았다.

## 로컬 전용 보존

백업 경로: `C:/Users/amh47/.codex/backups/lun-cooperation-20261119/`. `manifest.json`에 원본 경로·브랜치·HEAD·파일 상태·크기·SHA-256을 기록했다. 복사본 체크섬과 복사 당시 원본을 대조했고, 상태 목록·HEAD가 복사 도중 바뀌지 않았음을 확인했다. `.env.local`, `serviceAccountKey.json`은 복사 대상에서 제외했다. ignored 파일 전체를 복사한 백업은 아니다.

보존 기한은 사용자 삭제 결정 전까지이며 자동 삭제하지 않는다. 삭제 판단 주체는 사용자다. AI가 worktree를 정리하더라도 이 백업의 삭제를 함께 수행하지 않는다.

| 원본 | 기준 HEAD | 복사 파일 | 삭제 상태 기록 | 크기(바이트) |
|---|---|---:|---:|---:|
| 기본 폴더 Documents/test | f8d1bc9258a423638a61f0252145e9a648655c75 | 1465 | 12 | 250255452 |
| 설문 | 35e6a0a179618fde0faa0651c4535fa874216260 | 0 | 0 | 0 |
| 모바일 점검 | 30dd9713f13567b9559edd567bd320fe3866604e | 0 | 0 | 0 |
| 운영 메일 | c325709cd49378aecae392e188db3652d422f6b4 | 10 | 0 | 32189 |
| security-deps | e66e9c32e97d86c5235398aa100a0e63e1203a71 | 1775 | 0 | 44259231 |

기본 폴더의 법률/특허·교육 자료, reports·output·tmp, 스크린샷 ZIP 등은 로컬에만 보존했다. 스크린샷 삭제 12건은 삭제 상태와 기준 HEAD로 기록했으며 임의 복원하거나 Git에 새로 올리지 않았다. security-deps의 output 1763파일도 로컬 보존만 했다. 로컬 전용 자료를 GitHub에서 복구할 수 있다는 뜻은 아니다.

설문은 조사 도중 별도 세션이 #175에 코드와 문서를 추가로 커밋·push했다. 백업 시점에는 clean이며 HEAD에 원격 미보존 커밋이 없었다. 해당 세션의 폴더를 수정하지 않았다. 모바일 폴더도 clean이며 #170에 패치가 반영돼 있다. 이 두 폴더에 중복 보존 PR을 만들지 않았다.

## 목적별 원격 보존

| 목적 | 브랜치 | 파일 수 | 보존 범위 |
|---|---|---:|---|
| 운영 메일 | codex/preserve-operations-email | 10 | 일일 통계·신고 메일, health API, 집계·테스트·문서·Cron 설정 |
| 과거 검증 기록 | codex/preserve-validation-records | 5 | 날짜를 붙인 로컬 CHANGELOG 사본, generation-wait-retry 기록 3개, production-functional-security-review |
| 미로·수족관 | codex/preserve-maze-aquarium | 6 | typeGuides와 테스트, 품질·간격·먹이 반응 기록 4개 |
| 모델 연구 메모 | codex/preserve-model-routing-notes | 1 | model-routing-plan의 기존 미커밋 계획·비용 비교 기록 |

네 브랜치는 조사 당시 최신 origin/main `dac127b8ead99f9f6fce8b1d7ccfa0e285ddf0d6`에서 별도 worktree로 만들고 검증된 백업본에서 선택한 파일만 복사했다. 원본 상태와 파일 전체는 로컬 백업에 남는다.

운영 메일의 Vitest 설정 두 파일에는 main의 기존 generationFeedback 테스트 등록을 유지했다. 오래된 원본 설정을 통째로 적용하면 그 등록이 빠지므로 필요한 통합 조정 2줄만 더했다. 다른 보존 파일은 백업과 동일하게 유지했다.

설문 #175가 현행 CHANGELOG를 갱신해 #178에 충돌이 생긴 뒤, 과거 로컬 이력은 같은 docs 폴더의 `CHANGELOG-local-20261103.md`에 원본 바이트로 보존했다. #178은 현행 `CHANGELOG.md`를 변경하지 않는다. 원본 Markdown의 강제 줄바꿈 공백과 마지막 빈 줄도 유지했으며 해당 사본의 diff 검사에서만 기존 공백을 허용했다. 나머지 문서·코드의 공백 검사는 기본 설정으로 수행했다.

원격 보존: [운영 메일 #177](https://github.com/lacerta47/ai-program-generator-v2/pull/177), [검증 기록 #178](https://github.com/lacerta47/ai-program-generator-v2/pull/178), [생성 품질 #179](https://github.com/lacerta47/ai-program-generator-v2/pull/179), [모델 메모 #180](https://github.com/lacerta47/ai-program-generator-v2/pull/180). 모두 초안이며 병합하지 않았다.

로컬 검사: 운영 메일 및 기존 설문 API 테스트 10건, 생성 가이드 테스트 23건, 두 코드 브랜치의 타입 검사·프로덕션 빌드(린트 포함), 각 브랜치 diff 검사 통과. 운영 메일/생성 품질 브랜치는 새 worktree에서 더미 Firebase 빌드 설정으로 확인했고 비밀 설정을 복사하지 않았다. 문서 전용 브랜치에는 앱 빌드를 반복하지 않았다. CI 결과는 각 PR의 현재 상태를 기준으로 확인한다.

보존 PR은 기능 완성·배포 준비 판정이 아니다. 메일 발송, 유료 생성, Google 제출, 운영 UI의 실제 검증은 이번 작업에서 수행하지 않는다. 가격·모델 후보 기록은 과거 계획이며 현재 단가나 운영 적용을 뜻하지 않는다.

## 원격 상태의 후속 변화

확인 당시 기존 설문 #175는 별도 경로에서 2026-11-19 22:15:32 KST에 병합됐고 원격 main은 `1e4a4ecf72fc0f6e16474eef080324b6b00726c2`였다. 이번 보존 작업에서 main push·병합은 하지 않았다. 보존 초안의 기준은 위 #172 커밋이므로 실제 병합 검토 시에는 최신 main과 다시 대조해야 한다. 과거 상태 보존과 최신 main 통합 완료를 구분한다.

로컬 백업과 목적별 보존은 완료했다. 협업 규칙·작업판·결정 형식·속도 방향과 Claude 답신은 [초안 #181](https://github.com/lacerta47/ai-program-generator-v2/pull/181)에 보존했다. #177·#179·#180의 build/firestore-rules 통과를 확인했고 다른 검사 상태는 해당 PR에서 확인한다.
