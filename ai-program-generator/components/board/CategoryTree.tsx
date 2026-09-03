'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2, Lock } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';
import { buildTree, countLeaves, pathOf, type CategoryNode } from '@/lib/board/categoryTree';

export interface CategoryGroup {
  /** null이면 소제목 없이 그대로 나열 */
  label: string | null;
  categories: Category[];
}

interface Props {
  /** 그룹별 트리(예: 내 교실 / 모두의 게시판). 없으면 categories를 한 그룹으로. */
  groups?: CategoryGroup[];
  categories?: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function CategoryTree({ groups, categories, selectedId, onSelect }: Props) {
  const resolved: CategoryGroup[] = groups ?? [{ label: null, categories: categories ?? [] }];
  const all = resolved.flatMap((g) => g.categories);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // 선택/딥링크된 잎새의 조상 자동 펼침
  const allKey = all.map((c) => c.id + (c.parentId ?? '')).join('|');
  useEffect(() => {
    if (!selectedId) return;
    const anc = pathOf(selectedId, all)
      .slice(0, -1)
      .map((c) => c.id);
    if (anc.length) setExpanded((prev) => new Set([...prev, ...anc]));
    // all은 매 렌더 새 배열이라 내용 키로 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, allKey]);

  if (all.length === 0) {
    return <p className="py-2 text-[15px] text-muted">아직 게시판이 없어요.</p>;
  }

  // 접힌 폴더 안에 선택 잎새가 숨어 있을 때 폴더를 강조하기 위한 조상 집합
  const selectedAncestors = new Set(
    selectedId ? pathOf(selectedId, all).slice(0, -1).map((c) => c.id) : [],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {resolved.map((g, i) => {
        const tree = buildTree(g.categories);
        if (tree.length === 0) return null;
        return (
          <section key={g.label ?? i} aria-label={g.label ?? undefined}>
            {g.label && (
              <p className="mb-1 px-3 text-[13px] font-medium text-muted">{g.label}</p>
            )}
            <ul className="stagger flex flex-col gap-1">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  expanded={expanded}
                  onToggle={toggle}
                  selectedId={selectedId}
                  selectedAncestors={selectedAncestors}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TreeRow({
  node,
  expanded,
  onToggle,
  selectedId,
  selectedAncestors,
  onSelect,
}: {
  node: CategoryNode;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  selectedAncestors: Set<string>;
  onSelect: (id: string) => void;
}) {
  const isFolder = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const active = node.id === selectedId;
  // 접힌 폴더 안에 선택 잎새가 있으면 이름을 브랜드색으로 — 어디 있는지 힌트
  const hidesSelected = isFolder && !isOpen && selectedAncestors.has(node.id);
  const indent = (node.depth - 1) * 16;

  return (
    <li>
      <button
        onClick={() => (isFolder ? onToggle(node.id) : onSelect(node.id))}
        style={{ paddingLeft: indent + 12 }}
        aria-expanded={isFolder ? isOpen : undefined}
        aria-current={active ? 'true' : undefined}
        className={`press flex w-full items-center gap-2 rounded-[var(--r-md)] border-2 py-2.5 pr-3 text-left transition-colors ${
          active
            ? 'border-brand bg-brand-soft font-medium text-brand-strong dark:text-brand'
            : hidesSelected
              ? 'border-transparent font-medium text-brand-strong hover:bg-surface-2 dark:text-brand'
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
        {isFolder && (
          <span
            className="ml-auto shrink-0 rounded-full bg-surface-2 px-2 text-[12px] text-muted"
            aria-label={`게시판 ${countLeaves(node)}개`}
          >
            {countLeaves(node)}
          </span>
        )}
        {/* 교실 보드 표시 — 관리자는 여러 학교 보드를 함께 보므로 공개 보드와 섞이면 안 된다.
            (교사·학생에게도 '우리 반만 봐요'라는 사실을 그대로 알려주므로 그대로 노출) */}
        {node.teacherUid && (
          <Lock
            size={13}
            className={`shrink-0 text-muted ${isFolder ? '' : 'ml-auto'}`}
            aria-label="교실 보드"
          />
        )}
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
              selectedAncestors={selectedAncestors}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
