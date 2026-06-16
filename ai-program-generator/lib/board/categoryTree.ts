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
    if (pid) {
      const arr = childrenOf.get(pid) ?? [];
      arr.push(c.id);
      childrenOf.set(pid, arr);
    }
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
      const pid: string | null = cur.parentId ?? null;
      cur = pid ? byId.get(pid) : undefined;
    }
    return parts.join(' / ');
  };
  return categories
    .filter((c) => !parents.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, path: pathOf(c) }))
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'));
}
