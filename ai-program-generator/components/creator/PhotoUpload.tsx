'use client';
import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { compressImage } from '@/lib/client/imageCompress';
import Button from '@/components/ui/Button';

/** 사진 1장 업로드(압축 후 data-URI). 학생/교사 생성 화면에만 렌더. value/onChange로 부모가 상태 보유. */
export default function PhotoUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 사진 국외 이전(→ Google Gemini, 미국) 별도 동의. 체크해야만 첨부(=전송)할 수 있어,
  // 동의 없이 사진이 해외 AI로 전송되는 일이 없다. (개인정보처리방침 §5 '선택 이전' 대응)
  const [agreed, setAgreed] = useState(false);
  async function pick(file: File) {
    setBusy(true);
    setError('');
    try {
      onChange(await compressImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : '사진을 못 올렸어요.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative w-fit">
          <img src={value} alt="올린 사진" className="h-28 rounded-[var(--r-md)] border-2 border-line object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="사진 빼기"
            className="press absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-line bg-surface"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <>
          <label className="flex items-start gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
            />
            <span>
              사진이 프로그램 제작을 위해 <strong>해외 AI(Google Gemini, 미국)</strong>로 전송되는 것에 동의해요.{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-brand-strong underline">
                개인정보처리방침
              </a>{' '}
              (선택)
            </span>
          </label>
          <Button
            type="button"
            variant="soft"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !agreed}
            title={!agreed ? '먼저 사진 전송 동의에 체크해 주세요.' : undefined}
            className="w-fit"
          >
            <ImagePlus size={18} aria-hidden /> {busy ? '사진 줄이는 중…' : '사진 올리기(선택)'}
          </Button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = '';
        }}
      />
      {error && <p className="text-[13px] text-coral-ink">{error}</p>}
      <p className="text-[12.5px] text-muted">사진은 <b>AI가 보고</b> 프로그램을 만들어요. 우리 반과 선생님만 볼 수 있어요. 친구·가족 얼굴은 올리지 않는 게 좋아요.</p>
    </div>
  );
}
