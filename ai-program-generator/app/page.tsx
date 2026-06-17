import ThemeToggle from '@/components/common/ThemeToggle';

// 기능으로 가는 깔끔한 링크(아이콘 없이). 전체 새로고침 위해 일반 <a>.
const LINK =
  'press inline-flex min-h-12 items-center justify-center rounded-full border-2 border-line bg-surface px-6 text-[16px] font-medium text-ink hover:border-brand/50 hover:text-brand-strong dark:hover:text-brand';

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="anim-pop-in flex flex-col items-center">
        <h1 className="font-display text-[84px] leading-none tracking-tight text-ink sm:text-[136px]">
          LUN
        </h1>
        <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.4em] text-brand-strong dark:text-brand">
          Logic&nbsp;·&nbsp;Unfold&nbsp;·&nbsp;Next
        </p>
        <p className="mt-7 text-[18px] text-muted">논리를 펼치면, 마법이 시작돼요</p>

        <nav className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <a href="/create" className={LINK}>
            만들기
          </a>
          <a href="/easy" className={LINK}>
            골라서 만들기
          </a>
          <a href="/board" className={LINK}>
            게시판
          </a>
        </nav>
      </div>
    </main>
  );
}
