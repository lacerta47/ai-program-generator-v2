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

테스트 프레임워크는 없음. 검증은 `tsc --noEmit` + build + 브라우저 확인(Chrome MCP 연결 시 직접 스크린샷 가능).

## 아키텍처

### AI 어댑터 경계 (핵심 설계)
앱은 `lib/ai/types.ts`의 계약(`GenerateInput` → `GeneratedCode {html, css, javascript}`)만 안다. **제공자 교체 지점은 `lib/ai/provider.ts` 단 한 곳.** `lib/ai/gemini.ts`가 JSON 스키마 모드, 응답 파싱, 503/429 재시도를 전부 캡슐화한다. 모델은 생성·수정 모두 `gemini-2.5-flash`(기본) → `gemini-2.5-flash-lite`(폴백) — 2026-04부터 2.5-pro가 무료 티어에서 제외됐기 때문이며, pro로 바꾸려면 결제 필요. AI 호출은 서버 전용 `app/api/generate/route.ts`에서만 (키 노출 방지; 인증·레이트리밋은 TODO로 표시됨).

### Firebase 계층
- `lib/firebase/client.ts` — 클라이언트 SDK 단일 초기화 (`NEXT_PUBLIC_*` env).
- `lib/firebase/posts.ts` — 커서 기반 페이지네이션. 쿼리는 `firestore.indexes.json`의 복합 인덱스(`categoryId asc, createdAt desc`)와 일치해야 함. 쿼리 모양을 바꾸면 인덱스도 갱신·배포할 것.
- `lib/firebase/categories.ts` — 카테고리 CRUD. Firestore에는 컬렉션 cascade 삭제가 없어 `deleteCategoryWithPosts`가 450건 단위 배치로 하위 게시물을 지움.
- **권한 모델** (`firestore.rules`): posts는 공개 읽기 / 로그인 사용자가 `ownerUid == 본인`으로 생성 / 본인 또는 admin만 수정·삭제. categories는 admin 전용. **admin = Auth custom claim** (`scripts/set-admin.mjs`로 부여, DB에 저장 안 함). 클라이언트의 `useAuth().isAdmin`은 UI 노출용일 뿐, 실제 방어선은 rules.
- 로그인은 **게시판 업로드/수정/삭제에만** 요구. 생성·열람은 비로그인 허용 (의도된 정책).
- `serviceAccountKey.json`(루트, gitignored) — Admin SDK용. `.env.local` 키 목록은 `.env.example` 참조.

### UI 시스템
- **모든 화면은 `components/ui/` 프리미티브만 사용** (Button/Card/Field/Chip/LoadingDots/FloatingShapes). 새 화면에 일회성 스타일을 흩뿌리지 말 것.
- 디자인 토큰은 `app/globals.css`에 OKLCH CSS 변수 + Tailwind v4 `@theme inline` (별도 tailwind.config 없음). 라이트/다크는 `.dark` 클래스 기반(`@custom-variant`).
- 폰트: Jua(제목, `--font-display`) + Gowun Dodum(본문 17px) — `next/font/google`로 로드.
- 모션 유틸(`press`, `lift`, `anim-pop-in`, `stagger`, `hover-wiggle` 등)은 globals.css에 정의, 전부 `prefers-reduced-motion` 가드 적용. 새 애니메이션도 이 가드를 지킬 것.
- `components/fx/` — reactbits.dev에서 가져와 손질한 효과들(Particles=ogl 기반, BorderGlow). WebGL 컴포넌트는 `next/dynamic(ssr:false)`으로만 로드해 초기 번들에서 제외.
- 마이크로카피는 저학년 친화 한국어("~해요" 체, 쉬운 어휘). 이모지 장식·외부 마스코트 에셋은 쓰지 않기로 확정 — 생동감은 CSS 모션으로. 유일한 예외는 `components/ui/BuilderBot.tsx`(생성 로딩 화면용, 순수 CSS로 그린 오리지널 로봇).

### 보안 장치 (2026-06-11 추가 — 무력화 금지)
- **`/api/generate`는 로그인 필수**: Firebase ID 토큰(Bearer) 검증 + 계정당 일일 한도(기본 30회, `GEN_DAILY_LIMIT` env, admin claim은 무제한). 카운터는 Admin SDK 전용 `usage` 컬렉션(클라이언트 규칙 없음=접근 불가), 날짜 키는 KST 기준.
- **미리보기 프로세스 격리**: 생성 코드는 srcDoc이 아니라 `POST /api/preview`(Firestore `previews` 컬렉션, TTL 10분) → **교차 사이트 URL**(localhost↔127.0.0.1 스왑)로 iframe 로드. 무한루프 코드가 탭을 못 얼리게 하는 장치이므로 srcDoc으로 되돌리지 말 것. 배포 시엔 `NEXT_PUBLIC_PREVIEW_ORIGIN`으로 별도 미리보기 도메인 지정.
- **firestore.rules**: 게시물 update는 title만 변경 가능(diff 검사로 ownerUid/code 변조 차단), create는 필드 화이트리스트+크기 한도(code 각 150k자). 쿼리·스키마 바꾸면 규칙도 함께.

### 함정 (이미 한 번씩 밟은 것들)
- **모달은 반드시 `createPortal(…, document.body)`** — 헤더의 `backdrop-blur`가 `position: fixed`의 기준점을 가로채 모달이 헤더 안에 갇힘 (LoginDialog에서 실제 발생했던 버그).
- `<html>`에 `suppressHydrationWarning` 필수 — layout의 테마 스크립트가 하이드레이션 전에 `.dark`를 붙이므로.
- 입력란 커서: globals.css의 커스텀 I-빔 cursor 규칙은 사용자 환경에서 기본 I-빔이 안 보이는 문제 보정용 — 제거하지 말 것.
