// 작품이 사용한 컴퓨팅 개념(conceptTags)을 배지로 표시(교육 Phase 2, #2 개념 태그).
// Phase 0에서 이미 생성·저장되는 conceptTags(순서·조건·반복·입력·출력 부분집합)를 표시만 한다.
// 이모지 장식 대신 lucide 아이콘 사용(프로젝트 정책). 알 수 없는 태그는 무시, 고정 순서로 정렬·중복 제거.

import { ListOrdered, GitBranch, Repeat, Keyboard, MessageSquare, type LucideIcon } from 'lucide-react';

const CONCEPT_META: Record<string, { icon: LucideIcon; label: string }> = {
  순서: { icon: ListOrdered, label: '순서' },
  조건: { icon: GitBranch, label: '조건' },
  반복: { icon: Repeat, label: '반복' },
  입력: { icon: Keyboard, label: '입력' },
  출력: { icon: MessageSquare, label: '출력' },
};
const ORDER = ['순서', '조건', '반복', '입력', '출력'];

/** conceptTags에 알려진 개념이 하나라도 있으면 true (부모의 렌더 가드용). */
export function hasKnownConcepts(tags?: string[]): boolean {
  return !!tags && tags.some((t) => t in CONCEPT_META);
}

export default function ConceptBadges({ tags, className = '' }: { tags?: string[]; className?: string }) {
  const uniq = ORDER.filter((c) => tags?.includes(c)); // 중복 제거 + 고정 순서
  if (uniq.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} aria-label="이 작품이 사용한 개념">
      {uniq.map((c) => {
        const { icon: Icon, label } = CONCEPT_META[c];
        return (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full border border-mint-ink/25 px-2 py-0.5 text-[12.5px] font-medium text-mint-ink"
          >
            <Icon size={13} aria-hidden /> {label}
          </span>
        );
      })}
    </div>
  );
}
