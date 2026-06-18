'use client';

import { useEffect, useState } from 'react';
import { Trash2, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { fetchReports, dismissReportsForPost, type Report } from '@/lib/firebase/reports';
import { deletePost } from '@/lib/firebase/posts';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';

interface ReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  items: Report[];
}

function groupReports(reports: Report[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const r of reports) {
    const g = map.get(r.postId);
    if (g) {
      g.items.push(r);
    } else {
      map.set(r.postId, {
        postId: r.postId,
        postTitle: r.postTitle,
        postAuthorName: r.postAuthorName,
        items: [r],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export default function ReportsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <ReportsContent />
      </AdminGate>
    </main>
  );
}

function ReportsContent() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .catch((e) => {
        console.error('신고 목록 불러오기 실패:', e);
        setReports([]);
      });
  }, []);

  async function handleDelete(postId: string) {
    if (!(await confirm({ title: '작품을 삭제할까요?', message: '신고된 이 작품을 삭제해요. 되돌릴 수 없어요.', confirmLabel: '삭제', danger: true }))) return;
    try {
      await deletePost(postId);
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('작품을 삭제했어요.', 'success');
    } catch (e) {
      console.error('작품 삭제 실패:', e);
      toast('삭제하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  async function handleDismiss(postId: string) {
    try {
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('신고를 정리했어요.', 'success');
    } catch (e) {
      console.error('신고 무시 실패:', e);
      toast('처리하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  const groups = reports ? groupReports(reports) : null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">신고 처리</h1>
      {groups === null ? (
        <div className="py-10">
          <LoadingDots label="신고를 불러오는 중…" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-[15px] text-muted">처리할 신고가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <ReportCard key={g.postId} group={g} onDelete={handleDelete} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  group,
  onDelete,
  onDismiss,
}: {
  group: ReportGroup;
  onDelete: (postId: string) => void;
  onDismiss: (postId: string) => void;
}) {
  return (
    <div className="anim-pop-in rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[19px]" title={group.postTitle}>
            {group.postTitle}
          </h2>
          <p className="text-[13px] text-muted">
            {group.postAuthorName || '익명'} · 신고 {group.items.length}건
          </p>
        </div>
        <a
          href={`/board?post=${group.postId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-line px-3 py-1.5 text-[13px] text-ink hover:border-brand/50"
        >
          작품 보기 <ExternalLink size={14} aria-hidden />
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {group.items.map((r) => (
          <li key={r.id} className="rounded-[var(--r-md)] border border-line px-3 py-2 text-[14px]">
            <span className="font-medium text-coral-ink">{r.reason}</span>
            {r.memo && <span className="text-ink"> — {r.memo}</span>}
            <span className="ml-2 text-[12px] text-muted">{formatDate(r.createdAt)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDismiss(group.postId)}>
          <Check size={16} aria-hidden /> 신고 무시
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => onDelete(group.postId)}
          className="!bg-coral !text-white hover:!brightness-95"
        >
          <Trash2 size={16} aria-hidden /> 작품 삭제
        </Button>
      </div>
    </div>
  );
}
