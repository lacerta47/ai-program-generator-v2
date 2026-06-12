'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, MonitorPlay, Pencil, X, Link2, Check, GitFork } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { Post } from '@/lib/firebase/types';
import { formatDate } from '@/lib/program';
import { downloadProgram, sharePostUrl } from '@/lib/client/postActions';
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
}: {
  post: Post | null;
  canEdit?: boolean;
  canFork?: boolean;
  onFork?: (post: Post) => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
          <Button variant="ghost" size="icon" onClick={() => downloadProgram(post.code, post.title, toast)} aria-label="ZIP 저장" title="ZIP 저장" className="rounded-full">
            <Download size={18} aria-hidden />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => router.push(`/?edit=${post.id}`)} aria-label="고치기" title="고치기" className="rounded-full">
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

      <FullscreenFrame
        frameKey={post.id}
        code={post.code}
        title={post.title}
        className="min-h-[52vh] w-full flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line"
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
    </div>
  );
}
