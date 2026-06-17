'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';
import { useToast } from '@/components/ui/Toast';

type Variant = 'default' | 'survey';

interface SlotExemplar {
  variant: Variant;
  sourceTitle: string;
  sourcePostId: string;
  approvedAt: number;
}
interface Candidate {
  id: string;
  title: string;
  likeCount: number;
  forkCount: number;
  hasPlan: boolean;
}
interface ExemplarsData {
  slots: { default: SlotExemplar | null; survey: SlotExemplar | null };
  candidates: Candidate[];
}

const VARIANT_LABEL: Record<Variant, string> = {
  default: '기본(계획서)',
  survey: '선택지(저학년)',
};

async function authedFetch(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export default function AdminExemplarsPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <ExemplarsContent />
      </AdminGate>
    </main>
  );
}

function ExemplarsContent() {
  const { toast } = useToast();
  const [data, setData] = useState<ExemplarsData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return authedFetch('/api/admin/exemplars')
      .then((d) => setData(d as ExemplarsData))
      .catch((e) => toast(e instanceof Error ? e.message : '불러오기 실패'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function designate(sourcePostId: string, variant: Variant) {
    setBusy(true);
    try {
      await authedFetch('/api/admin/exemplars', {
        method: 'POST',
        body: JSON.stringify({ sourcePostId, variant }),
      });
      toast(`${VARIANT_LABEL[variant]} 예시로 지정했어요.`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '지정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function clearSlot(variant: Variant) {
    setBusy(true);
    try {
      await authedFetch(`/api/admin/exemplars?variant=${variant}`, { method: 'DELETE' });
      toast(`${VARIANT_LABEL[variant]} 예시를 비웠어요.`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '비우기 실패');
    } finally {
      setBusy(false);
    }
  }

  if (!data) return (
    <div className="py-10">
      <LoadingDots label="불러오는 중…" />
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-1 text-[24px]">생성 예시</h1>
      <p className="mb-4 text-[14px] text-muted">
        승인한 글을 생성 프롬프트에 참고 예시로 1개 넣어 완성도를 높여요. (생성 모드에만 적용)
      </p>

      {/* 현재 슬롯 */}
      <div className="mb-6 flex flex-col gap-3">
        {(['default', 'survey'] as Variant[]).map((v) => {
          const slot = data?.slots[v] ?? null;
          return (
            <div key={v} className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-4">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles size={18} aria-hidden />
                <span className="text-[16px]">{VARIANT_LABEL[v]}</span>
              </div>
              {slot ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-muted">
                    현재: {slot.sourceTitle}
                  </span>
                  <Button variant="ghost" onClick={() => clearSlot(v)} disabled={busy}>
                    <Trash2 size={16} aria-hidden /> 비우기
                  </Button>
                </div>
              ) : (
                <span className="text-[14px] text-muted">아직 지정된 예시가 없어요.</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 후보 글 */}
      <h2 className="mb-2 text-[18px]">인기 글 후보</h2>
      <div className="flex flex-col gap-2">
        {(data?.candidates ?? []).map((c) => (
          <div key={c.id} className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px]">{c.title}</span>
              <span className="shrink-0 text-[13px] text-muted">
                좋아요 {c.likeCount} · 이어만들기 {c.forkCount}
              </span>
            </div>
            {c.hasPlan ? (
              <div className="flex gap-2">
                <Button variant="soft" onClick={() => designate(c.id, 'default')} disabled={busy}>
                  기본 예시로
                </Button>
                <Button variant="soft" onClick={() => designate(c.id, 'survey')} disabled={busy}>
                  선택지 예시로
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-muted">계획서가 없어 예시로 쓸 수 없어요.</span>
            )}
          </div>
        ))}
        {data && data.candidates.length === 0 && (
          <p className="text-[14px] text-muted">아직 후보가 될 인기 글이 없어요.</p>
        )}
      </div>
    </div>
  );
}
