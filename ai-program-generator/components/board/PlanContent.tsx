import type { PlanFields } from '@/lib/firebase/types';
import { planDisplayFields } from '@/lib/creator/planDisplay';

export default function PlanContent({ plan, prompt }: { plan?: PlanFields; prompt?: string }) {
  const fields = planDisplayFields(plan);
  return (
    <>
      {fields.length > 0 ? (
        <div className="space-y-3 rounded-[var(--r-md)] bg-surface-2 p-4 text-[17px] leading-relaxed text-ink">
          {fields.map(({ label, value }) => (
            <div key={label}>
              <p className="font-medium">{label}</p>
              <p className="whitespace-pre-wrap break-words">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-[17px] text-muted">저장된 이전 요청을 보여줘요.</p>
      )}
      {prompt && fields.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[17px]">저장된 생성 요청 보기</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-[var(--r-md)] bg-surface-2 p-4 font-body text-[17px] leading-relaxed text-ink">{prompt}</pre>
        </details>
      )}
      {prompt && fields.length === 0 && (
        <pre className="whitespace-pre-wrap break-words rounded-[var(--r-md)] bg-surface-2 p-4 font-body text-[17px] leading-relaxed text-ink">{prompt}</pre>
      )}
    </>
  );
}
