'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileCode2, Plus, Pencil, ArrowUp, ArrowDown, Trash2, Lock, Globe, RotateCcw } from 'lucide-react';
import type { Category } from '@/lib/firebase/types';
import { buildTree, depthOf, descendantIds, type CategoryNode } from '@/lib/board/categoryTree';
import { authedJson } from '@/lib/client/authedFetch';
import type { CategoryStat } from '@/app/api/admin/categories/stats/route';
import {
  subscribeCategories,
  addCategory,
  renameCategory,
  swapCategoryOrder,
  deleteCategoryTree,
  categoryHasPosts,
} from '@/lib/firebase/categories';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';

const FAIL = '문제가 생겼어요. 인터넷 연결이나 권한을 확인하고 다시 해볼까요?';

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding] = useState<string | 'root' | null>(null); // 부모 id 또는 'root'
  const [addName, setAddName] = useState('');
  // 게시판별 주인·작품 수. 실시간이 아니라 스냅샷이라 추가·삭제 후엔 새로고침 버튼으로 다시 읽는다
  // (구독으로 만들면 count 집계를 매 변경마다 다시 돌려야 해 관리 화면치고 과하다).
  const [stats, setStats] = useState<Record<string, CategoryStat> | null>(null);
  const [statsError, setStatsError] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  useEffect(() => subscribeCategories(setCategories, () => toast(FAIL)), [toast]);

  const loadStats = useCallback(() => {
    setStatsError(false);
    authedJson<{ stats: Record<string, CategoryStat> }>('/api/admin/categories/stats')
      .then((d) => setStats(d.stats))
      .catch((e) => {
        console.error('게시판 정보 조회 실패:', e);
        setStatsError(true);
      });
  }, []);

  useEffect(() => loadStats(), [loadStats]);

  const tree = buildTree(categories);

  /** 폴더는 자기 글이 없으므로(글 있는 폴더엔 하위를 못 만든다) 후손 합계를 보여준다. */
  const postCountOf = (id: string): number | null => {
    if (!stats) return null;
    const own = stats[id]?.postCount ?? 0;
    if (own < 0) return null; // 서버에서 이 보드만 집계 실패
    const kids = descendantIds(id, categories).filter((x) => x !== id);
    return kids.reduce((sum, k) => sum + Math.max(0, stats[k]?.postCount ?? 0), own);
  };

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
        if (await categoryHasPosts(parentId)) {
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
      !(await confirm({
        title: '게시판을 삭제할까요?',
        message: `'${node.name}'${node.children.length ? '과 그 안의 모든 하위 게시판' : ''}, 그리고 안의 모든 작품을 삭제해요. 되돌릴 수 없어요.`,
        confirmLabel: '삭제',
        danger: true,
      }))
    )
      return;
    try {
      await deleteCategoryTree(node.id);
    } catch (e) {
      console.error('삭제 실패:', e);
      toast(FAIL);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[24px]">게시판 관리</h1>
        <div className="ml-auto flex items-center gap-2">
          <ManageBtn label="정보 새로고침" onClick={loadStats}>
            <RotateCcw size={15} />
          </ManageBtn>
        </div>
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

      {statsError && (
        <p className="text-[14px] text-coral-ink">
          게시판 주인·작품 수를 불러오지 못했어요. 새로고침 버튼으로 다시 시도해 주세요.
        </p>
      )}

      {categories.length === 0 ? (
        <p className="py-4 text-[15px] text-muted">아직 게시판이 없어요. 최상위 폴더부터 만들어 보세요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tree.map((node) => (
            <ManagerRow
              key={node.id}
              node={node}
              categories={categories}
              stats={stats}
              postCountOf={postCountOf}
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
  stats,
  postCountOf,
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
  stats: Record<string, CategoryStat> | null;
  postCountOf: (id: string) => number | null;
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
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px]">{node.name}</span>
            <BoardMeta node={node} stats={stats} count={postCountOf(node.id)} isFolder={isFolder} />
          </span>
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
              stats={stats}
              postCountOf={postCountOf}
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

/**
 * 게시판 한 줄 아래 붙는 정보 — 주인(공개/교실)과 작품 수.
 * 주인을 굳이 표시하는 이유: 관리자 화면엔 여러 학교의 교실 보드가 함께 늘어서므로,
 * '누구 반인지' 모르면 삭제·정리 판단을 할 수 없다. 교사 로그인 아이디(=학생 로그인의 학교 코드)를
 * 함께 보여 문의가 왔을 때 계정을 바로 짚을 수 있게 한다.
 */
function BoardMeta({
  node,
  stats,
  count,
  isFolder,
}: {
  node: CategoryNode;
  stats: Record<string, CategoryStat> | null;
  count: number | null;
  isFolder: boolean;
}) {
  const s = stats?.[node.id];
  const classroom = !!node.teacherUid;

  // 교사 표기: 이름(아이디) → 이름만 → 아이디만 → uid 앞자리(문서가 사라진 경우)
  let owner: string;
  if (!classroom) {
    owner = '관리자가 만든 공개 게시판';
  } else if (!stats) {
    owner = '교실 게시판';
  } else if (s?.ownerMissing) {
    owner = `교실 게시판 · 삭제된 교사(${node.teacherUid!.slice(0, 6)}…)`;
  } else {
    const name = s?.ownerName?.trim();
    const id = s?.ownerLoginId?.trim();
    const who = name && id ? `${name}(${id})` : name || id || `${node.teacherUid!.slice(0, 6)}…`;
    owner = `교실 게시판 · ${who}${s?.ownerDisabled ? ' · 정지됨' : ''}`;
  }

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] text-muted">
      {classroom ? (
        <Lock size={12} aria-hidden className="shrink-0" />
      ) : (
        <Globe size={12} aria-hidden className="shrink-0" />
      )}
      <span className={s?.ownerDisabled || s?.ownerMissing ? 'text-coral-ink' : undefined}>{owner}</span>
      <span aria-hidden>·</span>
      <span>
        {count === null ? '작품 …' : `작품 ${count}개`}
        {isFolder && count !== null && count > 0 ? ' (하위 포함)' : ''}
      </span>
    </span>
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
