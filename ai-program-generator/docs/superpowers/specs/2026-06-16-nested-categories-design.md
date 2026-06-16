# 중첩 카테고리 + 접기/펼치기 게시판 설계 (게시판 보수 A)

작성일: 2026-06-16

## 배경 / 목표
게시판 카테고리가 **평면 목록**이라 학년·학교·반 같은 계층을 표현 못 한다. 이를 **3단 중첩 트리**(예: `2026 > 춘고 > 1반`)로 바꾸고, 게시판 좌측을 **접기/펼치기 트리 내비게이션**으로 만든다. 동시에 **게시판 관리(카테고리 CRUD) 기능을 관리자 페이지로 이전**해 게시판 화면은 읽기 전용으로 단순화한다.

타깃은 교실(반 단위 운영, 카테고리 수십 개 규모). Spark 플랜·Functions 없음. 데이터·미리보기 파이프라인은 불변, 카테고리 모델·게시판/관리 UI·규칙만 변경.

## 결정 사항(확정)
- **잎새에만 작품**: 하위가 있는 노드는 '폴더'(작품 목록 없음), 하위가 없는 노드는 '잎새'(업로드·목록 대상). 부모 노드 클릭은 펼치기/접기 전용. → 게시물 쿼리(`categoryId` 단일)와 인덱스 **불변**.
- **깊이 3단 고정**: root(1단) > 2단 > 3단. 3단 노드엔 하위 추가 불가.
- **마이그레이션 제로**: `parentId` 옵셔널 → 기존 평면 카테고리는 전부 root로 그대로. 기존 게시물 `categoryId` 불변.
- **관리 기능은 관리자 페이지로 이전**: 게시판 좌측은 읽기 전용 트리. 카테고리 CRUD는 신규 `/admin/categories`.
- **v1 편집 범위**: 하위 폴더 추가 · 이름 변경 · 형제 순서(↑↓) · 삭제(하위+작품 일괄). **reparent(다른 부모로 이동)는 제외**(추후 admin 계층 분리 때).
- **가드는 클라이언트**(쓰기는 admin 전용이라 신뢰선 OK): 깊이 3단, 잎새-only 업로드, "글 있는 폴더 아래 하위 추가 금지"(작품 미아 방지).

## 데이터 모델

```ts
// lib/firebase/types.ts
export interface Category {
  id: string;
  name: string;
  order: number;       // 같은 부모(형제) 안에서의 정렬 키
  createdAt: number;
  parentId?: string | null;  // 신규. 없거나 null = 최상위(root)
}
```

- **인접 리스트**(parentId) 방식. 트리는 클라이언트에서 조립.
- `subscribeCategories`는 지금처럼 **전 카테고리 1회 구독**(order asc) → 메모리에서 `parentId`로 트리 빌드. 카테고리 수가 교실 규모라 전체 구독이 효율적.
- `order`는 **형제 그룹 내** 정렬에만 의미. (글로벌 유일성 불필요 — 부모별로 0,1,2…)

## 순수 트리 유틸 (신규 `lib/board/categoryTree.ts`)

데이터·UI에서 공용으로 쓰는 순수 함수(테스트 가능, Firebase 의존 없음):

```ts
export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;        // root=1
}

// 평면 배열 → 루트 노드 배열(각 노드에 children/depth 부여, 형제는 order asc)
export function buildTree(categories: Category[]): CategoryNode[];

// 특정 노드와 그 모든 후손의 id(자기 자신 포함)
export function descendantIds(id: string, categories: Category[]): string[];

// 잎새(자식 없는 노드)만, 경로 라벨과 함께 — 업로드 선택기·표시용
export function leafPaths(categories: Category[]): { id: string; path: string; name: string }[];
// path 예: "2026 / 춘고 / 1반"

// 어떤 노드의 깊이(root=1). 하위 추가 가능 여부 판정용
export function depthOf(id: string, categories: Category[]): number;

// 특정 노드가 직속 자식을 갖는지(폴더 여부)
export function hasChildren(id: string, categories: Category[]): boolean;
```

순환 참조 방지: `buildTree`/`descendantIds`는 방문 집합(`Set`)으로 사이클을 끊어 무한 루프를 막는다(데이터 손상 시 안전).

## 데이터 계층 변경 (`lib/firebase/categories.ts`)

- `addCategory(name, order, parentId?: string | null)` — 시그니처에 `parentId` 추가. 문서에 `parentId`(있을 때만) 기록.
- `renameCategory`, `swapCategoryOrder` — 변경 없음. (순서 이동은 **형제 중 위/아래** 노드와 order를 맞바꿈 — 호출부가 형제 배열에서 인접 노드를 계산해 전달.)
- **신규** `deleteCategoryTree(id, all: Category[])` — `descendantIds(id, all)`로 자기+후손 id 수집 → 각 id의 게시물을 `where('categoryId','==',id)` 조회 후 450건 배치 삭제 → 카테고리 문서들 배치 삭제. (기존 `deleteCategoryWithPosts`는 이 함수로 대체/흡수.)

## 컴포넌트 변경

### 게시판 트리 내비 — 신규 `components/board/CategoryTree.tsx` (CategoryBar 대체)
- Props: `{ categories: Category[]; selectedId: string | null; onSelect: (id: string) => void }`. **admin 컨트롤 없음**(읽기 전용).
- `buildTree`로 렌더. 들여쓰기(depth) + 폴더 노드 ▸/▾ 토글, 잎새 노드는 선택 가능한 행/칩.
- 펼침 상태: 로컬 `useState<Set<string>>`. 선택/딥링크된 잎새의 **조상 자동 펼침**.
- 폴더 클릭 = 펼치기/접기. 잎새 클릭 = `onSelect(id)`.
- 빈 상태: 카테고리 없음 / 잎새 없음 안내.
- `components/board/CategoryBar.tsx`는 제거(트리로 대체).

### BoardView (`components/board/BoardView.tsx`)
- `CategoryBar` → `CategoryTree`로 교체. `isAdmin` prop 전달 제거.
- 자동 선택: 첫 카테고리 → **첫 잎새**(`leafPaths()[0]`)로 변경.
- 삭제된 카테고리로의 폴백(이미 있는 로직)도 "유효 잎새 없으면 선택 해제"로 보정.
- 딥링크 `?category=`가 폴더를 가리키면 첫 잎새로 폴백(또는 그 폴더 펼침). `?post=` 흐름은 글의 `categoryId`(잎새)로 그대로 동작.

### Admin 트리 편집기 — 신규 `app/admin/categories/page.tsx` + `components/admin/CategoryManager.tsx`
- `AdminGate`로 감싸기(기존 admin 페이지 패턴 동일). `Header` 포함.
- 전체 카테고리 구독 → `buildTree` 렌더. 노드별:
  - **[하위 추가]**: `depthOf(node) < 3` **그리고** 해당 노드에 직속 작품이 없을 때만 노출. 클릭 → 이름 입력 → `addCategory(name, 자식수, node.id)`.
  - **[이름변경]**: `renameCategory`.
  - **[↑]/[↓]**: 형제 배열에서 인접 노드와 `swapCategoryOrder`.
  - **[삭제]**: confirm(하위·작품 모두 지워짐 경고) → `deleteCategoryTree`.
  - 최상위에 **[최상위 폴더 추가]**: `addCategory(name, 루트수, null)`.
- "글 있는 노드 아래 하위 추가 금지" 판정: 추가 시도 시 `where('categoryId','==',node.id) limit(1)` 1건이라도 있으면 막고 안내.
- admin 허브(`app/admin/page.tsx`)에 **"게시판 관리"** 카드 추가(`FolderTree` 아이콘, href `/admin/categories`).

### 업로드 선택기 (`components/board/UploadDialog.tsx`)
- 카테고리 `<Select>`를 **잎새만** 나열로 변경: `leafPaths(categories)` → `<option value={id}>{path}</option>`(예: "2026 / 춘고 / 1반"). 폴더는 선택지에서 제외.
- 기본 선택: fork 원본 `defaultCategoryId`가 잎새면 그것, 아니면 첫 잎새. 잎새가 하나도 없으면 기존 "게시판이 없어요" 안내 재사용("관리자 선생님이 반을 먼저 만들어야 해요").

## 규칙 (`firestore.rules`)
- categories **create** 화이트리스트에 `parentId` 추가:
  ```
  request.resource.data.keys().hasOnly(['name','order','createdAt','parentId'])
  && ( !('parentId' in request.resource.data)
       || request.resource.data.parentId == null
       || (request.resource.data.parentId is string && request.resource.data.parentId.size() <= 128) )
  ```
- categories **update**는 `['name','order']`만 유지(reparent 없음 → parentId 생성 후 불변=안전).
- categories **delete**는 기존 `isAdmin()` 유지(트리 삭제는 다건 delete의 묶음이라 각 문서가 규칙 통과).
- 깊이/잎새/미아 가드는 규칙에서 강제하지 않음(조상 추적 비용·admin 전용 신뢰선). **문서로 명시.**
- posts 인덱스·규칙 **변경 없음**.

## 영향 파일
- 수정: `lib/firebase/types.ts`(parentId), `lib/firebase/categories.ts`(addCategory 시그니처·deleteCategoryTree), `components/board/BoardView.tsx`(CategoryTree·첫 잎새), `components/board/UploadDialog.tsx`(잎새 선택기), `app/admin/page.tsx`(카드 추가), `firestore.rules`(parentId).
- 신규: `lib/board/categoryTree.ts`(순수 유틸), `components/board/CategoryTree.tsx`, `app/admin/categories/page.tsx`, `components/admin/CategoryManager.tsx`.
- 제거: `components/board/CategoryBar.tsx`(CategoryTree로 대체).
- 인덱스·미리보기·posts 데이터 흐름 **변경 없음**.

## 검증 기준 (완료 정의)
1. `tsc --noEmit` + 프로덕션 빌드 통과.
2. 순수 유틸 자체 점검(노드 스크립트): `buildTree`가 3단 트리를 정확히 조립, `descendantIds`가 후손 전부 수집(사이클 안전), `leafPaths` 경로 라벨 정확, `depthOf` 정확.
3. 자체 통합 테스트(custom token, admin): root→2단→3단 생성 / 4단 추가는 클라이언트에서 차단 / 잎새에 작품 업로드 → `fetchPosts(잎새)`가 반환 / `deleteCategoryTree(2단)` 후 그 하위 잎새의 작품이 모두 사라짐 / 규칙 배포 후 비-admin의 `parentId` 포함 카테고리 생성 거부.
4. 브라우저: 게시판 좌측 트리 접기/펼치기, 잎새 선택 시에만 작품 로드, 폴더 클릭은 펼치기만. 업로드 다이얼로그가 잎새 경로만 나열. `/admin/categories`에서 하위 추가·이름변경·순서이동·삭제 동작, 깊이 3단·글 있는 폴더 가드 노출.
5. 콘솔 에러 0. 기존 게시판/게시물(평면 카테고리)이 root로 정상 표시(회귀 없음).

## 비범위(추후)
- reparent(다른 부모로 이동) — 추후 admin 계층 분리 시.
- 부모 노드의 "하위 전체 작품 모아보기"(서브트리 집계) — 조상 경로 필드·새 인덱스 필요, 현재 제외.
- 펼침 상태 영속화(localStorage/URL) — v1은 세션 로컬.
