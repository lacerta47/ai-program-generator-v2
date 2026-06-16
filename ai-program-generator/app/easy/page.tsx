import Header from '@/components/common/Header';
import SurveyWizard from '@/components/survey/SurveyWizard';

export default function EasyPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="p-4 sm:p-6">
        <SurveyWizard />
      </div>
    </main>
  );
}
