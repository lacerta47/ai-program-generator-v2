# 배포 체크리스트 (Vercel + Firebase Spark)

LUN(ai-program-generator) 프로덕션 배포 가이드. **플랫폼: Vercel(호스팅) + Firebase Spark(Auth·Firestore) 유지.**

> **왜 이 조합인가:** 이 앱은 ①생성이 Gemini 추론(10~30초)에 지배되고 ②게시판 탐색은 클라이언트 SDK가 브라우저↔Firestore 직접 통신이라, **서버(호스트) 리전이 체감 속도에 거의 영향이 없다.** 따라서 단순함·비용으로 선택 → Vercel 무료 + Firebase Spark. Firestore는 이미 **asia-northeast3(서울)** 이라 한국 사용자 브라우징이 빠르다. (Blaze/App Hosting은 이 규모엔 과함.)

---

## 0. 사전 확인 (배포 전)

- [ ] Firebase 프로젝트 `test-ai-builder`, Firestore **asia-northeast3** (리전 변경 불가).
- [ ] 보안 규칙·인덱스 배포됨: `firebase deploy --only firestore:rules,firestore:indexes`
- [ ] Gemini **유료(billing 활성)** 키 확보 — 무료 티어는 한도 블로커. (2.5-flash 사용, 폴백 2.5-flash-lite)
- [ ] 관리자 계정에 admin claim 부여: `node scripts/set-admin.mjs <email>` (대상자 재로그인 필요)
- [ ] 로컬에서 `npm run build` 통과 확인.

## 1. Vercel 프로젝트 생성

- [ ] GitHub 저장소 연결.
- [ ] **Root Directory = `ai-program-generator`** (모노레포 하위라 반드시 지정).
- [ ] Framework: Next.js (자동 감지), Build/Output 기본값.

## 2. 환경변수 (Vercel → Settings → Environment Variables)

| 변수 | 형식/예시 | 비고 |
|---|---|---|
| `GEMINI_API_KEY` | (서버 전용) | 유료 키 |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | … | 브라우저 노출 정상 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `test-ai-builder.firebaseapp.com` | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `test-ai-builder` | |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | … | |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | … | |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | … | |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 서비스계정 JSON **전체를 한 줄 문자열로** | 서버 전용. 미설정 시 `/api/generate`·preview·admin이 첫 요청에서 명확한 에러로 실패 |
| `NEXT_PUBLIC_PREVIEW_ORIGIN` | `https://lun-preview.vercel.app` | **빌드타임에 박힘** → 값 바꾸면 재배포 필요. 3장 참고 |
| `CRON_SECRET` | 길고 랜덤한 문자열 | previews 정리 cron 보호. 미설정 시 cron 라우트가 안전하게 500 |
| `GEN_DAILY_LIMIT` | `30` (선택) | 전역 일일 생성 한도의 **env 폴백**. 실제론 관리자 UI(`config/usage`)·학생별(`limits/{uid}`)이 우선 |

> `NEXT_PUBLIC_*`는 **빌드 시점에 번들에 인라인**된다. 값 변경 후엔 반드시 재배포(특히 `NEXT_PUBLIC_PREVIEW_ORIGIN`).
> `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`는 현재 코드에서 미사용(선택).

## 3. 도메인 2개 — 앱 + 미리보기 (핵심)

생성 코드 미리보기를 **다른 오리진**에서 실행해야 무한루프 코드가 메인 탭을 얼리지 못한다(프로세스 격리). 로컬은 `localhost↔127.0.0.1` 자동 스왑이지만, 배포는 **별도 도메인**이 필요.

- [ ] **앱 도메인** 1개 (예: `lun.vercel.app` 또는 커스텀).
- [ ] **미리보기 도메인** 1개 더 — **같은 Vercel 프로젝트에 도메인 alias로 추가** (예: `lun-preview.vercel.app`).
  - 같은 프로젝트라 env가 공유됨 → 미리보기 GET 라우트(`/api/preview/post/[id]`)의 Admin SDK가 그대로 동작.
- [ ] `NEXT_PUBLIC_PREVIEW_ORIGIN` = 미리보기 도메인 URL로 설정 후 재배포.

> 미설정 시 미리보기가 같은 오리진에서 돌아 격리가 **조용히** 깨진다(콘솔 경고만). 반드시 설정.

## 4. Firebase 콘솔 — 승인 도메인

- [ ] Authentication → Settings → **승인된 도메인(Authorized domains)** 에 **앱 도메인 + 미리보기 도메인** 추가.
  - 누락 시 Google 로그인 실패.

## 5. Cron (previews 정리)

- [ ] `vercel.json`의 cron이 자동 등록됨 — 매일 03:00 UTC(정오 KST) `/api/cron/cleanup-previews` 호출. (Hobby도 일 1회 cron 지원)
- [ ] `CRON_SECRET` 설정만 하면 됨(2장). Vercel Cron이 `Authorization: Bearer <CRON_SECRET>`를 자동 첨부.

## 6. 배포 후 검증

- [ ] Google 로그인 동작(승인 도메인 확인).
- [ ] 만들기 → 생성 → **미리보기가 미리보기 도메인에서** 렌더(개발자도구 Network에서 iframe src 오리진 확인).
- [ ] 게시판 글 열기 → 미리보기 렌더(요청이 `GET /api/preview/post/[id]`, POST 쓰기 없음).
- [ ] 업로드/수정/삭제·좋아요·조회·신고·이어만들기 동작.
- [ ] 관리자 페이지(카테고리/신고/사용자) 동작.
- [ ] `GET /api/cron/cleanup-previews`를 시크릿 없이 호출 → 401 확인(보호 동작).
- [ ] 무인증 `POST /api/preview` → 401 확인.

## 7. 확장 시 재검토 (지금은 불필요)

- **카운터 단일문서 처리량 핫스팟**: 좋아요/조회/포크가 단일 post 문서에 수렴(~1 write/s/doc). 인기순 정렬 도입·트래픽 증가 시. (분산 카운터는 `orderBy`와 충돌 주의)
- **스트리밍 생성**: `AIProvider.generate`가 비스트리밍(`Promise`). 10~30초 로딩 체감 개선엔 `AsyncIterable`로 인터페이스 변경 필요.
- **Blaze 전환** 시: Spark 일일 쿼터라는 자연 방어선이 사라지므로 레이트리밋 재점검.

## 부록: 롤백

Vercel은 배포마다 불변 URL을 유지하므로, 문제 시 대시보드에서 직전 배포로 **Instant Rollback**. Firestore 데이터는 호스팅과 독립(영향 없음).
