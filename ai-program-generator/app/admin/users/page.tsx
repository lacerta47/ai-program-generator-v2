'use client';

import { useEffect, useMemo, useState } from 'react';
import { CloudOff, RotateCcw, Search, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { fetchMembers, type Member } from '@/lib/admin/members';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';

type SortKey = 'usage' | 'created';

/** 최근 7일 합계 + 추세(최근 3일 vs 앞 3일 합 비교, 가운데 날 제외). */
function WeekUsage({ usage7d }: { usage7d: number[] }) {
  const sum = usage7d.reduce((a, b) => a + b, 0);
  const early = usage7d.slice(0, 3).reduce((a, b) => a + b, 0);
  const late = usage7d.slice(4, 7).reduce((a, b) => a + b, 0);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{sum}회</span>
      {late > early ? (
        <ArrowUpRight size={16} className="text-mint-ink" aria-hidden />
      ) : late < early ? (
        <ArrowDownRight size={16} className="text-muted" aria-hidden />
      ) : (
        <Minus size={16} className="text-muted" aria-hidden />
      )}
    </span>
  );
}

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <UsersContent />
      </AdminGate>
    </main>
  );
}

function UsersContent() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [usageLimit, setUsageLimit] = useState(30);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('usage');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    setMembers(null);
    fetchMembers()
      .then((r) => {
        if (!alive) return;
        setMembers(r.members);
        setUsageLimit(r.usageLimit);
      })
      .catch((e) => {
        console.error('가입자 불러오기 실패:', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const rows = useMemo(() => {
    if (!members) return [];
    const term = q.trim().toLowerCase();
    const filtered = term
      ? members.filter(
          (m) =>
            (m.nickname ?? '').toLowerCase().includes(term) ||
            (m.email ?? '').toLowerCase().includes(term),
        )
      : members;
    return [...filtered].sort((a, b) =>
      sort === 'usage' ? b.usageToday - a.usageToday : b.createdAt - a.createdAt,
    );
  }, [members, q, sort]);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">가입자</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="닉네임·이메일 검색"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          <Button variant={sort === 'usage' ? 'soft' : 'ghost'} onClick={() => setSort('usage')}>
            사용량순
          </Button>
          <Button variant={sort === 'created' ? 'soft' : 'ghost'} onClick={() => setSort('created')}>
            가입순
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-coral-soft text-coral-ink">
            <CloudOff size={26} aria-hidden />
          </span>
          <p className="text-[15px] text-muted">가입자를 불러오지 못했어요.</p>
          <Button variant="soft" onClick={() => setReloadKey((k) => k + 1)}>
            <RotateCcw size={16} aria-hidden /> 다시 시도
          </Button>
        </div>
      ) : members === null ? (
        <div className="py-12">
          <LoadingDots label="불러오는 중…" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-muted">
          {members.length === 0 ? '가입자가 없어요.' : '검색 결과가 없어요.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--r-lg)] border-2 border-line">
          <table className="w-full min-w-[680px] text-left text-[14px]">
            <thead className="bg-surface-2 text-[13px] text-muted">
              <tr>
                <th className="p-3 font-medium">닉네임</th>
                <th className="p-3 font-medium">이메일</th>
                <th className="p-3 font-medium">가입일</th>
                <th className="p-3 font-medium">마지막 접속</th>
                <th className="p-3 font-medium">작품</th>
                <th className="p-3 font-medium">오늘 사용</th>
                <th className="p-3 font-medium">최근 7일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.uid} className={`border-t border-line ${m.disabled ? 'opacity-50' : ''}`}>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      {m.nickname ?? <span className="text-muted">(없음)</span>}
                      {m.isAdmin && (
                        <span className="rounded-full bg-sunshine-soft px-1.5 py-0.5 text-[11px] text-sunshine-ink">
                          관리자
                        </span>
                      )}
                      {m.disabled && (
                        <span className="rounded-full bg-coral-soft px-1.5 py-0.5 text-[11px] text-coral-ink">
                          정지
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-3 text-muted">{m.email ?? '—'}</td>
                  <td className="p-3 text-muted">{m.createdAt ? formatDate(m.createdAt) : '—'}</td>
                  <td className="p-3 text-muted">
                    {m.lastSignInAt ? formatDate(m.lastSignInAt) : '—'}
                  </td>
                  <td className="p-3">{m.postCount}</td>
                  <td className="p-3">{m.isAdmin ? '무제한' : `${m.usageToday}/${usageLimit}`}</td>
                  <td className="p-3">
                    <WeekUsage usage7d={m.usage7d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
