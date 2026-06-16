import Header from '@/components/common/Header';
import AdminGate from '@/components/admin/AdminGate';
import CategoryManager from '@/components/admin/CategoryManager';

export default function AdminCategoriesPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <AdminGate>
        <div className="mx-auto max-w-2xl p-4 sm:p-6">
          <CategoryManager />
        </div>
      </AdminGate>
    </main>
  );
}
