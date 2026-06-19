import Header from '@/components/common/Header';

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <h1 className="text-[28px]">회사 소개</h1>
        <p className="mt-3 text-[16px] text-muted">내용을 준비하고 있어요.</p>
      </div>
    </main>
  );
}
