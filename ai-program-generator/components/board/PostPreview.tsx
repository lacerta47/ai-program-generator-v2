'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, MonitorPlay, Pencil, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { Post } from '@/lib/firebase/types';
import { formatDate } from '@/lib/program';
import { downloadProgramZip } from '@/lib/client/downloadZip';
import Button from '@/components/ui/Button';
import FloatingShapes from '@/components/ui/FloatingShapes';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import EmptyParticles from '@/components/fx/EmptyParticles';

export default function PostPreview({ post, canEdit }: { post: Post | null; canEdit?: boolean }) {
  const [planOpen, setPlanOpen] = useState(false);
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
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {canEdit && (
            <Button variant="soft" onClick={() => router.push(`/?edit=${post.id}`)} className="min-h-10 px-3 text-[14px]">
              <Pencil size={16} aria-hidden /> 고치기
            </Button>
          )}
          {post.prompt && (
            <Button variant="ghost" onClick={() => setPlanOpen(true)} className="min-h-10 px-3 text-[14px]">
              <FileText size={16} aria-hidden /> 계획서
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => downloadProgramZip(post.code, post.title)}
            className="min-h-10 px-3 text-[14px]"
          >
            <Download size={16} aria-hidden /> 저장
          </Button>
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
