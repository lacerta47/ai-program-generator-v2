# 게시판 리뉴얼 — 교실 보드 비공개 + 공유링크 관람 PIN (설계 스펙)

- 상태: 설계(승인 대기) · 날짜: 2026-06-25
- 다음 단계: 승인 → `writing-plans`로 구현 플랜
- 후속 스펙: **사진 업로드(A+C)** — 이 스펙이 깔아주는 "교실 보드=사진 허용" 위에 올림(이 문서 범위 밖)

## 1. 배경 / 동기

사진 업로드 기능을 검토하다 도달한 결론: 7~10세 공개 게시판에 아이 사진을 올리는 건 위험. 그런데 현재 **모든 게시물이 외부 완전 공개**다 — `firestore.rules`의 `match /posts { allow read: if true }`. 교사 보드는 `categoryAllowed`로 **누가 쓰느냐(create)만** 막을 뿐 **읽기 경계가 아니다**. 즉 "교사 보드에만 올림"으로는 사진이 여전히 전 세계에 노출된다.

→ 교사 보드를 **그 반(교사+그 학생)만 읽는 교실 전용 공간**으로 바꾸고, 외부(부모 등)는 **공유 링크 + 반 공용 관람 PIN으로 그 작품 1개만 보기 전용** 열람하게 한다. 그러면 사진 작품은 교실 보드에만 허용해 안전하게 공유할 수 있다.

## 2. 현재 상태(코드 기준)

- `posts`: 클라 `createPost`로 생성, `allow read: if true`(완전 공개). 필드에 `categoryId` 보유.
- 교사 보드 = `categories` 문서에 `teacherUid` 필드([lib/server/teacherBoard.ts](../../lib/server/teacherBoard.ts)). 공개 보드는 `teacherUid` 없음/null.
- 학생 소속: `students/{uid}`에 `teacherUid`·`schoolCode`(=교사 loginId)·`hakbun`.
- 커스텀 클레임: `admin`/`teacher`/`student` 불리언. 발급은 `app/api/admin/teachers/route.ts`(교사)·`app/api/teacher/students/route.ts`(학생)에서 `setCustomUserClaims`. **현재 schoolCode/teacherUid는 클레임에 없음.**
- 미리보기 2경로: 즉석 코드 = `POST /api/preview`(로그인 토큰 필요 → previews 컬렉션 → 교차사이트 `GET /api/preview/[id]`). 게시물 = **공개 `GET /api/preview/post/[id]`**(posts가 공개읽기라 무인증으로 code 서빙). 둘 다 `sandbox allow-scripts` 교차사이트 iframe.
- 학생 로그인 = 학교+학번+**반 공용 로그인 PIN**(Firebase 비밀번호). 단일세션(협조적).

## 3. 범위

**In:** 교실 보드 비공개 읽기 모델, 멤버십 클레임+마이그레이션, 보드 브라우징 범위화, 미리보기 서빙 모델 변경, 공유링크+관람 PIN(보기 전용·서버검증·레이트리밋), 관람 PIN 설정 UI.
**Out:** 사진 업로드 자체(다음 스펙). 공개 보드 동작은 현행 유지. `/create`·생성 흐름 무관.

## 4. 설계

### 4.1 읽기 권한 모델 (firestore.rules)

`match /posts` 읽기를 카테고리 종류로 분기한다. **규칙은 목록 쿼리를 `get()`으로 거를 수 없으므로**(목록 인가 불가·비용), 멤버십을 **클레임**으로 들고 게시물에 보드 소유자를 **비정규화**한다.

- 각 post에 `boardTeacherUid` 필드 추가: 공개 보드면 `null`, 교실 보드면 그 카테고리의 `teacherUid`.
- 학생 클레임에 `classTeacherUid`(= `students/{uid}.teacherUid`) 추가. 교사는 자기 `uid`가 곧 교실 소유자.
- 읽기 규칙:
  ```
  allow read: if resource.data.boardTeacherUid == null            // 공개 보드 — 누구나(현행)
    || isAdmin()
    || resource.data.boardTeacherUid == request.auth.uid          // 그 교사 본인
    || resource.data.boardTeacherUid == request.auth.token.classTeacherUid;  // 그 반 학생
  ```
- ⚠️ **Firestore 규칙은 필터가 아니다** — 목록 쿼리는 규칙이 검사하는 필드(`boardTeacherUid`)로 **직접 필터해야** 인가된다. 따라서 **공개·교실 양쪽 브라우징 쿼리가 모두 바뀐다**: 공개 보드 = 기존 `categoryId` + `where('boardTeacherUid','==', null)`, 교실 보드 = `where('boardTeacherUid','==', 내classTeacherUid)`. 필터 없는 기존 `categoryId`-만 쿼리는 거부된다(공개 글 브라우징도 영향).
- **create 시 위조 차단**: `validPost`에 `boardTeacherUid` 추가하고, 규칙이 카테고리 실제값과 일치 검증 —
  `request.resource.data.boardTeacherUid == (categoryAllowed 대상 카테고리에 'teacherUid' 있으면 그 값, 없으면 null)`. (create는 이미 `categoryAllowed`에서 `get(categories/catId)` 하므로 그 값 재사용.)
- **인덱스**: 쿼리가 바뀌므로 `firestore.indexes.json` 갱신·배포 — 교실 보드 `boardTeacherUid asc, createdAt desc`, 공개 보드 `categoryId asc, boardTeacherUid asc, createdAt desc`(기존 `categoryId asc, createdAt desc` 대체).

*대안(기각)*: 문서별 `get(students/uid)` 읽기 규칙 — 목록 쿼리 인가 불가 + 문서당 읽기 비용. 클레임+비정규화가 list-safe.

### 4.2 멤버십 클레임 + 마이그레이션

- 발급 시: 학생 생성(`/api/teacher/students`)에서 `setCustomUserClaims(uid, { student:true, classTeacherUid: 교사uid })`. 교사는 자기 uid면 충분(별도 클레임 불필요)이나, 일관성 위해 교사에도 `classTeacherUid: 본인uid`를 넣어도 됨(선택).
- **백필(1회 Admin SDK 스크립트, 미커밋)**: 기존 모든 `students/{uid}`에 `classTeacherUid` 클레임 부여 + 기존 모든 `posts`에 `boardTeacherUid`(카테고리 teacherUid 조회해 채움). 공개 보드 글은 `null`.
- **재로그인 필요**: 클레임은 다음 토큰 갱신부터 반영 → 기존 학생/교사는 **재로그인 1회** 필요(또는 ~1h 토큰 자연 갱신). 안내 문구 제공.

### 4.3 브라우징 / 디스커버리 UX

- 비로그인·외부: 공개 보드만 노출. 교실 보드는 목록에서 숨김(또는 잠금 표시).
- 학생/교사: 공개 보드 + 자기 교실 보드. 카테고리 목록을 멤버십으로 필터.
- 교실 보드 진입 쿼리는 4.1의 `boardTeacherUid` 기준. 비회원이 교실 카테고리를 직접 쿼리하면 규칙이 거부 → 클라가 빈 상태/안내 처리(에러 토스트 아님).

### 4.4 미리보기 서빙 모델 변경

비공개화로 **공개 `GET /api/preview/post/[id]`가 교실 코드를 누출**하므로 분기:

- **공개 보드 글**: 기존 `GET /api/preview/post/[id]` 유지(공개).
- **교실 보드 글(로그인 멤버 열람)**: 멤버는 규칙상 client SDK로 post(code 포함)를 읽을 수 있다 → 그 code로 기존 **`POST /api/preview`**(로그인 토큰) 경로로 미리보기. 즉 교실 글은 "즉석 코드"처럼 취급. `FullscreenFrame`/보드가 글 종류(`boardTeacherUid` 유무)로 경로 선택.
- **공개 GET 라우트 가드**: `GET /api/preview/post/[id]`는 **`boardTeacherUid != null`이면 404/403**으로 거부(공개 글만 서빙).

### 4.5 공유 링크 + 관람 PIN (보기 전용)

- **관람 PIN**: 교실(=교사)마다 1개, **로그인 PIN과 별개**. 교사 콘솔에서 설정·회전. `teachers/{uid}.viewPinHash`에 **해시 저장**(평문 금지). 미설정이면 공유 비활성.
- **링크**: `/share/[postId]` (PIN 미포함). 공유 버튼은 교실 보드 글에만 노출.
- **흐름**:
  1. `/share/[postId]` 페이지 → 관람 PIN 입력 폼(저학년 아닌 부모 대상 톤).
  2. `POST /api/share/[postId]` `{ pin }` → 서버(Admin SDK):
     - post 조회 → `boardTeacherUid` 없으면(공개 글) 공유 불필요/거부.
     - `teachers/{boardTeacherUid}.viewPinHash`와 대조.
     - **레이트리밋**: post별/IP별 PIN 시도 제한(예: 분당 N회, 초과 시 429). 4~6자리 무차별 차단.
     - 통과 → Admin SDK로 **단기 previews 문서 생성**(기존 TTL 메커니즘 재사용) → 교차사이트 `GET /api/preview/[id]` URL + 제목 반환. **그 작품 1개만**.
  3. 클라: 받은 미리보기 URL을 격리 iframe으로 렌더(보기 전용). 좋아요·포크·신고·수정·다운로드 UI 전부 비노출.
- 관람 PIN은 **반 공용**이라 보드 전체가 아니라 **링크가 가리키는 작품만** 연다(다른 애 작품 브라우징 불가).

## 5. 데이터 모델 변경

| 위치 | 변경 |
|---|---|
| `posts/{id}` | `boardTeacherUid: string\|null` 신규(비정규화, create 시 규칙 검증) |
| custom claims (student) | `classTeacherUid: string` 신규 |
| `teachers/{uid}` | `viewPinHash: string` 신규(관람 PIN 해시) |
| `firestore.indexes.json` | 복합 인덱스 갱신: `boardTeacherUid+createdAt`(교실), `categoryId+boardTeacherUid+createdAt`(공개, 기존 대체) |

## 6. 에러 / 엣지

- 클레임 없는 구 계정: 교실 보드 안 보임 → "다시 로그인하면 우리 반 게시판이 보여요" 안내.
- 관람 PIN 미설정 교실: 공유 버튼 비활성 + 교사에게 "관람 PIN을 정하면 공유할 수 있어요".
- PIN 오답/레이트리밋 초과: 친절 메시지, 시도 제한.
- 삭제/없는 postId 공유 링크: "작품을 찾을 수 없어요".
- 공개 글에 공유 링크 접근: 공개 글은 그냥 일반 URL로 보이므로 share 경로 불필요(거부 또는 일반 보기로).

## 7. 보안 고려

- 관람 PIN은 **해시 저장**, 응답에 평문 노출 금지. 교사 콘솔 설정 시에만 입력.
- 레이트리밋으로 짧은 PIN 무차별 방어. 공유 미리보기는 **단기 previews 문서**로 서빙(영구 공개 URL 아님).
- `boardTeacherUid` create 위조는 규칙이 카테고리 실제값과 대조해 차단.
- 공개 미리보기 GET은 교실 글 거부(누출 차단).
- 클레임 위조 불가(서버 발급). 관람 PIN ≠ 로그인 PIN이라 유출돼도 계정 탈취 불가(보기 전용).

## 8. 테스트 (self-test, 미커밋)

- **client-SDK(규칙 강제 검증)**: 비회원이 교실 글 read 거부 / 그 반 학생 허용 / 다른 반 학생 거부 / 공개 글 누구나 / `boardTeacherUid` 위조 create 거부.
- **서버(공유 PIN)**: 정답 PIN→미리보기 URL 반환, 오답→거부, 레이트리밋 초과→429, 관람 PIN 미설정→비활성, 공개 글 share→거부.
- **마이그레이션**: 백필 후 클레임 부여된 학생 쿼리 동작, 기존 글 `boardTeacherUid` 채워짐.
- 회귀: 공개 보드 브라우징·페이지네이션·기존 미리보기 정상.

## 9. 마이그레이션 순서(권장 구현 순서)

1. 데이터 모델·규칙·인덱스: `boardTeacherUid` 추가(create 검증), 읽기 규칙 분기, 인덱스 배포.
2. 클레임 발급 변경 + 백필 스크립트(기존 학생 클레임·기존 글 boardTeacherUid) + 재로그인 안내.
3. 브라우징 범위화(공개/교실 분리) + 미리보기 경로 분기(공개 GET 가드 + 교실은 POST 경로).
4. 공유: `teachers.viewPinHash` + 교사 콘솔 관람 PIN 설정 UI + `/share/[postId]` 페이지 + `POST /api/share/[postId]`(검증·레이트리밋·단기 프리뷰) + 보기 전용 렌더.
5. self-test 전부 통과 + `firebase deploy --only firestore:rules,firestore:indexes`.

> 1~3(비공개화 토대)과 4(공유)는 분리 배포 가능. 4 없이 1~3만으로도 "교실 보드 비공개"는 완결.

## 10. 열린 질문 / 수용 잔여

- 관람 PIN 자릿수·레이트리밋 임계값: 구현 시 확정(기본 6자리·분당 5회 제안).
- 교사 클레임에 `classTeacherUid` 중복 부여 여부(자기 uid로 충분): 구현 시 단순화 결정.
- 관람 PIN은 반 공용이라 "링크를 가진 작품"만 연다 — 보드 전체 열람 게이트는 비채택(프라이버시).
- 부모가 교실 보드를 "둘러보는" 경험은 비제공(작품별 링크 공유만) — 의도된 제약.
