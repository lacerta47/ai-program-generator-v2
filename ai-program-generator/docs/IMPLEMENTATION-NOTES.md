# 구현 참고 (2026-11-19 이관)

기존 루트 CLAUDE.md의 아키텍처·역할·UI·보안 설명을 공통 참고 자료로 옮겼다. 기준 문서는 #172에서 갱신된 내용이며 실제 소스·환경 설정은 이후 달라질 수 있다. 개발 규칙은 [AGENTS.md](../AGENTS.md), 협업·승인은 [COLLABORATION.md](COLLABORATION.md)가 원본이다. 아래 설명은 독립적인 승인이나 별도 지침을 만들지 않는다.

## 아키텍처

### AI 어댑터 경계 (핵심 설계)
앱은 `lib/ai/types.ts`의 계약(`GenerateInput` → `GeneratedCode {html, css, javascript}`)만 안다. **제공자 선택은 `lib/ai/provider.ts` 한 곳** — env `AI_PROVIDER`: `gemini` | `bizrouter` | `bizrouter-first`(운영 기본: BizRouter 우선, 슬롯이 차면 Gemini로 넘김) | `split`(50:50 비교 시험). 구현은 `lib/ai/gemini.ts`와 `lib/ai/bizrouter.ts`(OpenAI 호환 SSE, 키 2개 풀 `BIZROUTER_API_KEY`·`_2`)가 각각 스키마 모드·파싱·재시도·코드 게이트를 캡슐화한다. **모델**: 표준 `gemini-3.8-flash`, 복잡 유형(미로·꾸미기·수족관, `lib/ai/modelPolicy.ts`)은 유료 경로에서 `gemini-4-argon`; 무료 자동 예시(`tier:'free'`)는 항상 Gemini 직결. **동시성**: 사용자 생성은 `prepareUserGeneration`이 쿼터 예약 전에 슬롯을 임대(`lib/server/generationSlots.ts`, `generationSlots` 문서 임대 120초·갱신 20초, `GEN_BIZROUTER_CONCURRENCY` 10 / `GEN_GEMINI_CONCURRENCY` 4) — 가득 차면 `GenerationBusyError`(HTTP 응답 `code: generation_busy, retryable`)로 클라가 대기·재시도. AI 호출은 서버 전용 `app/api/generate/route.ts`에서만(키 노출 방지). 시스템 프롬프트는 클라가 보낸 `system`을 무시하고 서버가 `variant` 키로 선택(주입 차단)하며, 선택지 유형이면 `lib/ai/typeGuides.ts`의 **유형별 제작 규칙 + 디자인 프리셋**(미로·꾸미기·그림판·퀴즈·수족관·룰렛·게임)을 덧붙인다. 생성 코드는 `lib/ai/validateCode.ts` 게이트를 통과해야 하고 탈락은 `stats/{day}`에 사유별 집계된다.

### Firebase 계층
- `lib/firebase/client.ts` — 클라이언트 SDK 단일 초기화 (`NEXT_PUBLIC_*` env).
- `lib/firebase/posts.ts` — 커서 기반 페이지네이션. 쿼리는 `firestore.indexes.json`의 복합 인덱스(`categoryId asc, createdAt desc`)와 일치해야 함. 쿼리 모양을 바꾸면 인덱스도 갱신·배포할 것.
- `lib/firebase/categories.ts` — 카테고리 CRUD. Firestore에는 컬렉션 cascade 삭제가 없어 `deleteCategoryWithPosts`가 450건 단위 배치로 하위 게시물을 지움.
- **권한 모델** (`firestore.rules`): **posts·users·nicknames의 클라 쓰기는 전부 차단**(`allow create/update/delete: if false`) — 쓰기는 서버 API(Admin SDK)로 일원화. posts 읽기는 공개 보드=누구나, 교실 보드=그 교사·그 반 학생·admin. categories는 admin 전용. **admin = Auth custom claim** (`scripts/set-admin.mjs`로 부여, DB에 저장 안 함). 클라이언트의 `useAuth().isAdmin`은 UI 노출용일 뿐, 실제 방어선은 rules와 서버 게이트.
- **게시물 쓰기 경로**: `lib/firebase/posts.ts`의 `createPost`/수정/삭제는 `authedJson`으로 `POST /api/posts`·`PATCH|DELETE /api/posts/[id]`를 호출한다. 서버 `lib/server/postWrite.ts`(`prepareNewPost`·`preparePostEdit`)가 필드·크기·카테고리 권한을 검증하고 **서버에서 검열**(제목·작성자명·화면 문구)하며, `postRate` 레이트리밋(10분 30회)을 건다. 닉네임은 `/api/me/nickname`. 열람은 비로그인 허용, 생성·게시는 로그인 필요.
- `serviceAccountKey.json`(루트, gitignored) — Admin SDK용. `.env.local` 키 목록은 `.env.example` 참조.
- **컬렉션 지도**: 공개 읽기 = `posts`(교실 보드 제외)·`categories`·`users`(닉네임)·`nicknames`·`schools`·`posts/*/likes`. admin/본인 읽기 = `reports`·`teachers`·`students`·`sessions`. **서버 Admin SDK 전용**(규칙 `if false` 또는 match 없음) = `usage`·`memberUsage`·`limits`·`config`·`stats`·`exemplars`·`previews`·`generationSlots`·`genAdmission`·`genRate`·`postRate`·`accountStatus`·`photoConsents`·`generationFeedback`·`posts/*/views`.
- **서버 게이트**: `lib/admin/requireAdmin.ts`·`requireTeacher.ts` 둘 다 `Promise<{uid} | NextResponse>` 반환 — 호출부는 반드시 **`const gate = await requireX(req); if (gate instanceof NextResponse) return gate;`**. 성공도 truthy(`{uid}`)이므로 `if (gate) return gate`로 쓰면 정상 요청이 막힘(과거 footgun).
- **클라 인증 fetch**: 새 인증 요청은 `lib/client/authedFetch.ts`의 `authedJson`(파싱+`data.error` throw) 또는 `authedFetch`(원시 Response — 스트리밍·프리뷰)만 쓴다. `getIdToken()`+Bearer를 직접 짜지 말 것.
- **토큰 검증은 `lib/server/verifyActiveToken.ts`**: `verifyIdToken(checkRevoked)` + `accountStatus/{uid}.blocked` 확인(정지·삭제 중 계정을 Auth 전파보다 먼저 차단, `lib/server/accountStatus.ts`). 새 서버 라우트에서 `adminAuth.verifyIdToken`을 직접 부르지 말 것.

### 역할 체계 · 발급형 계정 · 학생 로그인
- **3단 역할**(Auth custom claim): `admin`(`set-admin.mjs`) → `teacher`(=학교, admin 발급) → `student`(교사 발급). 발급형 계정은 가짜 `@class.kr` 이메일이라 email_verified 면제 — `isRoleAccount()`로 게시·생성 허용.
- **학교 = 교사**: `schoolCode = 교사 loginId`. admin이 교사 발급 시 공개 `schools/{schoolCode}` 생성(학생 로그인 드롭다운 소스).
- **학번 발급**: 교사가 학년·반·인원·PIN 입력 → `students/{uid}`{teacherUid, schoolCode, hakbun=`{학년}{반2}{번호2}`(예 10101)}. 이메일 `{schoolCode}-{hakbun}@class.kr`.
- **학생 로그인(별도 API 없음)**: LoginDialog `[학생]` 탭 — 학교+학번+PIN을 클라가 `{schoolCode}-{hakbun}@class.kr`로 조합해 `signInWithEmailAndPassword`. 단일 세션은 `sessions/{uid}.activeToken` + 클라 리스너(`lib/client/session.ts` + AuthProvider) — **협조적**(새 로그인이 이전 탭을 로그아웃; 서버 강제 아님).
- **공유 풀 쿼터**(`lib/server/studentQuota.ts`): 교사 `totalQuota`(누적 풀, admin이 PATCH로 보충) + 학생 `daily`/`total` 캡. `reserve`/`refund`는 reads-before-writes 트랜잭션·대칭. 1일형은 per-학생 누적을 일부러 미추적(usage 일일 카운터만 — 1일↔총형 전환 락 방지).
- **교사 삭제 캐스케이드**(`lib/server/deleteAccount.ts`): 교사 삭제 시 산하 학생은 **삭제하지 않고 정지**(작품·보드 보존), `schools/{schoolCode}`는 삭제. 정지된 학생 계정과 차단 표식은 보존 기한 뒤 `lib/server/accountRetention.ts`가 소량씩 파기(방침의 보유기간과 일치시킬 것). 본인 글 신고(postOwnerUid==uid)는 글과 함께 삭제, 본인이 낸 신고(reporterUid==uid)는 보존.

### UI 시스템
- **모든 화면은 `components/ui/` 프리미티브만 사용** (Button/Card/Field/Chip/LoadingDots/FloatingShapes). 새 화면에 일회성 스타일을 흩뿌리지 말 것.
- 디자인 토큰은 `app/globals.css`에 OKLCH CSS 변수 + Tailwind v4 `@theme inline` (별도 tailwind.config 없음). 라이트/다크는 `.dark` 클래스 기반(`@custom-variant`).
- 폰트: Jua(제목, `--font-display`) + Gowun Dodum(본문 17px) — `next/font/google`로 로드.
- 모션 유틸(`press`, `lift`, `anim-pop-in`, `stagger`, `hover-wiggle` 등)은 globals.css에 정의, 전부 `prefers-reduced-motion` 가드 적용. 새 애니메이션도 이 가드를 지킬 것.
- `components/fx/` — reactbits.dev에서 가져와 손질한 효과들(Particles=ogl 기반, BorderGlow). WebGL 컴포넌트는 `next/dynamic(ssr:false)`으로만 로드해 초기 번들에서 제외.
- 마이크로카피는 저학년 친화 한국어("~해요" 체, 쉬운 어휘). 이모지 장식·외부 마스코트 에셋은 쓰지 않기로 확정 — 생동감은 CSS 모션으로. 유일한 예외는 `components/ui/BuilderBot.tsx`(생성 로딩 화면용, 순수 CSS로 그린 오리지널 로봇).

### 보안 장치 (무력화 금지)
- **`/api/generate` 쿼터**: `verifyActiveToken`(Bearer) + 인증 게이트(발급계정은 email_verified 면제). 순서 = 입장 레이트리밋(`genAdmission` 1분 30회) → 슬롯 임대 → 쿼터 예약 → 생성 레이트리밋(`genRate` 10분 30회, 비환불) → 제공자 호출. 학생=교사 공유 풀/캡(`studentQuota`), **교사·admin=일일 `ROLE_DAILY_LIMIT`(기본 100, env `ROLE_GEN_DAILY_LIMIT`)**, **일반 회원=평생 총 5회**(`lib/server/memberQuota.ts`, `memberUsage/{uid}`; 기본값 env `GEN_TOTAL_LIMIT`, config·per-user override는 `readEffectiveTotalLimit`). 일일 집계는 `usage/{uid}_{day}`(KST). 쿼터는 **제공자 호출 전** 차감 → 거절에 비용 없음, 실패·취소 시 정확히 1회 환불하고 슬롯을 반납. **사진 첨부는 `photoConsents/{uid}` 동의 기록이 없으면 403**(차감·호출 없음, `lib/server/photoConsent.ts`).
- **미리보기 프로세스 격리**: 생성 코드는 srcDoc이 아니라 `POST /api/preview`(`previews` 컬렉션, TTL 10분) → **교차 사이트 URL**(localhost↔127.0.0.1 스왑)로 iframe(`sandbox allow-scripts`, no same-origin). srcDoc으로 되돌리지 말 것. 배포 시 `NEXT_PUBLIC_PREVIEW_ORIGIN` 필수 — 미설정 시 같은 오리진 폴백 대신 **명시적 실패**(`FullscreenFrame`).
- **firestore.rules 정합성**: 게시물 검증(필드 화이트리스트·크기 code 각 150k·카테고리 존재와 교사보드 소속·ownerUid/categoryId 변조 차단·예약어 사칭 거부)은 이제 **서버 `postWrite.ts`가 수행**하고 규칙은 클라 쓰기를 막는다. 신고 create는 규칙에서 **`postOwnerMatches`**(postOwnerUid=실제 글 주인 강제) + 필드/크기 검증 + `createdAt<=now+1h`. 카운터(좋아요·조회·포크)는 서버 API 전용. 쿼리·스키마를 바꾸면 규칙·`firestore.indexes.json`·`tests/firestore`를 함께 갱신·배포.
- **검열은 서버 강제**(`lib/moderation.ts` korcen, `postWrite.ts`에서 호출): 2026-10-28(#163)부터 게시물·닉네임 쓰기가 서버 경유라 SDK 직접쓰기 우회가 불가능하다. 클라 쪽 검사는 입력 즉시 안내용. 교사 신고 인박스(`/api/teacher/reports`)는 사후 대응 경로로 유지.

### 함정 (이미 한 번씩 밟은 것들)
- **모달은 반드시 `createPortal(…, document.body)`** — 헤더의 `backdrop-blur`가 `position: fixed`의 기준점을 가로채 모달이 헤더 안에 갇힘 (LoginDialog에서 실제 발생했던 버그).
- `<html>`에 `suppressHydrationWarning` 필수 — layout의 테마 스크립트가 하이드레이션 전에 `.dark`를 붙이므로.
- 입력란 커서: globals.css의 커스텀 I-빔 cursor 규칙은 사용자 환경에서 기본 I-빔이 안 보이는 문제 보정용 — 제거하지 말 것.
