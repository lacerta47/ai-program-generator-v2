# 작업 폴더 보존 보고서

2026-11-19 KST. [Issue #176](https://github.com/lacerta47/ai-program-generator-v2/issues/176) 범위. 원본 폴더 전환·수정·삭제나 main 병합을 수행하지 않았다.

## 로컬 전용 보존

백업 경로: `C:/Users/amh47/.codex/backups/lun-cooperation-20261119/`. `manifest.json`에 원본 경로·브랜치·HEAD·파일 상태·크기·SHA-256을 기록했다. 복사본 체크섬과 복사 당시 원본을 대조했고, 상태 목록·HEAD가 복사 도중 바뀌지 않았음을 확인했다. `.env.local`, `serviceAccountKey.json`은 복사 대상에서 제외했다. ignored 파일 전체를 복사한 백업은 아니다.

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
| 과거 검증 기록 | codex/preserve-validation-records | 5 | CHANGELOG, generation-wait-retry 기록 3개, production-functional-security-review |
| 미로·수족관 | codex/preserve-maze-aquarium | 6 | typeGuides와 테스트, 품질·간격·먹이 반응 기록 4개 |
| 모델 연구 메모 | codex/preserve-model-routing-notes | 1 | model-routing-plan의 기존 미커밋 계획·비용 비교 기록 |

네 브랜치는 조사 당시 최신 origin/main `dac127b8ead99f9f6fce8b1d7ccfa0e285ddf0d6`에서 별도 worktree로 만들고 검증된 백업본에서 선택한 파일만 복사했다. 원본 상태와 파일 전체는 로컬 백업에 남는다.

운영 메일의 Vitest 설정 두 파일에는 main의 기존 generationFeedback 테스트 등록을 유지했다. 오래된 원본 설정을 통째로 적용하면 그 등록이 빠지므로 필요한 통합 조정 2줄만 더했다. 다른 보존 파일은 백업과 동일하게 유지했다.

이 문서와 WORKBOARD의 후속 갱신에 초안 PR 링크와 검사 결과를 남긴다. 보존 PR은 기능 완성·배포 준비 판정이 아니다. 메일 발송, 유료 생성, Google 제출, 운영 UI의 실제 검증은 이번 작업에서 수행하지 않는다. 가격·모델 후보 기록은 과거 계획이며 현재 단가나 운영 적용을 뜻하지 않는다.
