'use client';
import { use, useState } from 'react';

// FullscreenFrame의 previewOrigin 로직과 동일(로컬 localhost↔127 스왑 / 배포 NEXT_PUBLIC_PREVIEW_ORIGIN)
function previewOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  return process.env.NEXT_PUBLIC_PREVIEW_ORIGIN ?? `${protocol}//${hostname}${p}`;
}

export default function SharePage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = use(params);
  const [pin, setPin] = useState('');
  const [view, setView] = useState<{ src: string; title: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/share/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? '열 수 없어요.'); return; }
      setView({ src: `${previewOrigin()}/api/preview/${data.previewId}`, title: data.title });
    } catch { setError('연결에 실패했어요.'); }
    finally { setBusy(false); }
  }

  if (view) {
    return (
      <main className="min-h-screen p-4">
        <h1 className="mb-3 text-center text-[20px]">{view.title}</h1>
        <iframe src={view.src} title={view.title} sandbox="allow-scripts" className="mx-auto h-[80vh] w-full max-w-3xl rounded-[var(--r-lg)] border-2 border-line bg-white" />
        <p className="mt-3 text-center text-[13px] text-muted">보기 전용이에요.</p>
      </main>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3 text-center">
        <h1 className="text-[22px]">작품 보기</h1>
        <p className="text-[14px] text-muted">선생님이 알려준 관람 PIN을 넣어 주세요.</p>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" maxLength={8}
          className="rounded-[var(--r-md)] border-2 border-line px-4 py-3 text-center text-[18px]" placeholder="관람 PIN" />
        {error && <p className="rounded-[var(--r-md)] bg-coral-soft px-3 py-2 text-[14px] text-coral-ink">{error}</p>}
        <button type="submit" disabled={busy} className="press rounded-[var(--r-md)] bg-brand px-4 py-3 text-white">{busy ? '여는 중…' : '작품 보기'}</button>
      </form>
    </main>
  );
}
