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
- 인증: **생성·게시판 업로드/수정/삭제는 로그인 필요** (공개 게시물은 로그인 없이 열람 가능)
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

## 배포 전 점검

배포할 커밋에서 `npm run test:api`와 `npm run test:rules`가 통과했는지 CI에서 확인한다. 로컬에서 규칙 테스트를 실행할 때는 Java 21과 비어 있는 Firestore 에뮬레이터 포트(8080)가 필요하다.

같은 커밋의 스테이징에서 서로 다른 반의 테스트 학생 계정, 해당 반의 테스트 교사 계정, 이메일 인증을 마친 일반 회원 테스트 계정과 가상 데이터로 확인한다.

| 점검 | 방법 | 통과 기준 |
| --- | --- | --- |
| 학급별 접근 | A반 학생으로 A반 전용 게시물과 B반 전용 게시물의 직접 링크를 각각 연다. | A반 게시물은 열리고 B반 게시물의 본문·미리보기는 열리지 않는다. |
| 생성 한도 복구 | 학생과 일반 회원은 각 계정으로 `GET /api/me/usage`의 `used`를 조회한다. 교사는 `GET /api/teacher/me`에서 학급의 `usedTotal`을 조회한다. 테스트 인스턴스에서 한도 예약 후 공급사 호출이 실패하도록 모의하고, 오류 응답이 끝난 뒤 세 값을 다시 조회한다. | 예약과 공급사 호출이 시작됐음을 테스트 로그에서 확인하고, 학생·학급·일반 회원 사용량이 각각 실패 전 값으로 돌아온다. 정상 설정에서 생성 완료 시 요청 비용만큼 차감된다. 예약 전에 거절된 요청은 미차감 검사로 따로 기록한다. |
| 생성물 미리보기 격리 | `POST /api/preview`로 점검용 코드를 미리보기한다. 개발자 도구에서 iframe 주소·속성과 문서 응답 CSP를 확인하고, 프레임 안의 코드로 `localStorage`·`sessionStorage` 접근과 점검용 별도 오리진으로의 `fetch`를 시도한다. | 별도 HTTPS 오리진의 미리보기가 앱에서 로드된다. iframe의 `sandbox`는 `allow-scripts`이고 응답 CSP의 `frame-ancestors`는 앱 오리진을 허용한다. 저장소 접근이 거절되며 `connect-src 'none'`에 따라 `fetch`가 차단되어 목적지에 요청이 도착하지 않는다. iframe 자체의 문서 이동은 별도로 관찰해 기록한다. |
| 학생 정보 전송 및 사진 동의 | 가상 학생의 사진 없는 요청 본문을 확인한다. 사진 동의 기록이 없는 테스트 계정의 인증으로 유효한 가상 이미지가 포함된 `POST /api/generate`를 보내 서버 응답을 확인한다. 동의 후 같은 사진을 첨부한 요청도 확인한다. | 실명·연락처 같은 계정 정보가 본문에 자동 추가되지 않는다. 미동의 사진 요청은 동의 안내와 함께 HTTP `403`으로 거절되고 한도 차감과 공급사 호출이 발생하지 않는다. 동의한 뒤 명시적으로 첨부한 경우에 사진 생성이 진행된다. |

배포 기록에 커밋, 확인 환경, 항목별 결과(통과·실패·미확인), CI나 재현 증거 링크를 남긴다. 실패나 미확인이 있으면 배포를 보류하고 해당 항목을 다시 점검한다.

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
  board/    게시판 UI (CategoryTree, PostList, PostPreview, UploadDialog)
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
