# Fork(이어서 만들기) 기능 설계

작성일: 2026-06-12

## 배경 / 목표
게시판의 남의 작품을 보고 "나도 이어서 만들기"를 누르면, 그 작품의 계획서+코드가 생성기에 채워진 채 열리고, 수정해서 **내 새 작품**으로 올릴 수 있게 한다. 스크래치의 리믹스처럼, 이 앱을 "AI 리믹스 놀이터"로 키우는 핵심 기능. 타깃은 초등 저학년.

핵심 원칙: **새 페이지·새 데이터흐름을 만들지 않고, 기존 편집(`?edit=`) 로딩 + 업로드 흐름을 재활용**한다. `?edit=`이 "덮어쓰기"라면 `?fork=`는 "새 글로 저장"으로만 분기.

## 결정된 요구사항
- 출처 표기: **함** (원본 id + 작성자명 스냅샷)
- 로그인: 실제 fork(저장)는 **로그인 필수**. 단순 불러오기/미리보기는 AI 토큰을 쓰지 않으므로 비로그인도 허용(생성·열람 개방 정책과 일관, 저장 단계에서 로그인 강제).
- 버튼 위치: PostPreview 액션 줄에 **아이콘만 + hover 툴팁**(공유·저장 아이콘과 통일).
- 아이콘 노출 규칙:
  - 공유 / 저장: 항상
  - 고치기(연필): 본인 또는 관리자(`canEdit`)
  - 이어서 만들기(갈래 아이콘): **남의 글일 때**(`post.ownerUid !== user?.uid`; 비로그인 포함) → 본인 글엔 고치기만 뜨고 fork는 안 뜸(self-fork 자연 비노출)

## 설계 상세

### 1. 데이터 모델 (`lib/firebase/types.ts`)
`Post`에 옵셔널 두 필드 추가:
- `forkedFrom?: string` — 원본 게시물 id
- `forkedFromAuthor?: string` — 원본 작성자명 스냅샷(원본이 지워져도 출처 표시 유지)

`NewPost = Omit<Post,'id'>`이므로 자동 반영. 비-fork 글은 두 필드를 **아예 포함하지 않는다**(Firestore가 `undefined` 값을 거부하므로, fork일 때만 조건부로 넣음).

### 2. Firestore 규칙 (`firestore.rules`)
`validPost`의 `hasOnly([...])` 화이트리스트에 `forkedFrom`, `forkedFromAuthor` 추가하고, 존재할 때만 검증:
- `(!('forkedFrom' in d) || (d.forkedFrom is string && d.forkedFrom.size() <= 128))`
- `(!('forkedFromAuthor' in d) || (d.forkedFromAuthor is string && d.forkedFromAuthor.size() <= 20))`

수정(update) 규칙은 `affectedKeys().hasOnly([...])`로 변경 필드만 검사하므로, 편집 시 바뀌지 않는 `forkedFrom*`은 그대로 보존된다(추가 작업 불필요).

### 3. 진입점 — 액션 아이콘 줄 (`components/board/PostPreview.tsx`)
- 모든 액션을 **아이콘 버튼 + `title`(hover 툴팁) + `aria-label`**로 통일(기존 PostList의 `Mini` 패턴 재사용).
- 이어서 만들기 아이콘: lucide `GitFork`(추후 조절 가능), 툴팁 "이어서 만들기".
- 노출: `user?.uid !== post.ownerUid` 일 때.
- onClick: 비로그인 → 로그인 다이얼로그 / 로그인 → `router.push('/?fork=' + post.id)`.

### 4. Creator fork 로딩 (`components/creator/Creator.tsx`)
- `?fork=postId` 감지(기존 `?edit=` 효과와 유사 구조, 인증 대기 후 1회 로드, ref로 중복 방지).
- `getPost(source)` → `setPlan(p.plan ?? EMPTY_PLAN)`, `setCode(p.code)`, `genPrompt`는 `buildGeneratePrompt(plan)`로 새로 시작(원저자 수정이력 미상속).
- `forkSource = { id, author, categoryId }` state에 보관(업로드 시 첨부·카테고리 기본값용). **편집 배너 없음** — 일반 "만들기"처럼 동작(`editing`은 설정하지 않음 → 저장 시 새 글).
- 비로그인으로 직접 진입해도 로딩 자체는 허용(토큰 0). 저장은 기존 업로드 흐름이 로그인 강제.

### 5. 업로드 (`components/board/UploadDialog.tsx`)
- props에 `forkedFrom?`, `forkedFromAuthor?` 추가받아 `createPost`에 **조건부 포함**.
- 카테고리 기본값 = `forkSource.categoryId`(원본 카테고리)가 있으면 그것, 없으면 기존대로 첫 카테고리.

### 6. 출처 표시 (이어 만든 글)
- `forkedFrom`이 있는 글의 PostPreview·PostList에 **작은 갈래 아이콘 칩** 표시. 평소엔 컴팩트("이어 만듦"), hover/`title`로 "○○의 작품에서 이어 만들었어요"(`forkedFromAuthor` 사용).
- 원본이 삭제/이름변경돼도 스냅샷으로 표시.

## 범위 밖 / 보류 (v2)
- 원본에 "N명이 이어 만듦" **fork 카운트** 표시 → 좋아요 기능과 함께 구현.
- fork의 fork: **직전 부모만** 표기(체인 추적 안 함).
- 모바일에서 hover 불가 대비 tap-to-show 툴팁 고도화(v1은 `title` + 칩 텍스트로 충분).

## 영향 받는 파일
- `lib/firebase/types.ts` — Post 필드 2개
- `firestore.rules` — validPost 화이트리스트+검증 (배포 필요)
- `components/board/PostPreview.tsx` — 액션 아이콘 줄(아이콘화 + fork 버튼 + 출처 칩)
- `components/board/PostList.tsx` — 목록 항목 출처 칩(컴팩트)
- `components/creator/Creator.tsx` — `?fork=` 로딩 + forkSource 보관 + 업로드 연동
- `components/board/UploadDialog.tsx` — forkedFrom props + 조건부 저장 + 카테고리 기본값

## 검증 기준 (완료 정의)
1. 남의 글 미리보기엔 이어서만들기 아이콘(툴팁), 본인 글엔 고치기 아이콘이 뜬다.
2. 비로그인으로 fork 클릭 → 로그인창. 로그인 후 클릭 → `/?fork=id`로 이동하고 계획서+코드가 채워진다.
3. fork를 올리면 **내 소유의 새 글**이 생기고 `forkedFrom`+`forkedFromAuthor`가 저장된다(원본은 불변).
4. 이어 만든 글에 출처 칩+툴팁이 보인다. 원본을 지워도 칩은 유지된다.
5. 이어 만든 글을 다시 편집해도 `forkedFrom*`이 보존된다.
6. `tsc --noEmit` + 프로덕션 빌드 통과, firestore.rules 배포.
