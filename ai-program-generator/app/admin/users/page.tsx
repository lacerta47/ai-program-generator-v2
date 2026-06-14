'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CloudOff,
  RotateCcw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ArrowUp,
  ArrowDown,
  Settings2,
  Ban,
  Trash2,
} from 'lucide-react';
import { fetchMembers, type Member } from '@/lib/admin/members';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';
import Modal from '@/components/ui/Modal';
import { patchUser, deleteUserAccount } from '@/lib/admin/accounts';
import { useToast } from '@/components/ui/Toast';

type SortKey = 'nickname' | 'email' | 'created' | 'lastSignIn' | 'posts' | 'usageToday' | 'week';
type SortDir = 'asc' | 'desc';
const TEXT_KEYS: SortKey[] = ['nickname', 'email'];

/** 정렬 비교용 값 추출. 문자열 키는 localeCompare, 나머지는 숫자. */
function sortValue(m: Member, key: SortKey): string | number {
  switch (key) {
    case 'nickname':
      return (m.nickname ?? '').toLowerCase();
    case 'email':
      return (m.email ?? '').toLowerCase();
    case 'created':
      return m.createdAt;
    case 'lastSignIn':
      return m.lastSignInAt ?? 0;
    case 'posts':
      return m.postCount;
    case 'usageToday':
      return m.usageToday;
    case 'week':
      return m.usage7d.reduce((a, b) => a + b, 0);
  }
}

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
  const [sortKey, setSortKey] = useState<SortKey>('usageToday');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [reloadKey, setReloadKey] = useState(0);
  const [actionMember, setActionMember] = useState<Member | null>(null);

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
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      const r =
        typeof va === 'string' && typeof vb === 'string'
          ? va.localeCompare(vb, 'ko')
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? r : -r;
    });
  }, [members, q, sortKey, sortDir]);

  // 같은 열 다시 클릭 → 방향 토글, 다른 열 클릭 → 그 열로(텍스트는 오름, 숫자·날짜는 내림 기본)
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(TEXT_KEYS.includes(key) ? 'asc' : 'desc');
    }
  }

  const sortHead = (label: string, key: SortKey) => (
    <th
      className="p-3 font-medium"
      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 whitespace-nowrap hover:text-ink"
      >
        {label}
        {sortKey === key &&
          (sortDir === 'asc' ? (
            <ArrowUp size={13} aria-hidden />
          ) : (
            <ArrowDown size={13} aria-hidden />
          ))}
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">가입자</h1>

      <div className="mb-4">
        <div className="relative max-w-sm">
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
                {sortHead('닉네임', 'nickname')}
                {sortHead('이메일', 'email')}
                {sortHead('가입일', 'created')}
                {sortHead('마지막 접속', 'lastSignIn')}
                {sortHead('작품', 'posts')}
                {sortHead('오늘 사용', 'usageToday')}
                {sortHead('최근 7일', 'week')}
                <th className="p-3 font-medium">관리</th>
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
                  <td className="p-3">
                    {m.isAdmin ? (
                      '무제한'
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {m.usageToday}/{m.limitOverride ?? usageLimit}
                        {m.limitOverride !== null && (
                          <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[11px] text-brand-ink">맞춤</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <WeekUsage usage7d={m.usage7d} />
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setActionMember(m)}
                      aria-label="관리"
                      className="press rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      <Settings2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {actionMember && (
        <UserActionModal
          member={actionMember}
          globalLimit={usageLimit}
          onClose={() => setActionMember(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

function UserActionModal({
  member,
  globalLimit,
  onClose,
  onChanged,
}: {
  member: Member;
  globalLimit: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [limitInput, setLimitInput] = useState(
    member.limitOverride !== null ? String(member.limitOverride) : '',
  );

  async function act(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast(okMsg, 'success');
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : '처리하지 못했어요.');
      setBusy(false);
    }
  }

  if (member.isAdmin) {
    return (
      <Modal open onClose={onClose} label="계정 관리" className="max-w-sm p-6">
        <h2 className="mb-2 text-[20px]">{member.nickname ?? member.email ?? '관리자'}</h2>
        <p className="text-[14px] text-muted">관리자 계정이라 정지·삭제할 수 없어요.</p>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} label="계정 관리" className="max-w-sm p-6">
      <h2 className="text-[20px]">{member.nickname ?? '(별명 없음)'}</h2>
      <p className="mb-4 text-[13px] text-muted">{member.email ?? '—'}</p>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px]">{member.disabled ? '정지된 계정' : '사용 중'}</span>
          <Button
            variant="soft"
            disabled={busy}
            onClick={() =>
              act(
                () => patchUser(member.uid, { disabled: !member.disabled }),
                member.disabled ? '정지를 풀었어요.' : '계정을 정지했어요.',
              )
            }
          >
            {member.disabled ? <RotateCcw size={16} aria-hidden /> : <Ban size={16} aria-hidden />}
            {member.disabled ? ' 정지 풀기' : ' 정지'}
          </Button>
        </div>

        <div>
          <p className="mb-1 text-[14px]">하루 한도</p>
          <p className="mb-2 text-[12px] text-muted">
            지금: {member.limitOverride !== null ? `맞춤 ${member.limitOverride}회` : `기본 ${globalLimit}회`}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <TextInput
              type="number"
              min={0}
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              placeholder={String(globalLimit)}
              className="w-24"
            />
            <Button
              variant="soft"
              disabled={busy}
              onClick={() => {
                if (limitInput.trim() === '') {
                  toast('숫자를 입력해 주세요. (0은 완전 차단이에요)');
                  return;
                }
                const n = Number(limitInput);
                if (!Number.isInteger(n) || n < 0) {
                  toast('한도는 0 이상의 정수여야 해요.');
                  return;
                }
                act(() => patchUser(member.uid, { dailyLimit: n }), '한도를 바꿨어요.');
              }}
            >
              적용
            </Button>
            {member.limitOverride !== null && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => act(() => patchUser(member.uid, { dailyLimit: null }), '기본 한도로 되돌렸어요.')}
              >
                기본값으로
              </Button>
            )}
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <Button
            variant="primary"
            disabled={busy}
            className="!bg-coral !text-white hover:!brightness-95"
            onClick={() => {
              if (!confirm(`'${member.nickname ?? member.email}' 계정과 그 작품을 영구 삭제할까요? 되돌릴 수 없어요.`)) return;
              act(() => deleteUserAccount(member.uid), '계정을 삭제했어요.');
            }}
          >
            <Trash2 size={16} aria-hidden /> 계정·작품 영구 삭제
          </Button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose} disabled={busy}>닫기</Button>
      </div>
    </Modal>
  );
}
