'use client';

import { ChevronDown, FileCode2, Lock } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';

interface Props {
  /** 루트 → 현재 게시판 순서의 경로. 비어 있으면 아직 고르지 않은 상태. */
  path: Category[];
  open: boolean;
  onToggle: () => void;
  /** 교실 보드(교사·그 반 학생만 보는 보드)인가 */
  locked: boolean;
}

/** 지금 보고 있는 게시판을 한 줄로 보여주고, 누르면 게시판 트리를 펼치는 칩. */
export default function BoardChip({ path, open, onToggle, locked }: Props) {
  const leaf = path[path.length - 1];
  const parents = path.slice(0, -1);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls="board-tree"
      title={open ? '게시판 목록 닫기' : '게시판 바꾸기'}
      className={`press flex w-full items-center gap-2 rounded-[var(--r-md)] border-2 px-3 py-2.5 text-left transition-colors ${
        open ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2 hover:border-brand/50'
      }`}
    >
      {locked ? (
        <Lock size={17} className="shrink-0 text-muted" aria-label="교실 보드" />
      ) : (
        <FileCode2 size={17} className="shrink-0 text-brand" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-[15.5px]">
        {leaf ? (
          <>
            {parents.map((p) => (
              <span key={p.id} className="text-muted">
                {p.name} <span aria-hidden>›</span>{' '}
              </span>
            ))}
            <span className="font-medium text-ink">{leaf.name}</span>
          </>
        ) : (
          <span className="text-muted">게시판 고르기</span>
        )}
      </span>
      <ChevronDown
        size={18}
        aria-hidden
        className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
  );
}
