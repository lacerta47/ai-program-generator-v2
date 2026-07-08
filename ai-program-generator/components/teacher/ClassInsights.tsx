'use client';

// 교사 학습 대시보드(교육 Phase 2) — 반 요약 + 학생×개념 커버리지 격자.
// /api/teacher/insights(usage·posts×detectConcepts 집계)를 표시만. 실패 시 조용히 숨김.

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CONCEPTS } from '@/lib/edu/concepts';
import { fetchTeacherInsights, type TeacherInsights } from '@/lib/teacher/insights';
import { formatDate } from '@/lib/program';
import LoadingDots from '@/components/ui/LoadingDots';

export default function ClassInsights() {
  const [data, setData] = useState<TeacherInsights | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchTeacherInsights()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        console.error('학습 현황 조회 실패:', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return null; // 부가 섹션 — 실패해도 콘솔 나머지는 그대로

  return (
    <section className="mt-5 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <h2 className="text-[18px]">우리 반 학습 현황</h2>
      {data === null ? (
        <div className="py-6">
          <LoadingDots label="학습 현황을 불러오는 중…" />
        </div>
      ) : data.students.length === 0 ? (
        <p className="mt-2 text-[14px] text-muted">아직 학생이 없어요. 아래에서 먼저 학생을 만들어 주세요.</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-muted">
            <span>
              학생 <b className="text-ink">{data.summary.studentCount}</b>명
            </span>
            <span>
              최근 2주 활동 <b className="text-ink">{data.summary.activeCount}</b>명
            </span>
            <span>
              작품 <b className="text-ink">{data.summary.totalWorks}</b>개
            </span>
            <span>
              시도 <b className="text-ink">{data.summary.totalAttempts}</b>회
            </span>
          </div>
          <p className="mb-1.5 mt-3 text-[13px] text-muted">
            칸이 채워진 개념은 그 학생이 <strong>실제 코드로 써본 것</strong>이에요.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b-2 border-line text-muted">
                  <th className="py-2 pr-3 text-left font-medium">학생</th>
                  {CONCEPTS.map((c) => {
                    const Icon = c.icon;
                    return (
                      <th key={c.key} className="px-1 py-2 text-center font-medium">
                        <span className="inline-flex flex-col items-center gap-0.5">
                          <Icon size={15} aria-hidden /> {c.label}
                        </span>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-right font-medium">작품</th>
                  <th className="py-2 pl-2 text-right font-medium">최근</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.uid} className="border-b border-line">
                    <td className="py-2 pr-3 font-medium text-ink">{s.name}</td>
                    {CONCEPTS.map((c) => {
                      const got = s.concepts.includes(c.key);
                      return (
                        <td key={c.key} className="px-1 py-2 text-center">
                          {got ? (
                            <span className={`inline-grid h-6 w-6 place-items-center rounded-full ${c.soft}`}>
                              <Check size={14} aria-hidden />
                            </span>
                          ) : (
                            <span className="text-muted/40" aria-label="아직 안 써봤어요">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right tabular-nums text-muted">{s.works}</td>
                    <td className="py-2 pl-2 text-right text-[13px] text-muted">
                      {s.lastActive ? formatDate(s.lastActive) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
