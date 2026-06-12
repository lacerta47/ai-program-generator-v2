'use client';

import { useCallback, useRef, useState } from 'react';
import { Link2, Check, Download, Pencil, Trash2, FileQuestion } from 'lucide-react';
import type { Post } from '@/lib/firebase/types';
import { updatePostTitle } from '@/lib/firebase/posts';
import { ProfanityError } from '@/lib/moderation';
import { sharePostUrl } from '@/lib/client/postActions';
import { formatDate } from '@/lib/program';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

interface Props {
  posts: Post[];
  selectedPostId: string | null;
  onSelect: (post: Post) => void;
  currentUserUid: string | null;
  isAdmin: boolean;
  onDelete: (post: Post) => void;
  onDownload: (post: Post) => void;
  onTitleSaved: (id: string, title: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export default function PostList({
  posts,
  selectedPostId,
  onSelect,
  currentUserUid,
  isAdmin,
  onDelete,
  onDownload,
  onTitleSaved,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const { toast } = useToast();

  const observer = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loadingMore) return;
      observer.current?.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) onLoadMore();
      });
      if (node) observer.current.observe(node);
    },
    [loadingMore, hasMore, onLoadMore],
  );

  async function saveTitle() {
    const target = editing;
    setEditing(null);
    if (!target || !target.title.trim()) return;
    try {
      await updatePostTitle(target.id, target.title);
      onTitleSaved(target.id, target.title.trim());
    } catch (e) {
      console.error('제목 변경 실패:', e);
      if (e instanceof ProfanityError) {
        toast('제목에 쓸 수 없는 말이 있어요. 고운 말로 바꿔 주세요.');
      } else {
        toast('제목을 바꾸지 못했어요. 인터넷 연결이나 권한을 확인해 주세요.');
      }
    }
  }

  function share(post: Post) {
    sharePostUrl(post, toast, () => {
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(''), 1500);
    });
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-surface-2 text-muted">
          <FileQuestion size={26} aria-hidden />
        </span>
        <p className="text-[15px] text-muted">
          아직 게시물이 없어요.
          <br />첫 번째 작품을 올려 보세요!
        </p>
      </div>
    );
  }

  return (
    <ul className="stagger flex flex-col gap-2 pr-1">
      {posts.map((post) => {
        const canManage = isAdmin || post.ownerUid === currentUserUid;
        const active = post.id === selectedPostId;
        return (
          <li
            key={post.id}
            className={`lift group flex items-center gap-2 rounded-[var(--r-md)] border-2 px-3.5 py-2.5 ${
              active
                ? 'border-brand bg-brand-soft'
                : 'border-line bg-surface hover:border-brand/40'
            }`}
          >
            {editing?.id === post.id ? (
              <TextInput
                autoFocus
                className="min-h-10 flex-1 text-[15px]"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                maxLength={100}
              />
            ) : (
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(post)}
                title={post.title}
              >
                <span
                  className={`block truncate text-[16px] ${
                    active ? 'font-medium text-brand-strong dark:text-brand' : 'text-ink'
                  }`}
                >
                  {post.title}
                </span>
                <span className="block truncate text-[12.5px] text-muted">
                  {post.authorName || '익명'} · {formatDate(post.createdAt)}
                </span>
              </button>
            )}

            <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <Mini label="링크 복사" onClick={() => share(post)}>
                {copiedId === post.id ? (
                  <Check size={16} className="anim-pop text-mint-ink" />
                ) : (
                  <Link2 size={16} />
                )}
              </Mini>
              <Mini label="ZIP 저장" onClick={() => onDownload(post)}>
                <Download size={16} />
              </Mini>
              {canManage && (
                <>
                  <Mini label="제목 바꾸기" onClick={() => setEditing({ id: post.id, title: post.title })}>
                    <Pencil size={16} />
                  </Mini>
                  <Mini label="삭제" danger onClick={() => onDelete(post)}>
                    <Trash2 size={16} />
                  </Mini>
                </>
              )}
            </div>
          </li>
        );
      })}

      <div ref={sentinelRef} className="h-8">
        {loadingMore && <p className="py-1 text-center text-[13px] text-muted">더 불러오는 중…</p>}
      </div>
    </ul>
  );
}

function Mini({
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
      className={`press grid h-9 w-9 place-items-center rounded-[10px] ${
        danger ? 'text-coral-ink hover:bg-coral-soft' : 'text-muted hover:bg-brand-soft hover:text-brand-strong'
      }`}
    >
      {children}
    </button>
  );
}
