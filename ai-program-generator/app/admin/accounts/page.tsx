'use client';

import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { getConfig, setConfig } from '@/lib/admin/accounts';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';

export default function AdminSettingsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
          <h1 className="text-[24px]">전역 설정</h1>
          <GlobalLimit />
        </div>
      </AdminGate>
    </main>
  );
}

function GlobalLimit() {
  const { toast } = useToast();
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getConfig()
      .then((c) => { if (alive) setLimit(String(c.dailyLimit)); })
      .catch((e) => console.error('한도 불러오기 실패:', e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function save() {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) {
      toast('한도는 0 이상의 정수여야 해요.');
      return;
    }
    setBusy(true);
    try {
      await setConfig(n);
      toast('전역 한도를 바꿨어요.', 'success');
    } catch (e) {
      console.error(e);
      toast('한도를 바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <h2 className="mb-1 flex items-center gap-2 text-[18px]">
        <Settings2 size={18} aria-hidden /> 전역 일일 한도
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        모든 학생이 하루에 만들 수 있는 기본 횟수예요. (학생별 조절은 가입자 목록에서)
      </p>
      {loading ? (
        <LoadingDots label="불러오는 중…" />
      ) : (
        <div className="flex items-end gap-2">
          <Label text="하루 횟수">
            <TextInput type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} className="w-28" />
          </Label>
          <Button variant="primary" onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</Button>
        </div>
      )}
    </section>
  );
}
