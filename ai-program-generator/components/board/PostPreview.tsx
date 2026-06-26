'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, MonitorPlay, Pencil, X, Link2, Check, GitFork, Heart, Eye, Flag, Share2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ReportDialog from './ReportDialog';
import type { Post } from '@/lib/firebase/types';
import { formatDate } from '@/lib/program';
import { downloadProgram, sharePostUrl } from '@/lib/client/postActions';
import { isLiked, toggleLike } from '@/lib/firebase/likes';
import { recordView } from '@/lib/firebase/views';
import Button from '@/components/ui/Button';
import FloatingShapes from '@/components/ui/FloatingShapes';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import EmptyParticles from '@/components/fx/EmptyParticles';
import { useToast } from '@/components/ui/Toast';

export default function PostPreview({
  post,
  canEdit,
  canFork,
  onFork,
  currentUserUid,
  onNeedLogin,
  onLikeChanged,
  onViewChanged,
}: {
  post: Post | null;
  canEdit?: boolean;
  canFork?: boolean;
  onFork?: (post: Post) => void;
  currentUserUid?: string | null;
  onNeedLogin?: () => void;
  onLikeChanged?: (postId: string, delta: number) => void;
  onViewChanged?: (postId: string) => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const togglingLike = useRef(false);
  const { toast } = useToast();
  const router = useRouter();

  // 작품이 바뀌면 카운트 초기화 + (로그인 시) 내 좋아요 여부·조회 기록.
  // post 객체가 아니라 id에만 반응(좋아요 동기화로 객체가 바뀌어도 재초기화 안 함).
  useEffect(() => {
    if (!post) return;
    setLiked(false);
    setLikeCount(post.likeCount ?? 0);
    setViewCount(post.viewCount ?? 0);
    if (!currentUserUid) return;
    let alive = true;
    isLiked(post.id, currentUserUid)
      .then((v) => {
        if (alive) setLiked(v);
      })
      .catch((e) => console.error('isLiked 실패:', e));
    recordView(post.id)
      .then((inc) => {
        if (alive && inc) {
          setViewCount((c) => c + 1);
          onViewChanged?.(post.id);
        }
      })
      .catch((e) => console.error('recordView 실패:', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, currentUserUid]);

  // 교실(비공개) 글은 공개 URL이 없어 /share/<id> + 관람 PIN으로만 외부 공유.
  async function copyShareLink() {
    if (!post) return;
    const url = `${window.location.origin}/share/${post.id}`;
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast('링크를 복사했어요. 관람 PIN과 함께 알려주세요.', 'success');
    } catch {
      toast('링크 복사를 못 했어요.');
    }
  }

  function handleLike() {
    if (!post) return;
    if (!currentUserUid) {
      onNeedLogin?.();
      return;
    }
    if (togglingLike.current) return; // 진행 중 중복 클릭 방지(카운트 드리프트 차단)
    togglingLike.current = true;
    const wasLiked = liked;
    const delta = wasLiked ? -1 : 1;
    setLiked(!wasLiked);
    setLikeCount((c) => c + delta);
    onLikeChanged?.(post.id, delta);
    toggleLike(post.id)
      .catch((e) => {
        console.error('좋아요 실패:', e);
        setLiked(wasLiked);
        setLikeCount((c) => c - delta);
        onLikeChanged?.(post.id, -delta);
        toast('좋아요를 처리하지 못했어요. 잠시 후 다시 해주세요.');
      })
      .finally(() => {
        togglingLike.current = false;
      });
  }

  if (!post) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden rounded-[var(--r-md)] text-center">
        <EmptyParticles />
        <FloatingShapes />
        <div className="relative">
          <h3 className="mb-1 flex items-center justify-center gap-2 text-[20px]">
            <MonitorPlay size={20} className="text-brand" aria-hidden /> 작품 구경하기
          </h3>
          <p className="text-[15px] text-muted">
            왼쪽 목록에서 작품을 고르면
            <br />
            여기에서 바로 실행돼요!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="anim-pop-in flex h-full flex-col gap-3" key={post.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[19px]" title={post.title}>
            {post.title}
          </h3>
          <p className="truncate text-[13px] text-muted">
            {post.authorName || '익명'} · {formatDate(post.createdAt)}
          </p>
          {post.forkedFrom && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-grape-soft px-2 py-0.5 text-[12px] text-grape-ink"
              title={`${post.forkedFromAuthor || '누군가'}의 작품에서 이어 만들었어요`}
            >
              <GitFork size={12} aria-hidden /> 이어 만든 작품
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {currentUserUid !== post.ownerUid && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (currentUserUid ? setReportOpen(true) : onNeedLogin?.())}
              aria-label="신고"
              title="신고"
              className="rounded-full"
            >
              <Flag size={18} aria-hidden />
            </Button>
          )}
          {post.prompt && (
            <Button variant="ghost" size="icon" onClick={() => setPlanOpen(true)} aria-label="계획서 보기" title="계획서 보기" className="rounded-full">
              <FileText size={18} aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              sharePostUrl(post, toast, () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
            aria-label="링크 복사"
            title="링크 복사"
            className="rounded-full"
          >
            {copied ? <Check size={18} className="text-mint-ink" aria-hidden /> : <Link2 size={18} aria-hidden />}
          </Button>
          {post.boardTeacherUid && (
            <Button variant="ghost" size="icon" onClick={copyShareLink} aria-label="공유 링크 복사" title="공유 링크 복사" className="rounded-full">
              <Share2 size={18} aria-hidden />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => downloadProgram(post.code, post.title, toast)} aria-label="ZIP 저장" title="ZIP 저장" className="rounded-full">
            <Download size={18} aria-hidden />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => router.push(`/create?edit=${post.id}`)} aria-label="고치기" title="고치기" className="rounded-full">
              <Pencil size={18} aria-hidden />
            </Button>
          )}
          {canFork && (
            <Button variant="soft" size="icon" onClick={() => onFork?.(post)} aria-label="이어서 만들기" title="이어서 만들기" className="rounded-full">
              <GitFork size={18} aria-hidden />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 text-[14px]">
        <button
          onClick={handleLike}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
          title={liked ? '좋아요 취소' : '좋아요'}
          className="press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-coral-soft"
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} className={liked ? 'text-coral' : 'text-muted'} aria-hidden />
          <span className="font-medium tabular-nums text-ink">{likeCount}</span>
        </button>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-muted" title="이어 만든 횟수">
          <GitFork size={16} aria-hidden /> <span className="tabular-nums">{post.forkCount ?? 0}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-muted" title="본 사람 수">
          <Eye size={16} aria-hidden /> <span className="tabular-nums">{viewCount}</span>
        </span>
      </div>

      <FullscreenFrame
        frameKey={post.id}
        postId={post.boardTeacherUid ? undefined : post.id}
        code={post.code}
        title={post.title}
        className="min-h-[65vh] w-full flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line"
      />

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        label="프로그램 계획서"
        className="max-w-lg p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[20px]">이렇게 계획했어요</h3>
          <Button variant="ghost" size="icon" onClick={() => setPlanOpen(false)} aria-label="닫기" className="h-10 w-10 rounded-full border-0">
            <X size={20} />
          </Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-[var(--r-md)] bg-surface-2 p-4 font-body text-[14.5px] leading-relaxed text-ink">
          {post.prompt}
        </pre>
      </Modal>

      {currentUserUid && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          post={post}
          reporterUid={currentUserUid}
        />
      )}
    </div>
  );
}
