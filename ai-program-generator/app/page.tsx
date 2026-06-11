import Header from '@/components/common/Header';
import Creator from '@/components/creator/Creator';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header active="creator" />
      <Creator />
    </main>
  );
}
