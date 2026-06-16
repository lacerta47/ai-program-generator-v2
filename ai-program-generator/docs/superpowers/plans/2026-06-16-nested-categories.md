# 중첩 카테고리 + 접기/펼치기 게시판 구현 플랜 (게시판 보수 A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평면 카테고리를 3단 중첩 트리로 바꾸고, 게시판 좌측을 접기/펼치기 읽기 전용 트리로, 카테고리 관리(CRUD)는 `/admin/categories`로 이전한다.

**Architecture:** `Category.parentId`(인접 리스트, 옵셔널 → 마이그레이션 제로). 트리는 클라이언트에서 순수 유틸(`lib/board/categoryTree.ts`)로 조립. 작품은 잎새(자식 없는 노드)에만 → 게시물 쿼리·인덱스 불변. 가드(깊이3·잎새·미아)는 admin 전용 신뢰선이라 클라이언트, 규칙엔 parentId 화이트리스트만.

**Tech Stack:** Next.js 15(App Router) · TypeScript · Firebase(Firestore client + Admin SDK) · Tailwind v4 · lucide-react.

**검증 도구 주의:** 이 repo는 **단위 테스트 러너·tsx 없음**(CLAUDE.md). 검증은 ① `./node_modules/.bin/tsc --noEmit`(dev 띄운 채 안전) ② 순수 유틸은 단독 컴파일 후 node 자체점검 ③ 통합은 custom-token `.mjs` self-test ④ 브라우저. `npx tsc`/`npx tsx` 금지(다른 cwd 가짜 패키지 설치). dev 실행 중 `npm run build` 금지(.next 공유). 일회성 `.mjs`는 커밋하지 않음. git 명령은 repo 루트 `C:/Users/amh47/Documents/test`에서 실행.

---

## 파일 구조

- 신규 `lib/board/categoryTree.ts` — 순수 트리 유틸(Firebase 의존 없음): `buildTree`/`descendantIds`/`leafPaths`/`depthOf`/`hasChildren`.
- 수정 `lib/firebase/types.ts` — `Category.parentId?`.
- 수정 `lib/firebase/categories.ts` — `addCategory(parentId?)`, `deleteCategoryTree`, `deleteCategoryWithPosts` 제거.
- 신규 `components/board/CategoryTree.tsx` — 게시판 읽기 전용 트리 내비.
- 수정 `components/board/BoardView.tsx` — CategoryTree 사용, 첫 잎새 자동선택.
- 제거 `components/board/CategoryBar.tsx`.
- 신규 `components/admin/CategoryManager.tsx` + `app/admin/categories/page.tsx` — 트리 편집기.
- 수정 `app/admin/page.tsx` — "게시판 관리" 카드.
- 수정 `components/board/UploadDialog.tsx` — 잎새-only 경로 선택기.
- 수정 `firestore.rules` — categories create에 parentId.

---

## Task 1: Category 타입 + 순수 트리 유틸

**Files:**
- Modify: `ai-program-generator/lib/firebase/types.ts` (Category 인터페이스)
- Create: `ai-program-generator/lib/board/categoryTree.ts`
- Self-test(미커밋): `ai-program-generator/scripts/selftest-categorytree.mjs`

- [ ] **Step 1: `Category`에 `parentId` 추가**

`lib/firebase/types.ts`의 `Category` 인터페이스를 수정:

```ts
export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  /** 부모 카테고리 id. 없거나 null = 최상위(root). 인접 리스트로 3단 트리 구성. */
  parentId?: string | null;
}
```

- [ ] **Step 2: 순수 트리 유틸 작성**

`lib/board/categoryTree.ts` 생성 (런타임 import 없음 — `import type`만 → 단독 컴파일 가능):

```ts
import type { Category } from '@/lib/firebase/types';

export interface CategoryNode extends Category {
  children: CategoryNode[];
  /** root = 1 */
  depth: number;
}

/** 평면 배열 → 루트 노드 배열. 형제는 order asc. 사이클은 방문집합으로 차단(손상 데이터 안전). */
export function buildTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of categories) nodes.set(c.id, { ...c, children: [], depth: 1 });

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const pid = node.parentId ?? null;
    const parent = pid ? nodes.get(pid) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node); // root 또는 부모가 사라진 노드 → root 취급
  }

  const walk = (list: CategoryNode[], depth: number, seen: Set<string>) => {
    list.sort((a, b) => a.order - b.order);
    for (const n of list) {
      if (seen.has(n.id)) {
        n.children = []; // 사이클 차단
        continue;
      }
      seen.add(n.id);
      n.depth = depth;
      walk(n.children, depth + 1, seen);
    }
  };
  walk(roots, 1, new Set());
  return roots;
}

/** id와 그 모든 후손의 id(자기 자신 포함). 사이클 안전. */
export function descendantIds(id: string, categories: Category[]): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) {
    const pid = c.parentId ?? null;
    if (pid) (childrenOf.get(pid) ?? childrenOf.set(pid, []).get(pid)!).push(c.id);
  }
  const result: string[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    result.push(cur);
    for (const ch of childrenOf.get(cur) ?? []) stack.push(ch);
  }
  return result;
}

/** 노드 깊이(root=1). 부모 체인을 따라 셈, 사이클 안전. */
export function depthOf(id: string, categories: Category[]): number {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const seen = new Set<string>();
  let depth = 0;
  let cur: string | null | undefined = id;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const node = byId.get(cur);
    if (!node) break;
    depth++;
    cur = node.parentId ?? null;
  }
  return depth;
}

/** 직속 자식을 가진 노드인가(=폴더). */
export function hasChildren(id: string, categories: Category[]): boolean {
  return categories.some((c) => (c.parentId ?? null) === id);
}

/** 잎새(자식 없는 노드)만, 경로 라벨과 함께. path 예: "2026 / 춘고 / 1반". 경로 사전순 정렬. */
export function leafPaths(categories: Category[]): { id: string; name: string; path: string }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parents = new Set<string>();
  for (const c of categories) {
    const pid = c.parentId ?? null;
    if (pid) parents.add(pid);
  }
  const pathOf = (c: Category): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur: Category | undefined = c;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      parts.unshift(cur.name);
      const pid = cur.parentId ?? null;
      cur = pid ? byId.get(pid) : undefined;
    }
    return parts.join(' / ');
  };
  return categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, path: pathOf(c) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'));
}
```

- [ ] **Step 3: 자체점검 스크립트 작성 (미커밋)**

`scripts/selftest-categorytree.mjs` 생성. (단독 컴파일된 JS를 import — 아래 Step 4에서 컴파일.)

```js
import assert from 'node:assert';
import { buildTree, descendantIds, depthOf, hasChildren, leafPaths } from '../.selftest-build/lib/board/categoryTree.js';

// 2026 > 춘고 > 1반 / 2026 > 춘고 > 2반 / 2024(빈 root)
const cats = [
  { id: '2026', name: '2026', order: 0, createdAt: 1 },
  { id: '2024', name: '2024', order: 1, createdAt: 1 },
  { id: 'chungo', name: '춘고', order: 0, createdAt: 1, parentId: '2026' },
  { id: 'c1', name: '1반', order: 1, createdAt: 1, parentId: 'chungo' },
  { id: 'c2', name: '2반', order: 0, createdAt: 1, parentId: 'chungo' },
];

const tree = buildTree(cats);
assert.equal(tree.length, 2, 'roots = 2');
assert.equal(tree[0].id, '2026', 'order asc: 2026 먼저');
assert.equal(tree[0].depth, 1, 'root depth 1');
const chungo = tree[0].children[0];
assert.equal(chungo.id, 'chungo');
assert.equal(chungo.depth, 2, '춘고 depth 2');
assert.equal(chungo.children[0].id, 'c2', '형제 order asc: 2반(order0) 먼저');
assert.equal(chungo.children[0].depth, 3, '반 depth 3');

assert.deepEqual([...descendantIds('chungo', cats)].sort(), ['c1', 'c2', 'chungo'], 'descendants');
assert.deepEqual(descendantIds('c1', cats), ['c1'], '잎새 후손=자기');

assert.equal(depthOf('c1', cats), 3, 'depthOf 1반=3');
assert.equal(depthOf('2026', cats), 1, 'depthOf root=1');

assert.equal(hasChildren('chungo', cats), true);
assert.equal(hasChildren('c1', cats), false);

const leaves = leafPaths(cats);
assert.deepEqual(leaves.map((l) => l.id).sort(), ['2024', 'c1', 'c2'], '잎새: 빈 root + 두 반');
const oneBan = leaves.find((l) => l.id === 'c1');
assert.equal(oneBan.path, '2026 / 춘고 / 1반', '경로 라벨');

console.log('SELFTEST_CATEGORYTREE_OK');
```

- [ ] **Step 4: 자체점검 실행 (임시 tsconfig로 컴파일 → node)**

`@/` 별칭은 tsconfig의 `paths`에만 정의돼 단독 `tsc 파일`로는 모듈 해석이 실패한다. paths를 가진 임시 tsconfig로 컴파일한다. `ai-program-generator/.selftest-tsconfig.json` 생성(미커밋):

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "es2020",
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] },
    "skipLibCheck": true,
    "rootDir": ".",
    "outDir": ".selftest-build"
  },
  "files": ["lib/board/categoryTree.ts"]
}
```

그런 다음 `ai-program-generator/`에서:

```bash
./node_modules/.bin/tsc -p .selftest-tsconfig.json
node scripts/selftest-categorytree.mjs
rm -rf .selftest-build .selftest-tsconfig.json
```

Expected: `SELFTEST_CATEGORYTREE_OK` 출력. (categoryTree.ts의 `import type`은 emit 시 제거되므로 `.selftest-build/lib/board/categoryTree.js`는 런타임 import가 없다. types.ts 등도 함께 emit되지만 사용 안 함.)

- [ ] **Step 5: 전체 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음(종료코드 0).

- [ ] **Step 6: 커밋** (자체점검 .mjs·.selftest-build는 미커밋)

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/lib/firebase/types.ts ai-program-generator/lib/board/categoryTree.ts
git commit -m "feat(board): Category.parentId + 순수 트리 유틸(buildTree/descendantIds/leafPaths/depthOf)"
```

---

## Task 2: 데이터 계층 — addCategory(parentId) + deleteCategoryTree

**Files:**
- Modify: `ai-program-generator/lib/firebase/categories.ts`

- [ ] **Step 1: `deleteCategoryWithPosts`의 다른 사용처 확인**

Run(Grep): `deleteCategoryWithPosts` 전체 검색.
Expected: `categories.ts` 정의 + `components/board/CategoryBar.tsx`만. (CategoryBar는 Task 4에서 제거되므로 안전하게 대체 가능.)

- [ ] **Step 2: `addCategory` 시그니처 확장 + `deleteCategoryTree` 추가, `deleteCategoryWithPosts` 제거**

`lib/firebase/categories.ts`에서 `import type { Category }` 옆에 트리 유틸 import 추가, `addCategory`/삭제 함수를 아래로 교체:

```ts
import { descendantIds } from '@/lib/board/categoryTree';
```

`addCategory` 교체:

```ts
export async function addCategory(
  name: string,
  order: number,
  parentId: string | null = null,
): Promise<void> {
  const data: { name: string; order: number; createdAt: number; parentId?: string } = {
    name: name.trim(),
    order,
    createdAt: Date.now(),
  };
  // root는 parentId 필드 자체를 생략 → 규칙의 !('parentId' in data) 분기 + 기존 평면 문서와 동일
  if (parentId) data.parentId = parentId;
  await addDoc(collection(db, COL), data);
}
```

`deleteCategoryWithPosts` 전체를 `deleteCategoryTree`로 교체:

```ts
/**
 * 카테고리 + 모든 후손 카테고리 + 그 하위 게시물 일괄 삭제.
 * descendantIds로 자기+후손 id를 모아, 각 카테고리의 게시물을 450건 배치로 지우고,
 * 마지막에 카테고리 문서들을 배치 삭제한다. (Firestore엔 컬렉션 cascade가 없음.)
 */
export async function deleteCategoryTree(id: string, all: Category[]): Promise<void> {
  const ids = descendantIds(id, all);
  for (const cid of ids) {
    const postsSnap = await getDocs(query(collection(db, 'posts'), where('categoryId', '==', cid)));
    const docs = postsSnap.docs;
    for (let i = 0; i < docs.length; i += 450) {
      const batch = writeBatch(db);
      docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  for (let i = 0; i < ids.length; i += 450) {
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((cid) => batch.delete(doc(db, COL, cid)));
    await batch.commit();
  }
}
```

- [ ] **Step 3: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. (이 시점에 CategoryBar가 아직 `deleteCategoryWithPosts`를 import하면 에러 — Task 4 전까지 임시로 CategoryBar의 해당 import/호출만 `deleteCategoryTree(current.id, categories)`로 바꿔 통과시킨다. CategoryBar는 Task 4에서 통째로 제거.)

실제로 Step 3에서 에러가 나면 `components/board/CategoryBar.tsx`의 import를 `deleteCategoryTree`로, `handleDelete` 내 호출을 `await deleteCategoryTree(current.id, categories)`로 한 줄씩 바꾸고 다시 타입체크.

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/lib/firebase/categories.ts ai-program-generator/components/board/CategoryBar.tsx
git commit -m "feat(board): addCategory(parentId) + deleteCategoryTree(후손+게시물 캐스케이드)"
```

---

## Task 3: Firestore 규칙 — parentId 화이트리스트 + 배포

**Files:**
- Modify: `ai-program-generator/firestore.rules` (categories create 블록)

- [ ] **Step 1: categories create 규칙에 parentId 허용**

`firestore.rules`의 `match /categories/{categoryId}`에서 `allow create` 블록을 아래로 교체(키 목록에 `parentId` 추가 + 형태 검증). `update`/`delete`는 그대로 둔다(reparent 없음 → parentId는 생성 후 불변):

```
      allow create: if isAdmin()
        && request.resource.data.keys().hasOnly(['name', 'order', 'createdAt', 'parentId'])
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 50
        && request.resource.data.order is number
        && request.resource.data.createdAt is number
        && (
          !('parentId' in request.resource.data)
          || request.resource.data.parentId == null
          || (request.resource.data.parentId is string && request.resource.data.parentId.size() <= 128)
        );
```

- [ ] **Step 2: 규칙 배포**

Run: `firebase deploy --only firestore:rules`
Expected: `✔  Deploy complete!` (프로젝트 test-ai-builder). 인덱스 변경 없음 → 인덱스 배포 불필요.

- [ ] **Step 3: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/firestore.rules
git commit -m "feat(rules): categories create에 parentId 허용(string|null, 생성 후 불변)"
```

---

## Task 4: 게시판 트리 내비(CategoryTree) + BoardView 연결, CategoryBar 제거

**Files:**
- Create: `ai-program-generator/components/board/CategoryTree.tsx`
- Modify: `ai-program-generator/components/board/BoardView.tsx`
- Delete: `ai-program-generator/components/board/CategoryBar.tsx`

- [ ] **Step 1: CategoryTree 작성**

`components/board/CategoryTree.tsx` 생성:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2 } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';
import { buildTree, type CategoryNode } from '@/lib/board/categoryTree';

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function CategoryTree({ categories, selectedId, onSelect }: Props) {
  const tree = buildTree(categories);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 선택/딥링크된 잎새의 조상 자동 펼침
  useEffect(() => {
    if (!selectedId) return;
    const byId = new Map(categories.map((c) => [c.id, c]));
    const anc: string[] = [];
    const seen = new Set<string>();
    let cur = byId.get(selectedId)?.parentId ?? null;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      anc.push(cur);
      cur = byId.get(cur)?.parentId ?? null;
    }
    if (anc.length) setExpanded((prev) => new Set([...prev, ...anc]));
  }, [selectedId, categories]);

  if (categories.length === 0) {
    return <p className="py-2 text-[15px] text-muted">아직 게시판이 없어요.</p>;
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="stagger flex flex-col gap-1">
      {tree.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          expanded={expanded}
          onToggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function TreeRow({
  node,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  node: CategoryNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const isFolder = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const active = node.id === selectedId;
  const indent = (node.depth - 1) * 16;

  return (
    <li>
      <button
        onClick={() => (isFolder ? onToggle(node.id) : onSelect(node.id))}
        style={{ paddingLeft: indent + 12 }}
        aria-expanded={isFolder ? isOpen : undefined}
        className={`press flex w-full items-center gap-2 rounded-[var(--r-md)] border-2 py-2.5 pr-3 text-left transition-colors ${
          active
            ? 'border-brand bg-brand-soft font-medium text-brand-strong dark:text-brand'
            : 'border-transparent text-ink hover:bg-surface-2'
        }`}
      >
        {isFolder ? (
          <>
            {isOpen ? (
              <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden />
            )}
            {isOpen ? (
              <FolderOpen size={17} className="shrink-0 text-sunshine-ink" aria-hidden />
            ) : (
              <Folder size={17} className="shrink-0 text-sunshine-ink" aria-hidden />
            )}
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" aria-hidden />
            <FileCode2 size={17} className="shrink-0 text-brand" aria-hidden />
          </>
        )}
        <span className="truncate text-[15.5px]">{node.name}</span>
      </button>

      {isFolder && isOpen && (
        <ul className="flex flex-col gap-1">
          {node.children.map((ch) => (
            <TreeRow
              key={ch.id}
              node={ch}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [ ] **Step 2: BoardView가 CategoryTree를 쓰도록 교체**

`components/board/BoardView.tsx`:

(a) import 교체 — `import CategoryBar from './CategoryBar';` 줄을 삭제하고 추가:
```ts
import CategoryTree from './CategoryTree';
import { leafPaths } from '@/lib/board/categoryTree';
```

(b) "첫 번째로" 자동선택 효과(현재 `setSelectedCategoryId(categories[0].id)`)를 첫 잎새로:
```ts
  // 선택된 카테고리가 없으면 첫 잎새로 (딥링크 글 해결 중이면 대기)
  useEffect(() => {
    if (!selectedCategoryId && !deepLinkResolving && categories.length > 0) {
      const firstLeaf = leafPaths(categories)[0];
      if (firstLeaf) setSelectedCategoryId(firstLeaf.id);
    }
  }, [categories, selectedCategoryId, deepLinkResolving]);
```

(c) "보던 카테고리가 삭제되면" 폴백 효과의 `setSelectedCategoryId(categories[0].id)`를 첫 잎새로:
```ts
  useEffect(() => {
    if (!selectedCategoryId || categories.length === 0) return;
    if (!categories.some((c) => c.id === selectedCategoryId)) {
      const firstLeaf = leafPaths(categories)[0];
      setSelectedCategoryId(firstLeaf?.id ?? null);
      setSelectedPost(null);
    }
  }, [categories, selectedCategoryId]);
```

(d) 좌측 패널의 `<CategoryBar ... />`를 교체 (isAdmin prop 제거):
```tsx
        <CategoryTree
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={selectCategory}
        />
```

- [ ] **Step 3: CategoryBar 삭제**

```bash
rm ai-program-generator/components/board/CategoryBar.tsx
```

- [ ] **Step 4: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. (`isAdmin`이 BoardView에서 더 쓰이지 않으면 unused 경고는 없지만, `useAuth()`의 isAdmin은 PostPreview canEdit 등에서 여전히 사용되므로 유지.)

- [ ] **Step 5: 브라우저 확인**

dev(`npm run dev`) 실행 후 게시판 열기. 임시로 admin 페이지가 아직 없으니, 트리 표시·접기/펼치기·잎새 선택을 기존 평면 카테고리(전부 root=잎새)로 확인:
- 기존 카테고리들이 잎새 아이콘으로 나열되고 클릭 시 작품 로드.
- 콘솔 에러 0.

(중첩 트리 본격 확인은 Task 5에서 하위 폴더 생성 후.)

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add -A ai-program-generator/components/board/
git commit -m "feat(board): 접기/펼치기 트리 내비(CategoryTree)로 교체, CategoryBar 제거"
```

---

## Task 5: Admin 트리 편집기 — /admin/categories + CategoryManager + 허브 카드

**Files:**
- Create: `ai-program-generator/components/admin/CategoryManager.tsx`
- Create: `ai-program-generator/app/admin/categories/page.tsx`
- Modify: `ai-program-generator/app/admin/page.tsx`

- [ ] **Step 1: 기존 admin 페이지 패턴 확인**

Read: `ai-program-generator/app/admin/users/page.tsx`(또는 accounts) — `Header` + `AdminGate` 래핑 패턴을 그대로 따른다. `components/admin/`의 기존 컴포넌트에서 toast/Field 프리미티브 사용법 확인.

- [ ] **Step 2: CategoryManager 작성**

`components/admin/CategoryManager.tsx` 생성. 전체 카테고리 구독 → 트리 렌더. 노드별 추가/이름변경/순서/삭제. 가드: 깊이<3 & 직속 작품 없을 때만 [하위 추가]; 삭제는 confirm.

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2, Plus, Pencil, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';
import { buildTree, depthOf, type CategoryNode } from '@/lib/board/categoryTree';
import {
  subscribeCategories,
  addCategory,
  renameCategory,
  swapCategoryOrder,
  deleteCategoryTree,
} from '@/lib/firebase/categories';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const FAIL = '문제가 생겼어요. 인터넷 연결이나 권한을 확인하고 다시 해볼까요?';

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState<string | 'root' | null>(null); // 부모 id 또는 'root'
  const [addName, setAddName] = useState('');
  const { toast } = useToast();

  useEffect(() => subscribeCategories(setCategories, () => toast(FAIL)), [toast]);

  const tree = buildTree(categories);

  const toggle = (id: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function submitAdd(parentId: string | null) {
    const name = addName.trim();
    setAdding(null);
    setAddName('');
    if (!name) return;
    // 글 있는 폴더 아래 하위 추가 금지(작품 미아 방지)
    if (parentId) {
      try {
        const snap = await getDocs(
          query(collection(db, 'posts'), where('categoryId', '==', parentId), limit(1)),
        );
        if (!snap.empty) {
          toast('이 게시판에는 이미 작품이 있어서 하위를 만들 수 없어요. (작품은 맨 아래 칸에만)');
          return;
        }
      } catch {
        toast(FAIL);
        return;
      }
    }
    const siblings = categories.filter((c) => (c.parentId ?? null) === parentId);
    try {
      await addCategory(name, siblings.length, parentId);
      if (parentId) setExpanded((p) => new Set([...p, parentId]));
    } catch (e) {
      console.error('카테고리 추가 실패:', e);
      toast(FAIL);
    }
  }

  async function submitRename(id: string) {
    const name = editName.trim();
    setEditing(null);
    if (!name) return;
    try {
      await renameCategory(id, name);
    } catch (e) {
      console.error('이름 변경 실패:', e);
      toast(FAIL);
    }
  }

  async function move(node: CategoryNode, dir: 'up' | 'down') {
    const siblings = categories
      .filter((c) => (c.parentId ?? null) === (node.parentId ?? null))
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((c) => c.id === node.id);
    const t = idx + (dir === 'up' ? -1 : 1);
    if (idx < 0 || t < 0 || t >= siblings.length) return;
    try {
      await swapCategoryOrder(siblings[idx], siblings[t]);
    } catch (e) {
      console.error('순서 변경 실패:', e);
      toast(FAIL);
    }
  }

  async function remove(node: CategoryNode) {
    if (
      !confirm(
        `'${node.name}'${node.children.length ? '과 그 안의 모든 하위 게시판' : ''}, 그리고 안의 모든 작품을 삭제할까요? 되돌릴 수 없어요.`,
      )
    )
      return;
    try {
      await deleteCategoryTree(node.id, categories);
    } catch (e) {
      console.error('삭제 실패:', e);
      toast(FAIL);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px]">게시판 관리</h1>
        {adding === 'root' ? (
          <AddInline
            value={addName}
            onChange={setAddName}
            onSubmit={() => submitAdd(null)}
            onCancel={() => {
              setAdding(null);
              setAddName('');
            }}
            placeholder="새 최상위 폴더"
          />
        ) : (
          <Button variant="primary" className="min-h-11 px-4" onClick={() => setAdding('root')}>
            <Plus size={17} aria-hidden /> 최상위 폴더
          </Button>
        )}
      </div>

      {categories.length === 0 ? (
        <p className="py-4 text-[15px] text-muted">아직 게시판이 없어요. 최상위 폴더부터 만들어 보세요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tree.map((node) => (
            <ManagerRow
              key={node.id}
              node={node}
              categories={categories}
              expanded={expanded}
              onToggle={toggle}
              editing={editing}
              editName={editName}
              setEditing={setEditing}
              setEditName={setEditName}
              onRename={submitRename}
              adding={adding}
              addName={addName}
              setAdding={setAdding}
              setAddName={setAddName}
              onAdd={submitAdd}
              onMove={move}
              onRemove={remove}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddInline({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <TextInput
        autoFocus
        className="min-h-11 w-44"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
      />
      <Button variant="primary" className="min-h-11 px-3" onClick={onSubmit}>
        추가
      </Button>
      <Button variant="ghost" className="min-h-11 px-3" onClick={onCancel}>
        취소
      </Button>
    </div>
  );
}

function ManagerRow({
  node,
  categories,
  expanded,
  onToggle,
  editing,
  editName,
  setEditing,
  setEditName,
  onRename,
  adding,
  addName,
  setAdding,
  setAddName,
  onAdd,
  onMove,
  onRemove,
}: {
  node: CategoryNode;
  categories: Category[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  editing: string | null;
  editName: string;
  setEditing: (v: string | null) => void;
  setEditName: (v: string) => void;
  onRename: (id: string) => void;
  adding: string | 'root' | null;
  addName: string;
  setAdding: (v: string | 'root' | null) => void;
  setAddName: (v: string) => void;
  onAdd: (parentId: string | null) => void;
  onMove: (node: CategoryNode, dir: 'up' | 'down') => void;
  onRemove: (node: CategoryNode) => void;
}) {
  const isFolder = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const indent = (node.depth - 1) * 18;
  const canAddChild = node.depth < 3; // 3단이면 하위 불가

  return (
    <li>
      <div
        className="lift flex items-center gap-2 rounded-[var(--r-md)] border-2 border-line bg-surface px-2.5 py-2"
        style={{ marginLeft: indent }}
      >
        <button
          onClick={() => isFolder && onToggle(node.id)}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-[8px] ${isFolder ? 'text-muted hover:bg-surface-2' : 'invisible'}`}
          aria-label={isOpen ? '접기' : '펼치기'}
        >
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {isFolder ? (
          isOpen ? (
            <FolderOpen size={18} className="shrink-0 text-sunshine-ink" aria-hidden />
          ) : (
            <Folder size={18} className="shrink-0 text-sunshine-ink" aria-hidden />
          )
        ) : (
          <FileCode2 size={18} className="shrink-0 text-brand" aria-hidden />
        )}

        {editing === node.id ? (
          <TextInput
            autoFocus
            className="min-h-10 flex-1"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => onRename(node.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(node.id);
              if (e.key === 'Escape') setEditing(null);
            }}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[15.5px]">{node.name}</span>
        )}

        <div className="flex shrink-0 gap-1">
          {canAddChild && (
            <ManageBtn
              label="하위 추가"
              onClick={() => {
                setAddName('');
                setAdding(node.id);
                onToggle(node.id); // 펼쳐서 입력칸 보이게
              }}
            >
              <Plus size={15} />
            </ManageBtn>
          )}
          <ManageBtn
            label="이름 바꾸기"
            onClick={() => {
              setEditName(node.name);
              setEditing(node.id);
            }}
          >
            <Pencil size={15} />
          </ManageBtn>
          <ManageBtn label="위로" onClick={() => onMove(node, 'up')}>
            <ArrowUp size={15} />
          </ManageBtn>
          <ManageBtn label="아래로" onClick={() => onMove(node, 'down')}>
            <ArrowDown size={15} />
          </ManageBtn>
          <ManageBtn label="삭제" danger onClick={() => onRemove(node)}>
            <Trash2 size={15} />
          </ManageBtn>
        </div>
      </div>

      {/* 하위 추가 입력칸 */}
      {adding === node.id && (
        <div className="mt-1.5" style={{ marginLeft: indent + 18 }}>
          <AddInline
            value={addName}
            onChange={setAddName}
            onSubmit={() => onAdd(node.id)}
            onCancel={() => {
              setAdding(null);
              setAddName('');
            }}
            placeholder={`'${node.name}' 안에 새 폴더/반`}
          />
        </div>
      )}

      {isFolder && isOpen && (
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {node.children.map((ch) => (
            <ManagerRow
              key={ch.id}
              node={ch}
              categories={categories}
              expanded={expanded}
              onToggle={onToggle}
              editing={editing}
              editName={editName}
              setEditing={setEditing}
              setEditName={setEditName}
              onRename={onRename}
              adding={adding}
              addName={addName}
              setAdding={setAdding}
              setAddName={setAddName}
              onAdd={onAdd}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function ManageBtn({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`press grid h-9 w-9 place-items-center rounded-[9px] border-2 border-line bg-surface ${
        danger ? 'text-coral-ink hover:border-coral/60 hover:bg-coral-soft' : 'text-muted hover:border-brand/50 hover:text-brand-strong'
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: /admin/categories 페이지 작성**

`app/admin/categories/page.tsx` 생성 (기존 admin 페이지의 Header+AdminGate 패턴):

```tsx
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import CategoryManager from '@/components/admin/CategoryManager';

export default function AdminCategoriesPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <CategoryManager />
        </div>
      </AdminGate>
    </main>
  );
}
```

- [ ] **Step 4: admin 허브에 "게시판 관리" 카드 추가**

`app/admin/page.tsx`의 lucide import에 `FolderTree`를 추가하고, 카드 목록(`<HubCard ... />`들)에 한 장 추가:

import 줄 수정:
```ts
import { Flag, Users, ChevronRight, UserPlus, FolderTree } from 'lucide-react';
```

"계정 관리" HubCard 다음에 추가:
```tsx
        <HubCard
          href="/admin/categories"
          icon={<FolderTree size={22} aria-hidden />}
          title="게시판 관리"
          desc="중첩 게시판 만들기·이름·순서·삭제"
        />
```

- [ ] **Step 5: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 6: 브라우저 확인 (admin 계정으로)**

dev에서 `/admin` → "게시판 관리" → `/admin/categories`:
- 최상위 폴더 추가(예: "2026") → 그 안에 하위("춘고") → 또 하위("1반"). 1반은 depth 3 → [하위 추가] 버튼 사라짐(깊이 가드).
- 이름 바꾸기, ↑↓ 순서, 삭제(confirm) 동작.
- 게시판으로 가서 트리 접기/펼치기 + 1반(잎새) 선택 시 작품 로드 확인.
- 콘솔 에러 0.

- [ ] **Step 7: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/admin/CategoryManager.tsx ai-program-generator/app/admin/categories/page.tsx ai-program-generator/app/admin/page.tsx
git commit -m "feat(admin): /admin/categories 트리 편집기(하위추가·이름·순서·삭제) + 허브 카드"
```

---

## Task 6: 업로드 잎새-only 경로 선택기

**Files:**
- Modify: `ai-program-generator/components/board/UploadDialog.tsx`

- [ ] **Step 1: leafPaths import + 선택기·기본값 교체**

`UploadDialog.tsx`:

(a) import 추가:
```ts
import { leafPaths } from '@/lib/board/categoryTree';
```

(b) 기본 선택 효과(현재 `categories[0].id`로 폴백)를 첫 잎새로:
```ts
  useEffect(() => {
    if (!categories.length || categoryId) return;
    const leaves = leafPaths(categories);
    const preferred =
      defaultCategoryId && leaves.some((l) => l.id === defaultCategoryId)
        ? defaultCategoryId
        : leaves[0]?.id ?? '';
    setCategoryId(preferred);
  }, [categories, categoryId, defaultCategoryId]);
```

(c) "게시판이 없어요" 빈 상태 조건을 잎새 기준으로, 그리고 `<Select>`를 잎새 경로 목록으로. 현재 `categories.length === 0 ? (...) : (<form>...)` 분기에서 `categories.length === 0`을 `leafPaths(categories).length === 0`으로 바꾸고, `<Select>` 내부 옵션을 교체:

빈 상태 조건:
```tsx
          {leafPaths(categories).length === 0 ? (
            <p className="text-[15px] text-muted">
              아직 작품을 올릴 게시판(반)이 없어요. 관리자 선생님이 먼저 만들어야 해요.
            </p>
          ) : (
```

Select 옵션:
```tsx
              <Label text="어느 게시판에 올릴까요?">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {leafPaths(categories).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.path}
                    </option>
                  ))}
                </Select>
              </Label>
```

- [ ] **Step 2: 타입체크**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 브라우저 확인**

생성기에서 작품 만든 뒤 "게시판에 올리기" → 선택기에 **잎새 경로만**("2026 / 춘고 / 1반") 표시, 폴더는 안 보임. 업로드 후 게시판에서 해당 잎새에 작품 보임. 콘솔 에러 0.

- [ ] **Step 4: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/board/UploadDialog.tsx
git commit -m "feat(board): 업로드 게시판 선택기를 잎새 경로만 나열로"
```

---

## Task 7: 통합 self-test + 최종 검증 + 푸시

**Files:**
- Self-test(미커밋): `ai-program-generator/scripts/selftest-categories.mjs`

- [ ] **Step 1: 통합 self-test 작성 (미커밋, custom token)**

기존 selftest-*.mjs 패턴(예: `scripts/selftest-e2e.mjs`)을 참고해 `scripts/selftest-categories.mjs` 작성. Admin SDK로 custom token 발급 → 클라이언트 SDK로 로그인 → 다음을 검증:

1. admin 토큰으로 `categories` 생성: root(parentId 없음) → child(parentId=root) → grandchild(parentId=child) **성공**.
2. 비-admin 토큰으로 parentId 포함 카테고리 생성 시도 → **규칙 거부**(permission-denied).
3. 잎새(grandchild)에 게시물 1건 생성 → `fetchPosts(grandchild)`가 그 글 **반환**.
4. `deleteCategoryTree(root, all)` 실행 후 grandchild의 게시물·child·grandchild 카테고리가 **모두 사라짐**(getDocs 빈 결과).
5. 정리: 남은 테스트 문서 삭제.

(구현 세부는 기존 selftest 스크립트의 초기화/토큰 발급 헬퍼를 재사용. `serviceAccountKey.json` 로컬 필요.)

- [ ] **Step 2: self-test 실행**

Run: `node scripts/selftest-categories.mjs`
Expected: 각 단계 PASS 로그 + 마지막 `SELFTEST_CATEGORIES_OK`. 실패 시 해당 단계 수정 후 재실행.

- [ ] **Step 3: 푸시 전 점검 — 타입체크 + 프로덕션 빌드**

dev 서버를 멈춘 뒤(.next 공유):
```bash
./node_modules/.bin/tsc --noEmit
npm run build
```
Expected: tsc 에러 0, 빌드 성공(라우트 목록에 `/admin/categories` 포함).

- [ ] **Step 4: diff 검토 후 푸시**

```bash
cd C:/Users/amh47/Documents/test
git status
git log --oneline -7
git push
```
Expected: 깨끗한 상태(미커밋 .mjs/.selftest-build만 남음), 푸시 성공.

---

## 자체 점검 (작성자용 — 스펙 대비)

- **parentId 모델·마이그레이션 제로**: Task 1(타입) + Task 2(addCategory가 root 시 필드 생략) ✓
- **잎새-only**: Task 4(폴더 클릭=펼치기, 잎새=선택) + Task 5(글 있는 폴더 하위추가 금지) + Task 6(업로드 잎새만) ✓
- **깊이 3단**: Task 5(depth<3에서만 [하위 추가]) ✓
- **관리 기능 admin 이전**: Task 4(CategoryBar 제거, 읽기전용) + Task 5(/admin/categories) ✓
- **v1 범위(추가·이름·순서·삭제, reparent 제외)**: Task 5 ✓
- **규칙 parentId 화이트리스트·생성후 불변**: Task 3 ✓
- **인덱스 불변**: 전 태스크에서 posts 쿼리 모양 유지 ✓
- **검증(tsc·빌드·순수 자체점검·통합 self-test·브라우저)**: Task 1·5·6·7 ✓
- **타입 일관성**: `parentId?: string | null`, `buildTree`→`CategoryNode{children,depth}`, `descendantIds(id,all)`, `leafPaths→{id,name,path}`, `deleteCategoryTree(id,all)`, `addCategory(name,order,parentId?)` — 전 태스크 동일 시그니처 사용 ✓
