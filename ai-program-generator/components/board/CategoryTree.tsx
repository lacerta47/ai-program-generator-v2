'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2, Lock } from 'lucide-react';
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
        {/* 교실 보드 표시 — 관리자는 여러 학교 보드를 함께 보므로 공개 보드와 섞이면 안 된다.
            (교사·학생에게도 '우리 반만 봐요'라는 사실을 그대로 알려주므로 그대로 노출) */}
        {node.teacherUid && (
          <Lock size={13} className="ml-auto shrink-0 text-muted" aria-label="교실 보드" />
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
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
