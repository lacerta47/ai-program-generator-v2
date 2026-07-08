'use client';

// 개념 수집 도감(교육 Phase 2, #2B) — 마이페이지에서 내 작품들이 쓴 컴퓨팅 개념을 모아 보여준다.
// 표시 소스는 detectConcepts(코드 정적 분석). 안 모은 개념은 흐리게 + 도전 유도. 부가 기능이라 실패 시 조용히 숨김.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONCEPTS } from '@/lib/edu/concepts';
import { fetchMyConceptStats, type ConceptStats } from '@/lib/edu/conceptStats';
import LoadingDots from '@/components/ui/LoadingDots';

export default function ConceptDex({ uid }: { uid: string }) {
  const [stats, setStats] = useState<ConceptStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setError(false);
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
              return (
                <div
                  key={c.key}
                  className={`flex flex-col items-center gap-1 rounded-[var(--r-lg)] border-2 p-3 text-center ${
                    got ? `border-transparent ${c.soft}` : 'border-dashed border-line'
                  }`}
                >
                  <Icon size={26} aria-hidden className={got ? '' : 'text-muted opacity-40'} />
                  <span className={`text-[15px] font-medium ${got ? '' : 'text-muted'}`}>{c.label}</span>
                  <span className={`text-[12px] ${got ? '' : 'text-muted'}`}>{got ? `${n}개 작품` : '아직'}</span>
                </div>
              );
            })}
          </div>
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
