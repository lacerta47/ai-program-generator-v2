// 컴퓨팅 개념(순서·조건·반복·입력·출력) 공유 메타 — 배지(ConceptBadges)와 도감(마이페이지)이 함께 쓴다.
// 이모지 대신 lucide 아이콘(프로젝트 정책). Tailwind purge 대응 위해 색 클래스는 전부 리터럴.

import { ListOrdered, GitBranch, Repeat, Keyboard, MessageSquare, type LucideIcon } from 'lucide-react';

export interface ConceptInfo {
  key: string;
  label: string;
  icon: LucideIcon;
  /** 저학년 쉬운말 설명 */
  desc: string;
  /** 배지 pill(테두리+글자). 거의 항상인 순서·출력은 흐림(시각 위계). */
  badge: string;
  /** 개념 고유색 soft 바탕+ink 글자 — 설명 패널·도감 카드용. */
  soft: string;
}

export const CONCEPTS: ConceptInfo[] = [
  {
    key: '순서',
    label: '순서',
    icon: ListOrdered,
    desc: '일이 정한 차례대로 하나씩 일어나요. 첫째 → 둘째 → 셋째!',
    badge: 'border-line text-muted',
    soft: 'bg-brand-soft text-brand-strong dark:text-brand',
  },
  {
    key: '조건',
    label: '조건',
    icon: GitBranch,
    desc: "'만약 ~하면 ~해요'처럼, 상황에 따라 다른 일이 일어나요.",
    badge: 'border-coral/60 text-coral-ink',
    soft: 'bg-coral-soft text-coral-ink',
  },
  {
    key: '반복',
    label: '반복',
    icon: Repeat,
    desc: '같은 일을 여러 번 되풀이해요. 매번 다시 만들지 않아도 돼요!',
    badge: 'border-grape/60 text-grape-ink',
    soft: 'bg-grape-soft text-grape-ink',
  },
  {
    key: '입력',
    label: '입력',
    icon: Keyboard,
    desc: '내가 프로그램에게 알려주는 것이에요 — 누르기, 적기, 고르기!',
    badge: 'border-sunshine/70 text-sunshine-ink',
    soft: 'bg-sunshine-soft text-sunshine-ink',
  },
  {
    key: '출력',
    label: '출력',
    icon: MessageSquare,
    desc: '프로그램이 나에게 보여주거나 들려주는 것이에요.',
    badge: 'border-line text-muted',
    soft: 'bg-mint-soft text-mint-ink',
  },
];

export const CONCEPT_ORDER = CONCEPTS.map((c) => c.key);
export const CONCEPT_BY_KEY: Record<string, ConceptInfo> = Object.fromEntries(CONCEPTS.map((c) => [c.key, c]));

/** tags에 알려진 개념이 하나라도 있으면 true (렌더 가드용). */
export function hasKnownConcepts(tags?: string[]): boolean {
  return !!tags && tags.some((t) => t in CONCEPT_BY_KEY);
}
