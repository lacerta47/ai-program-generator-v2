import type { PlanFields } from '@/lib/firebase/types';

export function planDisplayFields(plan?: PlanFields): { label: string; value: string }[] {
  if (!plan) return [];
  return [
    { label: '프로그램 이름', value: plan.name },
    { label: '프로그램 모습', value: plan.look },
    { label: '사용법', value: plan.usage },
    { label: '동작 방식', value: plan.how },
    { label: '기타 사항', value: plan.etc },
  ].filter((field) => typeof field.value === 'string' && field.value.trim());
}
