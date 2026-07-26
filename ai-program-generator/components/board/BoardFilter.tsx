'use client';

// 게시판 찾기 줄 — 제목·작성자 검색 + 개념 하나 고르기.
// 개념은 '하나만' 고르게 한다(다중 선택 AND/OR는 저학년에게 의미가 불명확). 다시 누르면 해제.

import { Search, X } from 'lucide-react';
import { CONCEPTS, objectParticle } from '@/lib/edu/concepts';
import { TextInput } from '@/components/ui/Field';
import type { BoardFilter as Filter } from '@/lib/board/filterPosts';

interface Props {
  value: Filter;
  onChange: (next: Filter) => void;
}

export default function BoardFilter({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <TextInput
          type="search"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder="작품 이름이나 만든 사람 찾기"
          aria-label="작품 찾기"
          className="min-h-11 pl-10 pr-10 text-[15px]"
          maxLength={50}
        />
        {value.query && (
          <button
            onClick={() => onChange({ ...value, query: '' })}
            aria-label="검색어 지우기"
            title="지우기"
            className="press absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CONCEPTS.map((c) => {
          const on = value.concept === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => onChange({ ...value, concept: on ? null : c.key })}
              aria-pressed={on}
              title={`${c.label}${objectParticle(c.label)} 쓴 작품만 보기`}
              className={`press inline-flex min-h-9 items-center gap-1 rounded-full border-2 px-3 text-[13.5px] font-medium ${
                on ? `border-transparent ${c.soft}` : 'border-line text-muted hover:border-brand/40'
              }`}
            >
              <Icon size={14} aria-hidden />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
