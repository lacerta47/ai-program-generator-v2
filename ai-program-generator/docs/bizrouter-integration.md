# BizRouter 제공자 연결

현재 전환 설정(2026-10-31): 사용자 생성은 `AI_PROVIDER=bizrouter`, 기본 모델은 `google/gemini-3.8-flash`, 복잡 유형 모델은 `google/gemini-4-argon`이다. 기존 모델 배정을 유지하며 호출 제공자와 인증 키만 BizRouter로 바꾼다. 로컬 작업 폴더에 적용했으며, 운영 환경변수 변경 및 배포는 별도 절차다. 이 설정의 실제 생성 호환성은 승인받은 시험에서 확인해야 한다.

- 코드의 미설정 시 기본 제공자는 Gemini다. 현재 환경설정 예시는 BizRouter를 명시적으로 선택한다. BizRouter 키만 등록해도 서비스는 전환되지 않는다.
- 테스트 및 운영 전환에는 서버 환경변수 `AI_PROVIDER=bizrouter`, `BIZROUTER_API_KEY`, `BIZROUTER_MODEL`이 필요하다. `BIZROUTER_HIGH_MODEL`이 없으면 복잡 유형도 기본 모델을 사용한다.
- 모델 ID는 BizRouter의 키별 모델 목록에서 확인해야 한다. 선정한 모델과 제공자가 JSON Schema 및 필요한 경우 이미지 입력을 지원하는지도 확인한다. 설정 이름을 `NEXT_PUBLIC_`으로 시작하지 않는다.
- 자동 예시의 `tier=free` 요청은 기존 무료 Gemini 경로를 유지한다. BizRouter 호출이 실패할 때 다른 제공자로 자동 전환하지 않는다.
- 생성 요청에는 계획서와 코드, 사진 사용 시 사진이 전송된다. 운영 전 전송 대상의 개인정보·로그·모델 학습 정책을 확인한다.
- Vercel 환경변수는 해당 Production/Preview 환경의 새 배포부터 반영된다. 운영 전환 전 모의 검사 및 별도 승인받은 실제 생성·취소·오류 검증과 비용 확인이 필요하다.
- 되돌릴 때는 `AI_PROVIDER=gemini`로 설정하고 새 배포를 수행한다. BizRouter를 선택했으나 키나 모델이 없으면 오류로 처리하며 Gemini로 자동 전환하지 않는다.
- 로컬 자동 테스트는 모의 fetch만 사용하며 실제 키나 API를 호출하지 않는다.

## 로컬 키 자동 로딩

`powershell -ExecutionPolicy Bypass -File scripts/set-bizrouter-key.ps1`을 직접 실행해 키를 한 번 등록한다. 입력은 숨겨지며 Git에서 제외된 `.env.local`에 `BIZROUTER_API_KEY`를 추가한다. 기존 파일을 읽거나 Gemini 설정을 다시 쓰지 않는다. 재등록하면 마지막 항목이 적용된다. 이 파일은 일반 로컬 환경설정 파일이므로 PC 계정과 파일 접근 권한으로 보호해야 한다.

등록 여부만 확인하려면 `node scripts/run-bizrouter-local.mjs --check`를 실행한다. 키 값과 일부 문자열도 출력하지 않으며 API를 호출하지 않는다.

분산 호출 준비 시 기존 Gemini 키도 같은 작업 환경에 필요하면 `powershell -ExecutionPolicy Bypass -File scripts/set-bizrouter-key.ps1 -Provider gemini`로 한 번 등록한다. Gemini 키는 `GEMINI_API_KEY`로 추가된다. 이 등록 자체는 생성이나 제공자 전환을 실행하지 않는다.

승인받은 생성 시험은 `node scripts/run-bizrouter-local.mjs <Vitest 설정 파일>`로 실행한다. Next.js와 같은 환경설정 로더로 키를 프로세스에 전달하므로 매번 붙여 넣을 필요가 없다. 키가 없으면 호출 전에 중단한다. 로컬 등록과 Vercel 환경변수 등록은 서로 독립적이다. 키 등록만으로 서비스 제공자는 전환되지 않는다.

## 분산 모드 준비

### BizRouter 키 2개 사용

`BIZROUTER_API_KEY_2`를 추가하면 같은 모델을 두 BizRouter 키로 호출한다. 서버 공통 슬롯의 짝수 번호는 기본 키, 홀수 번호는 두 번째 키를 사용한다. 운영 설정은 `GEN_BIZROUTER_CONCURRENCY=10`으로 키마다 동시 5건이며, 이후 초과 요청은 Gemini 직접 호출 최대 4건에 배정한다. 키 2개를 등록하는 것만으로 총 슬롯 수가 늘지는 않으며 운영 상한을 명시적으로 설정한다. 환경변수가 없으면 라이브러리 기본값은 4개다.

직접 제공자 호출처럼 슬롯을 사용하지 않는 내부 실행에서는 서버 요청 ID로 키를 안정적으로 배정한다. 두 번째 키가 없으면 기존 기본 키만 사용한다. 특정 키의 인증·권한·응답 오류는 다른 키로 자동 재호출하지 않는다. 선택된 요청은 처음 정한 키로 끝까지 실행한다. 두 번째 키도 같은 모델 접근 권한이 있어야 한다.

운영에서는 두 번째 키를 Vercel Production의 Secret 환경변수로 별도 등록하고 새 코드를 배포해야 한다. 로컬 파일의 키를 운영으로 자동 복사하지 않는다. 키 원문은 프롬프트·로그·Firestore 슬롯 문서에 기록하지 않는다.

운영 요청에 따른 최신 정책은 [BizRouter 우선 배포 안내](bizrouter-first-deployment.md)의 `AI_PROVIDER=bizrouter-first`다. BizRouter 슬롯이 찼을 때만 Gemini로 초과분을 보낸다. 아래 `split` 설정은 비교 시험용 50:50 배정 설명이다.

`AI_PROVIDER=split`은 사용자 요청을 서버 요청 ID 기준으로 약 50:50 배정한다. `BIZROUTER_MODEL=google/gemini-3.8-flash`, `BIZROUTER_HIGH_MODEL=google/gemini-4-argon`과 두 제공자 키가 필수다. 무료 자동 예시는 Gemini 경로를 유지한다.

사용자 API는 분산 모드에서 서버 공통 슬롯을 먼저 확보하고 한도를 예약한다. `GEN_GEMINI_CONCURRENCY`와 `GEN_BIZROUTER_CONCURRENCY`는 각각 기본 4이며 1~16만 허용한다. 슬롯이 없으면 503과 Retry-After로 안내하고 한도는 차감하지 않는다. 슬롯은 120초 임대, 20초마다 갱신하며 갱신이 지연되면 만료 전 호출을 취소한다. 완료·실패 시 소유권을 확인하고 해제한다. 프로세스가 중단되면 만료된 슬롯을 다음 요청이 회수한다. Firestore 슬롯 문서는 클라이언트 접근이 금지된다.

현재 분산 설정은 활성화하지 않았다. 정확한 계정 한도와 실제 Gemini 생성 호환성 확인 후 적용한다. 활성화 또는 슬롯 상한을 줄이는 배포에서는 기존 진행 중 호출을 먼저 소진해야 하며, 구버전과 새 버전이 혼재하는 동안 즉시 새 상한이 보장된다고 보지 않는다. 단독 모드는 기존 동작을 유지하고 이 슬롯 제어를 사용하지 않는다.

직접 Gemini 경로의 기존 모델 폴백은 유지된다. 정상 요청의 기본·복잡 모델 배정은 같지만, 공급사 제한 시 실제 모델 선택은 두 경로가 다를 수 있으므로 실제 모델도 시험에서 기록해야 한다. 외부에서 동일 HTTP 요청을 반복했을 때 작업을 하나로 합치는 영속 중복 방지는 후속 대기열 단계의 과제다.
