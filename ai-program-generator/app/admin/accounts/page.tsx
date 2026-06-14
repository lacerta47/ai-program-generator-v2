'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users2, Copy, Check, Settings2 } from 'lucide-react';
import { createAccounts, getConfig, setConfig, type CreateResult } from '@/lib/admin/accounts';
import { useToast } from '@/components/ui/Toast';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';

export default function AdminAccountsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4 sm:p-6">
          <h1 className="text-[24px]">계정 관리</h1>
          <GlobalLimit />
          <CreateForms />
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

function CreateForms() {
  const { toast } = useToast();
  const [result, setResult] = useState<CreateResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [singlePw, setSinglePw] = useState('');
  const [prefix, setPrefix] = useState('');
  const [count, setCount] = useState('10');
  const [batchPw, setBatchPw] = useState('');

  async function run(fn: () => Promise<CreateResult>) {
    setBusy(true);
    setResult(null);
    try {
      const r = await fn();
      setResult(r);
      if (r.created.length) toast(`${r.created.length}개 계정을 만들었어요.`, 'success');
      else toast('새로 만든 계정이 없어요.');
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : '계정을 만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[18px]"><UserPlus size={18} aria-hidden /> 개별 만들기</h2>
        <div className="flex flex-col gap-3">
          <Label text="아이디(이메일)">
            <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hong@class.kr" />
          </Label>
          <Label text="비밀번호 (6자 이상)">
            <TextInput type="password" value={singlePw} onChange={(e) => setSinglePw(e.target.value)} />
          </Label>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => createAccounts({ mode: 'single', email: email.trim(), password: singlePw }))}
            >
              만들기
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[18px]"><Users2 size={18} aria-hidden /> 반 단위로 만들기</h2>
        <p className="mb-3 text-[13px] text-muted">아이디는 <span className="text-ink">반이름-01@class.kr</span> 처럼 자동으로 붙어요.</p>
        <div className="flex flex-col gap-3">
          <Label text="반 이름 (영문 소문자·숫자·-)">
            <TextInput value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="3-1" />
          </Label>
          <div className="flex flex-wrap gap-3">
            <Label text="인원수 (1~50)">
              <TextInput type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
            </Label>
            <Label text="반 공통 비밀번호 (6자 이상)">
              <TextInput type="password" value={batchPw} onChange={(e) => setBatchPw(e.target.value)} />
            </Label>
          </div>
          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => run(() => createAccounts({ mode: 'batch', prefix: prefix.trim(), count: Number(count), password: batchPw }))}
            >
              만들기
            </Button>
          </div>
        </div>
      </section>

      {result && <ResultPanel result={result} />}
    </>
  );
}

function ResultPanel({ result }: { result: CreateResult }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = result.created.map((c) => `${c.email}\t${c.password}`).join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast('복사했어요.', 'success');
      },
      () => toast('복사하지 못했어요.'),
    );
  }

  return (
    <section className="rounded-[var(--r-lg)] border-2 border-mint/50 bg-mint-soft/40 p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[18px]">만든 계정 ({result.created.length})</h2>
        {result.created.length > 0 && (
          <Button variant="soft" onClick={copyAll}>
            {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} 전체 복사
          </Button>
        )}
      </div>
      <p className="mb-3 text-[13px] text-coral-ink">비밀번호는 지금만 볼 수 있어요. 꼭 복사해 두세요.</p>
      {result.created.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--r-md)] border border-line bg-surface">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] text-muted">
              <tr><th className="p-2.5 font-medium">아이디</th><th className="p-2.5 font-medium">비밀번호</th></tr>
            </thead>
            <tbody>
              {result.created.map((c) => (
                <tr key={c.email} className="border-t border-line">
                  <td className="p-2.5">{c.email}</td>
                  <td className="p-2.5">{c.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.skipped.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[14px] text-muted">건너뛴 계정 ({result.skipped.length}):</p>
          <ul className="flex flex-col gap-1 text-[13px] text-muted">
            {result.skipped.map((s) => (
              <li key={s.email}>{s.email} — {s.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
