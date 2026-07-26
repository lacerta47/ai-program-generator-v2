'use client';

// 개념 수집 도감(교육 Phase 2, #2B) — 마이페이지에서 내 작품들이 쓴 컴퓨팅 개념을 모아 보여준다.
// 표시 소스는 detectConcepts(코드 정적 분석). 안 모은 개념은 흐리게 + 도전 유도. 부가 기능이라 실패 시 조용히 숨김.
// 개념 카드를 누르면 '그 개념을 쓴 내 작품'이 펼쳐진다 — 개념이 추상 뱃지에 그치지 않고
// 자기 작품과 연결되도록(생성 때 저장해 둔 conceptNotes를 근거로 함께 보여줌).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CONCEPTS, CONCEPT_BY_KEY, objectParticle } from '@/lib/edu/concepts';
import { fetchMyConceptStats, type ConceptStats } from '@/lib/edu/conceptStats';
import LoadingDots from '@/components/ui/LoadingDots';

export default function ConceptDex({ uid }: { uid: string }) {
  const [stats, setStats] = useState<ConceptStats | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setError(false);
    setOpen(null);
    fetchMyConceptStats(uid)
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch((e) => {
        console.error('개념 도감 조회 실패:', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  if (error) return null; // 부가 기능 — 실패해도 마이페이지 나머지는 그대로

  const collected = stats ? CONCEPTS.filter((c) => (stats.counts[c.key] ?? 0) > 0).length : 0;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[20px]">개념 도감</h2>
        {stats && stats.totalWorks > 0 && (
          <span className="text-[13px] text-muted">
            {collected}/{CONCEPTS.length} 모음{stats.capped ? ' · 최근 작품 기준' : ''}
          </span>
        )}
      </div>

      {stats === null ? (
        <div className="py-8">
          <LoadingDots label="모은 개념을 세는 중…" />
        </div>
      ) : stats.totalWorks === 0 ? (
        <p className="rounded-[var(--r-lg)] border-2 border-dashed border-line py-8 text-center text-[15px] text-muted">
          작품을 만들면 어떤 개념을 썼는지 여기에 모여요!
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {CONCEPTS.map((c) => {
              const n = stats.counts[c.key] ?? 0;
              const got = n > 0;
              const Icon = c.icon;
              const active = open === c.key;
              const base = `flex flex-col items-center gap-1 rounded-[var(--r-lg)] border-2 p-3 text-center ${
                got ? `${c.soft} ${active ? 'border-current' : 'border-transparent'}` : 'border-dashed border-line'
              }`;
              // 모은 개념만 눌러서 펼칠 수 있다(빈 목록을 여는 건 의미 없음).
              if (!got) {
                return (
                  <div key={c.key} className={base}>
                    <Icon size={26} aria-hidden className="text-muted opacity-40" />
                    <span className="text-[15px] font-medium text-muted">{c.label}</span>
                    <span className="text-[12px] text-muted">아직</span>
                  </div>
                );
              }
              return (
                <button
                  key={c.key}
                  onClick={() => setOpen(active ? null : c.key)}
                  aria-expanded={active}
                  title={`${c.label}${objectParticle(c.label)} 쓴 내 작품 보기`}
                  className={`press ${base}`}
                >
                  <Icon size={26} aria-hidden />
                  <span className="text-[15px] font-medium">{c.label}</span>
                  <span className="text-[12px]">{n}개 작품</span>
                </button>
              );
            })}
          </div>

          {/* key로 개념이 바뀌면 새로 마운트 — '더 보기'로 펼친 상태가 다음 개념까지 따라오지 않게. */}
          {open && <ConceptWorks key={open} concept={open} stats={stats} />}
          {collected < CONCEPTS.length && (
            <p className="mt-3 text-center text-[13.5px] text-muted">
              아직 안 모은 개념이 있어요 —{' '}
              <Link href="/create" className="text-brand-strong underline-offset-2 hover:underline dark:text-brand">
                새 작품
              </Link>
              에서 도전해 볼까요?
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** 한 번에 보여줄 작품 수 — 개념 하나에 수십 건이 붙으면 도감이 목록에 파묻힌다. 나머지는 '모두 보기'로. */
const PREVIEW_COUNT = 8;

/** 고른 개념을 쓴 내 작품 목록 — 작품별로 '이 개념을 어떻게 썼는지'(conceptNotes)를 함께 보여준다. */
function ConceptWorks({ concept, stats }: { concept: string; stats: ConceptStats }) {
  const [expanded, setExpanded] = useState(false);
  const info = CONCEPT_BY_KEY[concept];
  const all = stats.works[concept] ?? [];
  const works = expanded ? all : all.slice(0, PREVIEW_COUNT);
  const rest = all.length - works.length;
  if (!info || all.length === 0) return null;

  return (
    <div className="anim-pop-in mt-3 rounded-[var(--r-lg)] border-2 border-line bg-surface-2 p-4">
      <p className="mb-1 text-[15px] font-medium">
        <span className={`rounded-full px-2 py-0.5 ${info.soft}`}>{info.label}</span>
        <span className="ml-1.5">{objectParticle(info.label)} 쓴 내 작품</span>
      </p>
      <p className="mb-3 text-[13.5px] text-muted">{info.desc}</p>
      <ul className="flex flex-col gap-1.5">
        {works.map((w) => (
          <li key={w.id}>
            <Link
              href={`/board?category=${w.categoryId}&post=${w.id}`}
              className="lift flex items-center gap-2 rounded-[var(--r-md)] border-2 border-line bg-surface px-3.5 py-2.5 hover:border-brand/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{w.title}</span>
                {w.note && <span className="block truncate text-[13px] text-muted">{w.note}</span>}
              </span>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="press mt-2 w-full rounded-[var(--r-md)] border-2 border-dashed border-line py-2 text-[13.5px] text-muted hover:border-brand/40 hover:text-ink"
        >
          {rest}개 더 보기
        </button>
      )}
      {stats.capped && (
        <p className="mt-2.5 text-center text-[12.5px] text-muted">최근 작품에서 찾은 것만 보여요.</p>
      )}
    </div>
  );
}
