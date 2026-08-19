'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from './Modal';
import Button from './Button';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 공유할 주소(QR·복사 대상) */
  url: string;
  /** 대화상자 제목 */
  title?: string;
  /** 추가 안내(예: 관람 PIN도 함께 알려주기) */
  note?: string;
}

/**
 * 공유 팝업 — QR + 주소 + 복사 버튼. 작품 공유·교실 관람 공유가 함께 쓴다.
 * QR은 순수 오프라인 생성(qrcode.react)이라 주소가 외부로 나가지 않는다.
 * QR은 스캔되려면 다크모드에서도 흰 배경 위 검은 코드여야 하므로 흰 박스에 고정.
 */
export default function ShareDialog({ open, onClose, url, title = '공유하기', note }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast('주소를 복사했어요!', 'success');
    } catch {
      toast('복사를 못 했어요.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} label={title} className="max-w-xs p-6">
      <h2 className="mb-1 text-center text-[19px]">{title}</h2>
      <p className="mb-4 text-center text-[13px] text-muted">QR을 찍거나 주소를 복사해서 보내요.</p>
      <div className="mx-auto mb-4 w-fit rounded-[16px] border-2 border-line bg-white p-4">
        {url && <QRCodeSVG value={url} size={176} level="M" marginSize={0} />}
      </div>
      <p className="mb-3 break-all rounded-[var(--r-md)] border-2 border-line bg-surface-2 px-3 py-2 text-center text-[13px] text-ink">
        {url}
      </p>
      {note && <p className="mb-3 text-center text-[13px] text-coral-ink">{note}</p>}
      <div className="flex justify-center gap-2">
        <Button variant="primary" onClick={copy}>
          {copied ? '복사됨!' : '주소 복사'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  );
}
