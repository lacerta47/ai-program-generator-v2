# 게시판 목록 개선 — 접이식 게시판 칩 + 한 스크롤 + 트리 다듬기

**목표:** 게시판(카테고리)이 늘어나도 게시물 목록이 항상 보이게 한다.

**현상·원인:** `components/board/BoardView.tsx` 좌측 패널은 `max-h-[80vh]` 고정이고, 그 안에서 `CategoryTree`는 줄어들지 않는 블록, 게시물 목록만 `flex-1 overflow-y-auto`로 남는 공간을 받는다. 교사가 늘수록 교실 보드가 늘어 트리가 패널을 다 먹고 목록이 0에 수렴한다.

**설계(확정):**
1. **게시판 칩** — 패널 상단에 현재 게시판을 `[폴더 › 잎새 이름 🔒 ▾]` 한 줄 칩으로 표시. 칩 클릭으로 트리 펼침/접힘. 잎새 선택 시 자동 접힘. 기본은 접힘(저장 안 함).
2. **한 스크롤** — 트리(펼친 경우)·검색 필터·목록을 **하나의 스크롤 컨테이너**에 둔다. 트리가 50개여도 잘리지 않고, 접힌 상태에선 지금처럼 목록이 패널을 채운다. 무한스크롤 IntersectionObserver는 스크롤 조상에 의해 클리핑을 반영하므로 그대로 동작.
3. **트리 다듬기** — (a) 교사·학생은 **"내 교실"** 그룹을 맨 위에 고정, 그 아래 **"모두의 게시판"**. (b) 선택 잎새의 조상 자동 펼침 유지. (c) 폴더 행은 자식 수 배지 표시. (d) 접힌 폴더 안에 선택 잎새가 있으면 폴더 이름을 브랜드색으로 표시(어디 있는지 힌트).

**변경 파일**
- `components/board/BoardView.tsx` — 상태 `treeOpen`, 칩 렌더, 스크롤 컨테이너 재구성, 그룹 분리 로직.
- `components/board/CategoryTree.tsx` — `groups` prop(내 교실/모두) 지원, 자식 수 배지, 숨은 선택 힌트.
- `components/board/BoardChip.tsx` — 신규. 칩 UI(프리미티브 `components/ui` 사용).
- `lib/board/categoryTree.ts` — `pathOf(id, categories): CategoryNode[]` 헬퍼(칩 경로용). `leafPaths`가 이미 path 문자열을 만들지만 잎새 전용이라 조상 배열 반환 헬퍼를 추가.

**변경 없음:** Firestore 쿼리·규칙·인덱스·API. 배포는 Vercel 자동.

---

## Task 1: `pathOf` 헬퍼
- `lib/board/categoryTree.ts`에 추가:
```ts
/** id에서 루트까지의 카테고리 배열(루트 → id 순). 없으면 []. 순환 방어. */
export function pathOf(id: string, categories: Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: Category[] = [];
  const seen = new Set<string>();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return out;
}
```
- 검증: `./node_modules/.bin/tsc --noEmit`.

## Task 2: `BoardChip` 컴포넌트
- `components/board/BoardChip.tsx` 신규. props: `path: Category[]`, `open: boolean`, `onToggle(): void`, `locked: boolean`.
- 렌더: `press` 버튼 한 줄. 왼쪽 `FileCode2`(또는 잠금 시 `Lock`), 가운데 경로 텍스트(`부모 › 잎새`, 잎새는 `font-medium`, 긴 경로는 `truncate`), 오른쪽 `ChevronDown`(open 시 180도 회전, `transition-transform`, reduced-motion 가드는 globals의 유틸 사용).
- `aria-expanded={open}`, `aria-controls="board-tree"`.
- 카테고리가 아직 없을 때(`path.length===0`)는 "게시판 고르기" 라벨.
- 마이크로카피: "게시판 바꾸기"를 `title`로.

## Task 3: BoardView 레이아웃 재구성
- 상태 추가: `const [treeOpen, setTreeOpen] = useState(false);`
- `selectCategory` 래퍼에서 잎새 선택 시 `setTreeOpen(false)` (기존 `selectCategory` 함수 끝에 추가).
- 카테고리가 0개 → 칩 대신 기존 "아직 게시판이 없어요" 문구 유지.
- JSX(좌측 섹션 내부) 구조를 아래로 교체:
```tsx
<div className="flex items-center justify-between gap-2">  {/* 제목 + 접기 버튼 (기존) */}
<BoardChip path={pathOf(selectedCategoryId ?? '', visibleCategories)} open={treeOpen}
           onToggle={() => setTreeOpen((v) => !v)} locked={!!selectedTeacherUid} />
<div className="min-h-0 flex-1 overflow-y-auto">            {/* 단일 스크롤 */}
  {treeOpen && (
    <div id="board-tree" className="mb-4 rounded-[var(--r-md)] border-2 border-line bg-surface-2/40 p-2">
      <CategoryTree groups={groups} selectedId={selectedCategoryId} onSelect={selectCategory} />
    </div>
  )}
  <div className="sticky top-0 z-10 bg-surface pb-2"><BoardFilter … /></div>
  {…찾았어요 문구…}
  {…로딩/에러/PostList/scanCapped (기존 그대로)…}
</div>
```
- `groups` 계산(useMemo): 
  - `mine` = `visibleCategories` 중 `teacherUid === user?.uid || teacherUid === myClassTeacherUid` 인 것과 그 조상들.
  - `everyone` = 나머지(공개 보드 + admin이 보는 타 교실 보드).
  - admin은 그룹 분리 없이 전체 하나로(`groups=[{label:null, categories: visibleCategories}]`).
- `BoardFilter`를 sticky로 두는 이유: 트리를 펼쳐 내려간 뒤에도 검색은 항상 손 닿는 곳에.
- 검증: tsc + `npm run build`(dev 종료 후) + 브라우저 `/board` — (a) 접힌 기본 상태에서 목록 전체 높이 (b) 칩 클릭 → 트리 펼침, 스크롤 하나로 트리→목록 연속 (c) 잎새 선택 → 자동 접힘·목록 갱신 (d) 무한스크롤 계속 동작 (e) 모바일 375px에서 동일.

## Task 4: CategoryTree 다듬기
- props 변경: `categories` → `groups: { label: string | null; categories: Category[] }[]` (하위호환 위해 `categories`도 받아 단일 그룹으로 처리).
- 그룹 라벨은 `text-[13px] text-muted` 소제목("내 교실", "모두의 게시판"), 그룹 사이 `gap-3`.
- `TreeRow` 폴더 행: 이름 뒤에 자식 잎새 수 배지(`Chip` 프리미티브 소형 또는 `text-[12px] text-muted`), 접힌 폴더의 하위에 `selectedId`가 있으면 폴더 이름 `text-brand-strong` + `font-medium`(`descendantIds(node.id, categories).includes(selectedId)`).
- `stagger` 애니메이션은 그룹 단위로 유지(reduced-motion 가드 기존 유틸).
- 검증: tsc + 브라우저 — 교사 계정(내 교실 상단), 학생 계정(내 교실=자기 반 하나), 일반 계정(그룹 라벨 없음, 공개만), admin(전체 단일 그룹).

## Task 5: 마무리
- `docs/아키텍처-및-핵심알고리즘.md` §5.12 게시판 항목에 "게시판 칩·단일 스크롤" 한 줄 추가.
- 브랜치 `feat/board-picker` → PR → 브라우저 검증 스크린샷 첨부 → 머지.

## 리스크·결정
- **IntersectionObserver root**: 기본 viewport root라도 스크롤 조상의 클리핑을 반영하므로 `root` 변경 불필요. 만약 목록 하단 sentinel이 펼친 트리 때문에 처음부터 보이지 않아 로드가 안 되는 경우는 없다(트리는 위에 붙음).
- **자동 접힘 타이밍**: 선택 직후 접히면 목록 로딩 스피너가 그 자리에 보인다 — 의도(선택 결과가 바로 보임).
- **딥링크 `?category=`·`?post=`**: 기존 로직이 `selectedCategoryId`를 설정하므로 칩은 자동 반영. 트리는 접힌 채 시작.
- 펼침 상태 localStorage 저장 **안 함**(예측 가능성 우선).
