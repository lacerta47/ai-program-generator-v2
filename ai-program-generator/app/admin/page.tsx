'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Flag, Users, ChevronRight } from 'lucide-react';
import { countReports } from '@/lib/firebase/reports';
import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';

export default function AdminHubPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <HubContent />
      </AdminGate>
    </main>
  );
}

function HubContent() {
  const [reportCount, setReportCount] = useState<number | null>(null);

  useEffect(() => {
    countReports()
      .then(setReportCount)
      .catch((e) => console.error('신고 수 조회 실패:', e));
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="mb-4 text-[24px]">관리자</h1>
      <div className="flex flex-col gap-3">
        <HubCard
          href="/admin/reports"
          icon={<Flag size={22} aria-hidden />}
          title="신고 처리"
          desc={reportCount ? `미처리 신고 ${reportCount}건` : '신고된 작품 검토'}
        />
        <HubCard
          href="/admin/users"
          icon={<Users size={22} aria-hidden />}
          title="가입자"
          desc="회원 목록·사용량 보기"
        />
      </div>
    </div>
  );
}

function HubCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="press lift flex items-center gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5 hover:border-brand/50"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px]">{title}</span>
        <span className="block text-[14px] text-muted">{desc}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
