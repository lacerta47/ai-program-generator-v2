import { Wand2, LayoutGrid } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import GlowNavLink from './GlowNavLink';
import AuthButton from '@/components/auth/AuthButton';

export default function Header({ active }: { active?: 'creator' | 'board' }) {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-line bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        {/* 일반 <a>로 전체 새로고침 (Link는 클라이언트 라우팅이라 새로고침이 안 됨) */}
        <a
          href="/"
          className="group flex items-center gap-2.5 font-display text-[22px] text-ink sm:text-[24px]"
        >
          <span className="hover-wiggle grid h-11 w-11 place-items-center rounded-[14px] bg-brand text-brand-ink">
            <Wand2 size={22} strokeWidth={2.2} />
          </span>
          <span className="hidden sm:inline">AI 프로그램 생성기</span>
          <span className="sm:hidden">AI 생성기</span>
        </a>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <GlowNavLink href="/" active={active === 'creator'}>
            <span className="hover-wiggle grid place-items-center" aria-hidden>
              <Wand2 size={17} />
            </span>
            만들기
          </GlowNavLink>
          <GlowNavLink href="/board" active={active === 'board'}>
            <span className="hover-wiggle grid place-items-center" aria-hidden>
              <LayoutGrid size={17} />
            </span>
            게시판
          </GlowNavLink>
          <ThemeToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
