# AI 프로그램 생성기

계획서를 입력하면 Gemini가 HTML/CSS/JS 웹 프로그램을 생성하고, 미리보기·수정·ZIP 다운로드·공유 게시판을 제공하는 앱.

Google AI Studio 목업을 **Next.js + Firebase**로 정식 재구축한 버전.

## 기술 스택
- **Next.js 15 (App Router) + TypeScript + Tailwind v4**
- **AI**: Gemini (`@google/genai`) — 서버 전용 `app/api/generate`에서만 호출. 제공자 교체는 `lib/ai/provider.ts` 한 곳에서.
- **Firebase**: Authentication(Google·이메일), Firestore(게시판), Admin SDK(관리자 권한)

## 주요 기능
- 계획서 기반 코드 생성 / 수정 요청 / 실시간 미리보기 / 코드 보기 / ZIP 다운로드
- 공유 게시판: 카테고리, 게시물 업로드·목록(무한 스크롤)·미리보기·공유 링크
- 인증: **게시판 업로드/수정/삭제만 로그인 필요** (생성·열람은 자유)
- 권한: 게시물은 작성자 본인 또는 관리자만 수정·삭제, 카테고리는 관리자만 관리

## 로컬 실행
1. 의존성 설치
   ```bash
   npm install
   ```
2. 환경변수 — `.env.example`을 참고해 `.env.local` 작성
   - `GEMINI_API_KEY` — [AI Studio](https://aistudio.google.com/apikey)에서 발급 (서버 전용)
   - `NEXT_PUBLIC_FIREBASE_*` — Firebase 콘솔 웹앱 설정값 (공개용)
   - 루트에 `serviceAccountKey.json` — Firebase 서비스계정 키 (서버 전용, git 제외)
3. 키 연결 점검(선택)
   ```bash
   npm run check-key
   ```
4. 개발 서버
   ```bash
   npm run dev    # http://localhost:3000
   ```

## 관리자 지정
앱에서 본인 계정으로 한 번 로그인한 뒤:
```bash
node scripts/set-admin.mjs your@email.com
```
실행 후 해당 계정에서 **로그아웃 → 재로그인**하면 관리자 UI(카테고리 관리)가 보인다.

## Firebase 설정 배포
보안 규칙·인덱스는 코드로 관리한다.
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 디렉터리 개요
```
app/
  page.tsx              생성기 화면
  board/page.tsx        게시판 화면
  api/generate/route.ts AI 호출 (서버 전용)
components/
  creator/  생성기 UI
  board/    게시판 UI (CategoryBar, PostList, PostPreview, UploadDialog)
  auth/     AuthProvider, LoginDialog, AuthButton
  common/   Header, ThemeProvider, ThemeToggle
lib/
  ai/       AI 어댑터 (types, provider, gemini, prompts)  ← 제공자 교체 지점
  firebase/ client, types, categories, posts
  program.ts, examples.ts, client/
firestore.rules, firestore.indexes.json
scripts/set-admin.mjs
```

## 보안 메모
- AI 키·서비스계정 키는 서버 전용 (`.env.local`/`serviceAccountKey.json`, 모두 gitignore).
- `NEXT_PUBLIC_FIREBASE_*`는 브라우저 노출이 정상이며, 실제 접근 제어는 `firestore.rules`가 담당.
