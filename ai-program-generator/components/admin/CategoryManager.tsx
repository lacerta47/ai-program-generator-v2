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
