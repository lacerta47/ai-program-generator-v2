'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import { authedJson } from '@/lib/client/authedFetch';
import { PROGRAM_TYPES } from '@/lib/survey/programs';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import Button from '@/components/ui/Button';
import { TextInput, Select } from '@/components/ui/Field';
import LoadingDots from '@/components/ui/LoadingDots';
import { useToast } from '@/components/ui/Toast';

type Variant = 'default' | 'survey';

interface SlotExemplar {
  variant: Variant;
  programType?: string;
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
  slots: { default: SlotExemplar | null; survey: SlotExemplar | null; byType: Record<string, SlotExemplar | null> };
  candidates: Candidate[];
}

const VARIANT_LABEL: Record<Variant, string> = {
  default: '기본(계획서)',
  survey: '선택지 공통',
};

/** 유형 선택값: '' = 공통 슬롯, 그 외 = PROGRAM_TYPES id */
const TYPE_OPTIONS = [{ id: '', label: '선택지 공통(모든 유형)' }, ...PROGRAM_TYPES.map((t) => ({ id: t.id, label: `${t.icon} ${t.label}` }))];

/** 게시판 공유 링크(?post=ID)나 ID 자체를 받아 ID만 뽑는다. */
function extractPostId(input: string): string {
  const s = input.trim();
  const m = s.match(/[?&]post=([A-Za-z0-9_-]+)/) ?? s.match(/\/share\/([A-Za-z0-9_-]+)/);
  return (m ? m[1] : s).trim();
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
  // 'ID로 지정' 폼
  const [postInput, setPostInput] = useState('');
  const [typeSel, setTypeSel] = useState('');
  // 후보 목록의 유형 선택(글 id → 유형)
  const [candType, setCandType] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    return authedJson('/api/admin/exemplars')
      .then((d) => setData(d as ExemplarsData))
      .catch((e) => toast(e instanceof Error ? e.message : '불러오기 실패'));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const slotName = (variant: Variant, programType?: string) =>
    programType ? `${PROGRAM_TYPES.find((t) => t.id === programType)?.label ?? programType} 예시` : `${VARIANT_LABEL[variant]} 예시`;

  async function designate(sourcePostId: string, variant: Variant, programType?: string) {
    setBusy(true);
    try {
      await authedJson('/api/admin/exemplars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePostId, variant, programType: programType || undefined }),
      });
      toast(`${slotName(variant, programType)}로 지정했어요.`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '지정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function clearSlot(variant: Variant, programType?: string) {
    setBusy(true);
    try {
      const q = programType ? `&programType=${encodeURIComponent(programType)}` : '';
      await authedJson(`/api/admin/exemplars?variant=${variant}${q}`, { method: 'DELETE' });
      toast(`${slotName(variant, programType)}를 비웠어요.`, 'success');
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

  const SlotCard = ({ title, slot, onClear }: { title: string; slot: SlotExemplar | null; onClear: () => void }) => (
    <div className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-3">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={16} aria-hidden className={slot ? 'text-brand' : 'text-muted'} />
        <span className="text-[15px]">{title}</span>
      </div>
      {slot ? (
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] text-muted" title={slot.sourcePostId}>
            {slot.sourceTitle}
          </span>
          <Button variant="ghost" onClick={onClear} disabled={busy} aria-label={`${title} 비우기`}>
            <Trash2 size={15} aria-hidden />
          </Button>
        </div>
      ) : (
        <span className="text-[13px] text-muted">비어 있음</span>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-1 text-[24px]">생성 예시</h1>
      <p className="mb-4 text-[14px] text-muted">
        승인한 글을 생성 프롬프트에 참고 예시로 넣어 완성도를 높여요(생성 모드에만 적용). 선택지 만들기는 <strong>유형별 예시</strong>가
        먼저 쓰이고, 그 유형 슬롯이 비어 있으면 공통 예시로 대신해요.
      </p>

      {/* ID로 지정 */}
      <div className="mb-6 rounded-[var(--r-lg)] border-2 border-brand/40 bg-brand-soft/30 p-4">
        <h2 className="mb-2 text-[17px]">글 ID로 지정</h2>
        <p className="mb-3 text-[13px] text-muted">게시판에서 작품을 열고 주소의 <code>?post=…</code> 부분(또는 공유 링크)을 붙여 넣으세요.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TextInput
            value={postInput}
            onChange={(e) => setPostInput(e.target.value)}
            placeholder="게시물 ID 또는 공유 링크"
            className="flex-1"
            aria-label="게시물 ID"
          />
          <Select value={typeSel} onChange={(e) => setTypeSel(e.target.value)} aria-label="예시 슬롯">
            <option value="__default">기본(계획서)</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.id || '__survey'} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
          <Button
            variant="primary"
            disabled={busy || !extractPostId(postInput)}
            onClick={() => {
              const id = extractPostId(postInput);
              if (typeSel === '__default') designate(id, 'default');
              else designate(id, 'survey', typeSel || undefined);
            }}
          >
            지정
          </Button>
        </div>
      </div>

      {/* 공통 슬롯 */}
      <h2 className="mb-2 text-[18px]">공통 슬롯</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <SlotCard title={VARIANT_LABEL.default} slot={data.slots.default} onClear={() => clearSlot('default')} />
        <SlotCard title={VARIANT_LABEL.survey} slot={data.slots.survey} onClear={() => clearSlot('survey')} />
      </div>

      {/* 유형별 슬롯 */}
      <h2 className="mb-2 text-[18px]">선택지 유형별 슬롯</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROGRAM_TYPES.map((t) => (
          <SlotCard
            key={t.id}
            title={`${t.icon} ${t.label}`}
            slot={data.slots.byType[t.id] ?? null}
            onClear={() => clearSlot('survey', t.id)}
          />
        ))}
      </div>

      {/* 후보 글 */}
      <h2 className="mb-2 text-[18px]">인기 글 후보</h2>
      <div className="flex flex-col gap-2">
        {data.candidates.map((c) => (
          <div key={c.id} className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-[15px]">{c.title}</span>
              <span className="shrink-0 text-[13px] text-muted">
                좋아요 {c.likeCount} · 이어만들기 {c.forkCount}
              </span>
            </div>
            {c.hasPlan ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="soft" onClick={() => designate(c.id, 'default')} disabled={busy}>
                  기본 예시로
                </Button>
                <Select
                  value={candType[c.id] ?? ''}
                  onChange={(e) => setCandType((m) => ({ ...m, [c.id]: e.target.value }))}
                  aria-label="선택지 유형"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.id || '__survey'} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button variant="soft" onClick={() => designate(c.id, 'survey', candType[c.id] || undefined)} disabled={busy}>
                  선택지 예시로
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-muted">계획서가 없어 예시로 쓸 수 없어요.</span>
            )}
          </div>
        ))}
        {data.candidates.length === 0 && (
          <p className="text-[14px] text-muted">아직 후보가 될 인기 글이 없어요.</p>
        )}
      </div>
    </div>
  );
}
