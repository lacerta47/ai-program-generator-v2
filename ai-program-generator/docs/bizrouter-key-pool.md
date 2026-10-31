# BizRouter 키 두 개 연결

등록 이름은 기본 `BIZROUTER_API_KEY`, 추가 `BIZROUTER_API_KEY_2`다. 추가 키는 선택 사항이며 없으면 기존 기본 키만 사용한다. 실제 값은 로컬 `.env.local` 또는 Vercel의 서버 전용 Secret에 등록한다.

## 요청 배정

운영의 `bizrouter-first` 모드에서는 기존 서버 공통 슬롯을 먼저 확보한다. 슬롯 번호 0·2는 기본 키, 1·3은 추가 키를 사용하므로 기본 4개 슬롯을 모두 사용하는 상황에서는 키마다 2건씩 처리한다. 한 건만 실행되는 상황에서는 확보된 슬롯에 따라 어느 키든 선택될 수 있다.

BizRouter 전체 상한은 계속 `GEN_BIZROUTER_CONCURRENCY=4`이며 키마다 4개씩 늘리지 않는다. 4개가 모두 차면 기존 Gemini 직접 호출 경로로 넘긴다. Gemini 직접 호출의 상한도 기존대로 4개다. 50:50 비교 모드에도 같은 키 배정 방식을 적용한다. 슬롯을 거치지 않는 내부 호출은 요청 ID를 해시해 키를 배정한다.

한 요청은 처음 정한 키로 끝까지 호출한다. 인증·권한 오류나 응답 중 오류를 다른 키로 자동 재호출하지 않는다. 기본·복잡 모델 배정은 Gemini 3.8 Flash / 4 Argon을 유지한다. 두 키 모두 해당 모델 접근 권한이 있어야 한다.

## 보관 및 운영 반영

- 로컬 추가 등록: `powershell -ExecutionPolicy Bypass -File scripts/set-bizrouter-key.ps1 -Provider bizrouter2`.
- 운영 추가 등록: Vercel Production에 Secret 이름 `BIZROUTER_API_KEY_2`를 추가하고 새 코드로 배포한다. 로컬에서 운영으로 키 값을 자동 복사하지 않는다.
- 키 원문·일부 문자열은 로그·프롬프트·Firestore에 기록하지 않는다. 슬롯 문서의 필드는 그대로 owner·expiresAt이며 새 인덱스나 규칙 변경이 필요하지 않다.
- 키 하나를 더 쓰는 것이 계정의 실제 처리 용량 증설을 보장하지 않는다. 호출 상한 증설과 부하 시험은 별도로 검토한다.

## 2026-10-31 검증

추가 키의 모델 목록 API 인증(HTTP 200)과 두 Gemini 모델의 허용 상태를 확인했다. 생성 API는 호출하지 않았다. 두 키의 실제 Authorization 헤더 사용과 키별 오류의 비재시도는 모의 HTTP 응답으로 검증했다. 에뮬레이터의 실제 슬롯 4개에서 키별 2건 배정과 다섯 번째의 Gemini 분산을 확인했다. 단위 188건·API 46건·Firestore 에뮬레이터 43건, 타입·린트·프로덕션 빌드 통과. 빌드에는 공개 Firebase 설정의 CI용 가상 값을 사용했다.
