'use client';

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';
import { listTeachers, createTeacher, patchTeacher, deleteTeacher, type Teacher } from '@/lib/admin/teachers';

export default function AdminTeachersPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <Content />
      </AdminGate>
    </main>
  );
}

function Content() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const reload = () =>
    listTeachers()
      .then((r) => setTeachers(r.teachers))
      .catch((e) => {
        console.error('선생님 목록 조회 실패:', e);
        toast('선생님 목록을 불러오지 못했어요.');
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const totalQuota = Number(quota);
    if (!Number.isInteger(totalQuota) || totalQuota < 0) {
      toast('총 한도는 0 이상의 정수로 적어 주세요.');
      return;
    }
    setBusy(true);
    try {
      const r = await createTeacher({ loginId: loginId.trim(), password, name: name.trim(), totalQuota });
      setCreated({ email: r.email, password });
      setLoginId('');
      setPassword('');
      setName('');
      setQuota('');
      toast('선생님 계정을 만들었어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function changeQuota(t: Teacher) {
    const v = window.prompt(`${t.name} 선생님 총 한도 (누적 횟수)`, String(t.totalQuota));
    if (v === null) return;
    const q = Number(v);
    if (!Number.isInteger(q) || q < 0) {
      toast('0 이상의 정수로 적어 주세요.');
      return;
    }
    try {
      await patchTeacher(t.uid, { totalQuota: q });
      toast('총 한도를 바꿨어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

  async function remove(t: Teacher) {
    const ok = await confirm({
      title: '선생님 삭제',
      message: `${t.name} 선생님 계정을 삭제할까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTeacher(t.uid);
      toast('삭제했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 flex items-center gap-2 text-[24px]">
        <GraduationCap size={24} aria-hidden /> 선생님 관리
      </h1>

      <form onSubmit={submit} className="mb-6 flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <Label text="아이디 (영문 소문자·숫자·-)" required>
          <TextInput value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="teacher1" required />
        </Label>
        <Label text="비밀번호 (6자 이상)" required>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Label>
        <Label text="표시명 (게시판 이름으로 쓰여요)" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="김선생" required />
        </Label>
        <Label text="총 한도 (누적 횟수)" required>
          <TextInput inputMode="numeric" value={quota} onChange={(e) => setQuota(e.target.value)} placeholder="2000" required />
        </Label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '만드는 중…' : '선생님 만들기'}
        </Button>
        {created && (
          <p className="rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[14px] text-mint-ink">
            만들었어요! 아이디 <b>{created.email}</b> / 비밀번호 <b>{created.password}</b> — 선생님께 전달하세요.
          </p>
        )}
      </form>

      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="py-12"><LoadingDots label="확인 중…" /></div>
        ) : teachers.length === 0 ? (
          <p className="py-8 text-center text-muted">아직 선생님이 없어요.</p>
        ) : (
          teachers.map((t) => (
            <div key={t.uid} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-[16px]">
                  {t.name || '(이름 없음)'} {t.disabled && <span className="text-coral-ink">· 정지됨</span>}
                </p>
                <p className="truncate text-[13px] text-muted">{t.email} · 총 한도 {t.totalQuota}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="soft" onClick={() => changeQuota(t)}>한도</Button>
                <Button variant="ghost" onClick={() => remove(t)}>삭제</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
