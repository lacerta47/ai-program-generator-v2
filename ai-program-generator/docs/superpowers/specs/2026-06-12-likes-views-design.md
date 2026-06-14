# 좋아요 · 조회수 · Fork 카운트 설계

작성일: 2026-06-12

## 배경 / 목표
게시판 작품에 **좋아요(♥)**, **조회수(👁=본 사람 수)**, **이어 만든 횟수(fork count)**를 더한다. 저학년에게 하트는 강한 동기부여이고, 셋 다 인기 신호다.

**미래지향 원칙(핵심):** 추후 게시판 리뉴얼에서 **정렬(인기순 등)**과 분류탭이 들어온다. Firestore는 집계(`count()`)로 `orderBy`를 못 하므로, 카운트는 반드시 **게시물 문서의 비정규화 필드**여야 정렬 가능하다. 그래서 likeCount/viewCount/forkCount를 지금 필드로 깐다(정렬 UI·인덱스는 리뉴얼 때).

## 결정 사항(확정)
- 카운트는 게시물에 비정규화 필드(`likeCount`/`viewCount`/`forkCount`).
- 좋아요: 인터랙티브(미리보기 하트 토글), 자기 글도 가능, 로그인 필수.
- 조회수 = **본 사람 수(중복 제외, 로그인 사용자만)** — 익명 쓰기 미허용(Spark 쓰기쿼터·조작 방지). 비로그인 열람은 미집계(수용).
- 표시: 미리보기에 `♥ · 🌿(fork) · 👁` 통계줄(인터랙티브는 ♥만), 목록엔 `♥ 개수`만(추가 읽기 0). 목록 fork/조회·인터랙션은 리뉴얼 때.
- 아이콘은 이모지가 아니라 lucide(`Heart`, `GitFork`, `Eye`) — 프로젝트 규약.

## 데이터 모델 (`lib/firebase/types.ts`)
`Post`에 옵셔널 추가(구버전 글엔 없음 → 0으로 취급):
- `likeCount?: number`, `viewCount?: number`, `forkCount?: number`

서브컬렉션(존재 = 했음, 중복 방지·"내가 했나" 판정):
- `posts/{postId}/likes/{uid}` = `{ createdAt: number }`
- `posts/{postId}/views/{uid}` = `{ createdAt: number }`

## 데이터 계층 (엔티티별 분리 유지)
- `lib/firebase/likes.ts`(신규):
  - `isLiked(postId, uid): Promise<boolean>` — `getDoc(likes/{uid})`
  - `toggleLike(postId, uid, liked): Promise<void>` — `writeBatch`로 원자적:
    - liked=false → `set(likes/{uid}, {createdAt})` + `update(post, {likeCount: increment(1)})`
    - liked=true → `delete(likes/{uid})` + `update(post, {likeCount: increment(-1)})`
- `lib/firebase/views.ts`(신규):
  - `recordView(postId, uid): Promise<void>` — 트랜잭션: view doc 없으면 `set(views/{uid}, {createdAt})` + `update(post, {viewCount: increment(1)})`. 있으면 no-op(멱등).
- `lib/firebase/posts.ts`: `incrementForkCount(postId): Promise<void>` — `update(post, {forkCount: increment(1)})`

## Firestore 규칙 (+배포)
likes·views 서브컬렉션:
```
match /posts/{postId}/likes/{uid} {
  allow read: if true;
  allow create: if isSignedIn() && uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['createdAt'])
    && request.resource.data.createdAt is number;
  allow update: if false;
  allow delete: if isOwner(uid) || isAdmin();
}
match /posts/{postId}/views/{uid} {
  allow read: if true;
  allow create: if isSignedIn() && uid == request.auth.uid
    && request.resource.data.keys().hasOnly(['createdAt'])
    && request.resource.data.createdAt is number;
  allow update: if false;
  allow delete: if isAdmin();
}
```
`posts` update에 카운트 분기 OR 추가(기존 소유자 콘텐츠 편집은 그대로 유지):
```
allow update: if
  ( /* (a) 기존: 본인/관리자 콘텐츠 편집 */ )
  || ( isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeCount'])
       && request.resource.data.likeCount is number
       && ( request.resource.data.likeCount == resource.data.get('likeCount', 0) + 1
         || request.resource.data.likeCount == resource.data.get('likeCount', 0) - 1 ) )
  || ( isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewCount'])
       && request.resource.data.viewCount == resource.data.get('viewCount', 0) + 1 )
  || ( isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['forkCount'])
       && request.resource.data.forkCount == resource.data.get('forkCount', 0) + 1 );
```
`validPost`(create)는 변경 불필요 — 새 글/포크는 카운트를 안 넣고 시작(첫 증가 때 필드가 생김).

*한계(수용):* Functions 없는 Spark라 규칙만으론 카운트 조작(반복 +1)을 100% 못 막음. 저학년 앱이라 실질 위험 0.

## UI
- `PostPreview.tsx`:
  - 통계줄(제목/작성자 아래, 출처칩 근처): `♥ likeCount`(토글 버튼 — 내가 누른 건 채워진 하트+색) · `GitFork forkCount` · `Eye viewCount`(표시만).
  - 작품 선택 시: 로그인 상태면 `recordView(postId, uid)`(멱등) + `isLiked(postId, uid)`로 하트 상태 세팅.
  - 하트 클릭: 비로그인 → `onNeedLogin()`(BoardView 로그인창). 로그인 → **낙관적 토글**(하트·카운트 즉시 반영) 후 `toggleLike()`; 실패 시 롤백 + 토스트.
- `PostList.tsx`: 항목 메타에 `♥ likeCount`(표시만, 0이면 생략). 추가 읽기 없음.
- `BoardView.tsx`: PostPreview에 `currentUserUid` + `onNeedLogin`(loginOpen 재사용) 전달. 좋아요 토글 시 `onLikeChanged(postId, delta)`로 `selectedPost`·`posts[]`의 likeCount 동기화(목록 즉시 반영).
- `UploadDialog.tsx`: fork 저장(`createPost` with `forkedFrom`) 성공 후 `incrementForkCount(forkedFrom)`(best-effort, 실패 무시).

## 범위 밖 (미래 리뉴얼)
- 인기순/조회순 **정렬 UI** + 복합 인덱스(`categoryId asc, likeCount desc` 등) — 필드는 지금 깔되 정렬·인덱스는 리뉴얼 때
- 목록의 fork/조회 표시 + 목록 좋아요 인터랙션

## 영향 파일
- `lib/firebase/types.ts` — 카운트 3필드
- `lib/firebase/likes.ts`(신규) · `lib/firebase/views.ts`(신규)
- `lib/firebase/posts.ts` — incrementForkCount
- `firestore.rules`(+배포) — likes/views 서브컬렉션 + posts update 카운트 분기
- `components/board/PostPreview.tsx` — 통계줄 + 하트 토글 + recordView
- `components/board/BoardView.tsx` — currentUserUid/onNeedLogin/onLikeChanged 연결
- `components/board/PostList.tsx` — 목록 ♥ 개수
- `components/board/UploadDialog.tsx` — fork 저장 후 forkCount +1

## 검증 기준 (완료 정의)
1. 미리보기 통계줄에 ♥/fork/조회 표시. 로그인 후 하트 클릭 → 채워지고 개수 +1(다시 누르면 -1). 비로그인 → 로그인창.
2. 자기 글도 좋아요 가능.
3. 작품을 처음 열면 조회수 +1(같은 사용자가 다시 열면 그대로).
4. 남의 작품을 이어 만들면 원본 fork 카운트 +1.
5. 목록에 ♥ 개수 표시(추가 읽기 없음), 좋아요 토글 시 목록 개수도 동기화.
6. 구버전(카운트 없는) 글도 0으로 정상 표시·동작.
7. `tsc` + 프로덕션 빌드 통과, 규칙 배포.
