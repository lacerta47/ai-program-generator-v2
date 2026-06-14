'use client';

import { useState } from 'react';
import type { Post } from '@/lib/firebase/types';
import { submitReport } from '@/lib/firebase/reports';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const REASONS = ['나쁜 말', '이상해요', '불쾌해요', '기타'] as const;

export default function ReportDialog({
  open,
  onClose,
  post,
  reporterUid,
}: {
  open: boolean;
  onClose: () => void;
  post: Post;
  reporterUid: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await submitReport(post, reporterUid, reason, memo);
      toast('신고를 접수했어요. 관리자가 확인 후 처리할게요.', 'success');
      setMemo('');
      onClose();
    } catch (e) {
      console.error('신고 실패:', e);
      toast('신고하지 못했어요. 잠시 후 다시 해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="작품 신고" className="max-w-xs p-6">
      <h2 className="mb-3 text-[20px]">무엇이 문제인가요?</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`press rounded-full border-2 px-3 py-1.5 text-[14px] ${
              reason === r
                ? 'border-coral bg-coral-soft text-coral-ink'
                : 'border-line text-muted hover:border-coral/50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <TextArea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="자세히 알려주세요 (선택)"
        maxLength={500}
        rows={3}
        className="mb-3"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={submit} disabled={busy}>
          {busy ? '보내는 중…' : '신고 보내기'}
        </Button>
      </div>
    </Modal>
  );
}
