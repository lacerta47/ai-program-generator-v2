'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Undo2 } from 'lucide-react';
import type { WorkHistory } from '@/lib/creator/workHistory';
import Button from '@/components/ui/Button';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import Modal from '@/components/ui/Modal';

interface Props {
  history: WorkHistory;
  onRestore: (id: number) => void;
  firstLabel?: string;
}

export default function WorkHistoryControls({ history, onRestore, firstLabel = '처음 만든 작품' }: Props) {
  const [open, setOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previous = history.versions.find((version) => version.id === history.current.parentId);
  const preview = history.versions.find((version) => version.id === previewId);
  const close = useCallback(() => {
    setOpen(false);
    setPreviewId(null);
  }, []);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open, previewId]);

  if (history.versions.length < 2) return null;

  return (
    <section aria-label="작품 되돌리기" className="flex min-w-0 flex-wrap items-center gap-2">
      <Button type="button" variant="soft" disabled={!previous} onClick={() => previous && onRestore(previous.id)}>
        <Undo2 size={18} aria-hidden /> 바로 전으로
      </Button>
      <Button type="button" onClick={() => setOpen(true)}>
        <History size={18} aria-hidden /> 고친 기록
      </Button>
      <Modal
        open={open}
        onClose={close}
        label={preview ? '이전 작품 미리보기' : '고친 기록'}
        className="max-w-2xl p-4 sm:p-6"
        aboveNotifications
      >
        {preview ? (
          <div className="flex flex-col gap-3">
            <h3 ref={titleRef} tabIndex={-1} className="text-[22px]">이전 작품을 보고 있어요</h3>
            <p className="break-words text-[17px] text-muted">{preview.request ?? firstLabel}</p>
            <FullscreenFrame
              code={preview.code}
              photo={preview.photo ?? undefined}
              title="이전 작품"
              className="h-[46dvh] min-h-48 w-full rounded-[var(--r-md)] border-2 border-line"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setPreviewId(null)}>기록으로</Button>
              <Button type="button" variant="primary" onClick={() => { onRestore(preview.id); close(); }}>
                이 작품 쓰기
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h3 ref={titleRef} tabIndex={-1} className="text-[22px]">고친 기록</h3>
            <p className="text-[17px] text-muted">지금 작업하는 동안만 볼 수 있어요.</p>
            <ul className="grid gap-2">
              {[...history.versions].reverse().map((version) => (
                <li key={version.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--r-md)] border-2 border-line p-3">
                  <div className="min-w-0 flex-1 break-words">
                    <p className="font-medium">{version.id === 1 ? firstLabel : `${version.id - 1}번째 고치기`}</p>
                    {version.request && <p className="line-clamp-2 text-[17px] text-muted">{version.request}</p>}
                  </div>
                  {version.id === history.current.id ? (
                    <span className="text-[17px] font-medium text-brand-strong dark:text-brand">지금 쓰는 작품</span>
                  ) : (
                    <Button type="button" onClick={() => setPreviewId(version.id)}>미리 보기</Button>
                  )}
                </li>
              ))}
            </ul>
            <Button type="button" onClick={close} className="self-end">닫기</Button>
          </div>
        )}
      </Modal>
    </section>
  );
}
