# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 워크스페이스 구성

- **`ai-program-generator/`** — 활성 프로젝트. Next.js 15로 정식 재구축한 "AI 프로그램 생성기" (계획서를 쓰면 Gemini가 HTML/CSS/JS를 생성, 미리보기·수정·ZIP 다운로드·게시판 공유).
- **`ai-프로그램-생성기/`** — Google AI Studio로 만든 레거시 목업 (React+Vite, 별도 git repo). **참고용으로만 사용, 여기서 개발하지 말 것.** 이 목업의 `adminadmin` 백도어·4자리 평문 비밀번호·무인증 Cloud Function 패턴은 의도적으로 폐기한 것이므로 새 프로젝트로 이식 금지.
- `PRODUCT.md` / `DESIGN.md` (워크스페이스 루트) — 디자인 작업 전 필독. 타깃(초등 저학년), 브랜드 무드, 색·타이포·모션 시스템이 정의되어 있음.

⚠️ 한글 폴더명(`ai-프로그램-생성기`)은 bash `cd`에서 인코딩 오류가 남. 해당 폴더 접근은 PowerShell `-LiteralPath`를 사용.

## 명령어 (모두 `ai-program-generator/`에서 실행)

```bash
npm run dev          # 개발 서버 (3000 포트; 점유 시 3001+로 밀림 — 잔여 node 프로세스 정리 후 재시작 권장)
npm run build        # 프로덕션 빌드 + 타입체크 (dev 서버와 .next를 공유하므로 dev 실행 중 build 금지)
./node_modules/.bin/tsc --noEmit   # dev 서버 띄운 채 안전하게 타입체크 (npx tsc는 다른 cwd에서 가짜 패키지를 설치하므로 금지)
npm run check-key    # Gemini API 키 실연결 점검 (의존성 없음)
node scripts/set-admin.mjs <email>  # 해당 계정에 admin claim 부여 (대상자는 재로그인 필요)
firebase deploy --only firestore:rules,firestore:indexes  # 보안 규칙·인덱스 배포 (프로젝트: test-ai-builder)
```

테스트 프레임워크는 없음. 검증은 `tsc --noEmit` + `npm run build` + **`scripts/selftest-*.mjs`** + 브라우저 확인. self-test는 **커밋하지 않는 일회성 스크립트**(git status에 `??`로 남김): Admin SDK로 시드·custom token 발급 후, **서버 API**(dev 필요) 또는 **클라이언트 SDK**로 검증하고 끝에서 시드를 정리한다. **firestore.rules는 반드시 client SDK로 검증** — Admin SDK는 규칙을 우회한다. 규칙을 바꾸면 `firebase deploy` 후 self-test로 확인.

## 아키텍처

### AI 어댑터 경계 (핵심 설계)
앱은 `lib/ai/types.ts`의 계약(`GenerateInput` → `GeneratedCode {html, css, javascript}`)만 안다. **제공자 교체 지점은 `lib/ai/provider.ts` 단 한 곳.** `lib/ai/gemini.ts`가 JSON 스키마 모드, 응답 파싱, 503/429 재시도를 전부 캡슐화한다. 모델은 생성·수정 모두 `gemini-2.5-flash`(기본) → `gemini-2.5-flash-lite`(폴백) — 2026-04부터 2.5-pro가 무료 티어에서 제외됐기 때문이며, pro로 바꾸려면 결제 필요. AI 호출은 서버 전용 `app/api/generate/route.ts`에서만 (키 노출 방지). 인증·쿼터는 아래 '보안 장치' 참고. 시스템 프롬프트는 클라가 보낸 `system`을 무시하고 서버가 `variant` 키로 선택(주입 차단).

### Firebase 계층
- `lib/firebase/client.ts` — 클라이언트 SDK 단일 초기화 (`NEXT_PUBLIC_*` env).
- `lib/firebase/posts.ts` — 커서 기반 페이지네이션. 쿼리는 `firestore.indexes.json`의 복합 인덱스(`categoryId asc, createdAt desc`)와 일치해야 함. 쿼리 모양을 바꾸면 인덱스도 갱신·배포할 것.
- `lib/firebase/categories.ts` — 카테고리 CRUD. Firestore에는 컬렉션 cascade 삭제가 없어 `deleteCategoryWithPosts`가 450건 단위 배치로 하위 게시물을 지움.
- **권한 모델** (`firestore.rules`): posts는 공개 읽기 / 로그인 사용자가 `ownerUid == 본인`으로 생성 / 본인 또는 admin만 수정·삭제. categories는 admin 전용. **admin = Auth custom claim** (`scripts/set-admin.mjs`로 부여, DB에 저장 안 함). 클라이언트의 `useAuth().isAdmin`은 UI 노출용일 뿐, 실제 방어선은 rules.
- 로그인은 **게시판 업로드/수정/삭제에만** 요구. 생성·열람은 비로그인 허용 (의도된 정책).
- `serviceAccountKey.json`(루트, gitignored) — Admin SDK용. `.env.local` 키 목록은 `.env.example` 참조.
- **컬렉션 지도**: 공개 읽기 = `posts`·`categories`·`users`(닉네임)·`nicknames`(유일성 점유)·`schools`. admin/본인 = `reports`·`teachers`·`students`·`sessions`. 서버 Admin SDK 전용(클라 match 없음 또는 `write:if false`) = `usage`·`limits`·`exemplars`·`previews`·`config`.
- **서버 게이트**: `lib/admin/requireAdmin.ts`·`requireTeacher.ts` 둘 다 `Promise<{uid} | NextResponse>` 반환 — 호출부는 반드시 **`const gate = await requireX(req); if (gate instanceof NextResponse) return gate;`**. 성공도 truthy(`{uid}`)이므로 `if (gate) return gate`로 쓰면 정상 요청이 막힘(과거 footgun).
- **클라 인증 fetch**: 새 인증 요청은 `lib/client/authedFetch.ts`의 `authedJson`(파싱+`data.error` throw) 또는 `authedFetch`(원시 Response — 스트리밍·프리뷰)만 쓴다. `getIdToken()`+Bearer를 직접 짜지 말 것.

### 역할 체계 · 발급형 계정 · 학생 로그인
- **3단 역할**(Auth custom claim): `admin`(`set-admin.mjs`) → `teacher`(=학교, admin 발급) → `student`(교사 발급). 발급형 계정은 가짜 `@class.kr` 이메일이라 email_verified 면제 — `isRoleAccount()`로 게시·생성 허용.
- **학교 = 교사**: `schoolCode = 교사 loginId`. admin이 교사 발급 시 공개 `schools/{schoolCode}` 생성(학생 로그인 드롭다운 소스).
- **학번 발급**: 교사가 학년·반·인원·PIN 입력 → `students/{uid}`{teacherUid, schoolCode, hakbun=`{학년}{반2}{번호2}`(예 10101)}. 이메일 `{schoolCode}-{hakbun}@class.kr`.
- **학생 로그인(별도 API 없음)**: LoginDialog `[학생]` 탭 — 학교+학번+PIN을 클라가 `{schoolCode}-{hakbun}@class.kr`로 조합해 `signInWithEmailAndPassword`. 단일 세션은 `sessions/{uid}.activeToken` + 클라 리스너(`lib/client/session.ts` + AuthProvider) — **협조적**(새 로그인이 이전 탭을 로그아웃; 서버 강제 아님).
- **공유 풀 쿼터**(`lib/server/studentQuota.ts`): 교사 `totalQuota`(누적 풀, admin이 PATCH로 보충) + 학생 `daily`/`total` 캡. `reserve`/`refund`는 reads-before-writes 트랜잭션·대칭. 1일형은 per-학생 누적을 일부러 미추적(usage 일일 카운터만 — 1일↔총형 전환 락 방지).
- **교사 삭제 캐스케이드**(`lib/server/deleteAccount.ts`): 교사 삭제 시 산하 학생은 **삭제하지 않고 Auth만 비활성**(작품·보드 보존), `schools/{schoolCode}`는 삭제. 본인 글 신고(postOwnerUid==uid)는 글과 함께 삭제, 본인이 낸 신고(reporterUid==uid)는 보존.

### UI 시스템
- **모든 화면은 `components/ui/` 프리미티브만 사용** (Button/Card/Field/Chip/LoadingDots/FloatingShapes). 새 화면에 일회성 스타일을 흩뿌리지 말 것.
- 디자인 토큰은 `app/globals.css`에 OKLCH CSS 변수 + Tailwind v4 `@theme inline` (별도 tailwind.config 없음). 라이트/다크는 `.dark` 클래스 기반(`@custom-variant`).
- 폰트: Jua(제목, `--font-display`) + Gowun Dodum(본문 17px) — `next/font/google`로 로드.
- 모션 유틸(`press`, `lift`, `anim-pop-in`, `stagger`, `hover-wiggle` 등)은 globals.css에 정의, 전부 `prefers-reduced-motion` 가드 적용. 새 애니메이션도 이 가드를 지킬 것.
- `components/fx/` — reactbits.dev에서 가져와 손질한 효과들(Particles=ogl 기반, BorderGlow). WebGL 컴포넌트는 `next/dynamic(ssr:false)`으로만 로드해 초기 번들에서 제외.
- 마이크로카피는 저학년 친화 한국어("~해요" 체, 쉬운 어휘). 이모지 장식·외부 마스코트 에셋은 쓰지 않기로 확정 — 생동감은 CSS 모션으로. 유일한 예외는 `components/ui/BuilderBot.tsx`(생성 로딩 화면용, 순수 CSS로 그린 오리지널 로봇).

### 보안 장치 (무력화 금지)
- **`/api/generate` 쿼터**: Firebase ID 토큰(Bearer) + 인증 게이트(발급계정은 email_verified 면제). 학생=공유 풀/캡, **교사·admin=일일 `ROLE_DAILY_LIMIT`(기본 100, env `ROLE_GEN_DAILY_LIMIT`)**, 일반 사용자=`readEffectiveLimit`(기본 30, `GEN_DAILY_LIMIT`/config·per-user override). 카운터는 Admin SDK 전용 `usage/{uid}_{day}`(KST). 쿼터는 **Gemini 호출 전** 차감 → 429에 비용 없음, 실패 시 1회 환불.
- **미리보기 프로세스 격리**: 생성 코드는 srcDoc이 아니라 `POST /api/preview`(`previews` 컬렉션, TTL 10분) → **교차 사이트 URL**(localhost↔127.0.0.1 스왑)로 iframe(`sandbox allow-scripts`, no same-origin). srcDoc으로 되돌리지 말 것. 배포 시 `NEXT_PUBLIC_PREVIEW_ORIGIN` 필수 — 미설정 시 같은 오리진 폴백 대신 **명시적 실패**(`FullscreenFrame`).
- **firestore.rules 정합성**(get/exists 교차검증): 게시물 create는 필드 화이트리스트+크기(code 각 150k) + **`categoryAllowed`**(교사보드엔 그 교사/그 학생만, 카테고리 존재 확인), update는 diff로 ownerUid·categoryId·code 변조 차단. 신고 create는 **`postOwnerMatches`**(postOwnerUid=실제 글 주인 강제) + 필드/크기 검증 + `createdAt<=now+1h`. authorName·닉네임은 **`notImpersonating`**(관리자/운영자/admin 등 예약어 부분일치 거부). 카운터(좋아요·조회·포크)는 서버 API 전용. 쿼리·스키마를 바꾸면 규칙·`firestore.indexes.json`도 함께 배포.
- **클라 검열은 1차 방어선**(`lib/moderation.ts` korcen): SDK 직접쓰기 우회는 못 막음 — 그 이상은 신고(교사 인박스 `/api/teacher/reports`, postOwnerUid∈내학생)로 대처하기로 결정. 게시물 생성을 서버경유로 돌리는 무거운 길은 의도적으로 비채택.

### 함정 (이미 한 번씩 밟은 것들)
- **모달은 반드시 `createPortal(…, document.body)`** — 헤더의 `backdrop-blur`가 `position: fixed`의 기준점을 가로채 모달이 헤더 안에 갇힘 (LoginDialog에서 실제 발생했던 버그).
- `<html>`에 `suppressHydrationWarning` 필수 — layout의 테마 스크립트가 하이드레이션 전에 `.dark`를 붙이므로.
- 입력란 커서: globals.css의 커스텀 I-빔 cursor 규칙은 사용자 환경에서 기본 I-빔이 안 보이는 문제 보정용 — 제거하지 말 것.
