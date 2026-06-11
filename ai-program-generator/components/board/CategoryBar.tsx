'use client';

import { useState } from 'react';
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';
import {
  addCategory,
  renameCategory,
  swapCategoryOrder,
  deleteCategoryWithPosts,
} from '@/lib/firebase/categories';
import Chip, { CHIP_COLORS } from '@/components/ui/Chip';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isAdmin: boolean;
}

export default function CategoryBar({ categories, selectedId, onSelect, isAdmin }: Props) {
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const idx = categories.findIndex((c) => c.id === selectedId);
  const current = categories[idx];

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await addCategory(newName, categories.length);
    setNewName('');
  }

  async function handleRename() {
    if (editing && editing.name.trim()) await renameCategory(editing.id, editing.name);
    setEditing(null);
  }

  async function move(dir: 'up' | 'down') {
    const t = idx + (dir === 'up' ? -1 : 1);
    if (idx < 0 || t < 0 || t >= categories.length) return;
    await swapCategoryOrder(categories[idx], categories[t]);
  }

  async function handleDelete() {
    if (!current) return;
    if (confirm(`'${current.name}' 게시판과 그 안의 모든 게시물을 삭제할까요?`)) {
      await deleteCategoryWithPosts(current.id);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 카테고리 칩들 — 알록달록, 선택 시 채워짐 */}
      <div className="stagger flex flex-wrap gap-2">
        {categories.length === 0 && (
          <p className="text-[15px] text-muted">아직 게시판이 없어요.</p>
        )}
        {categories.map((c, i) =>
          editing && editing.id === c.id ? (
            <TextInput
              key={c.id}
              autoFocus
              className="min-h-11 w-44 rounded-full"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          ) : (
            <Chip
              key={c.id}
              color={CHIP_COLORS[i % CHIP_COLORS.length]}
              active={c.id === selectedId}
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </Chip>
          ),
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2.5 rounded-[var(--r-md)] bg-surface-2 p-3">
          {current && !editing && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[13px] text-muted">‘{current.name}’ 관리:</span>
              <IconBtn label="위로 이동" onClick={() => move('up')}><ArrowUp size={16} /></IconBtn>
              <IconBtn label="아래로 이동" onClick={() => move('down')}><ArrowDown size={16} /></IconBtn>
              <IconBtn label="이름 바꾸기" onClick={() => setEditing({ id: current.id, name: current.name })}>
                <Pencil size={16} />
              </IconBtn>
              <IconBtn label="게시판 삭제" danger onClick={handleDelete}><Trash2 size={16} /></IconBtn>
            </div>
          )}
          <form onSubmit={handleAdd} className="flex gap-2">
            <TextInput
              className="min-h-11 flex-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 게시판 이름"
            />
            <Button type="submit" variant="primary" className="min-h-11 px-4">
              <Plus size={17} aria-hidden /> 추가
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function IconBtn({
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
      className={`press grid h-10 w-10 place-items-center rounded-[10px] border-2 border-line bg-surface ${
        danger ? 'text-coral-ink hover:border-coral/60 hover:bg-coral-soft' : 'text-muted hover:border-brand/50 hover:text-brand-strong'
      }`}
    >
      {children}
    </button>
  );
}
