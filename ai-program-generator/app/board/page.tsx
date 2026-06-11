import { Suspense } from 'react';
import Header from '@/components/common/Header';
import BoardView from '@/components/board/BoardView';

export default function BoardPage() {
  return (
    <main className="min-h-screen">
      <Header active="board" />
      <Suspense fallback={<p className="p-8 text-center text-sm text-neutral-400">불러오는 중…</p>}>
        <BoardView />
      </Suspense>
    </main>
  );
}
