import Header from '@/components/common/Header';

/**
 * 약관·개인정보처리방침·회사소개 공통 레이아웃.
 * 법적 고지 문서라 본문은 왼쪽 정렬·충분한 줄간격으로(저학년용 화면과 달리 '읽는 문서' 타이포).
 */
export default function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  /** 시행일(예: '2026년 7월 26일') — 없으면 표시 안 함 */
  updatedAt?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-[30px] text-ink">{title}</h1>
        {updatedAt && <p className="mt-2 text-[14px] text-muted">시행일: {updatedAt}</p>}
        <div className="legal mt-8 text-[16px] leading-[1.85] text-ink">{children}</div>
      </div>
    </main>
  );
}
