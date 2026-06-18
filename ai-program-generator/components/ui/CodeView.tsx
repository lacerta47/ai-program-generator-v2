'use client';

import { useEffect, useMemo, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import { formatCode } from '@/lib/client/formatCode';

// 필요한 3개 언어만 등록해 번들을 가볍게 유지
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);

const LANG_MAP: Record<string, string> = { html: 'xml', css: 'css', javascript: 'javascript' };

interface Props {
  code: string;
  /** 'html' | 'css' | 'javascript' */
  language: string;
  className?: string;
  /** 스트리밍 중 등 미완성 코드: Prettier 생략하고 즉시 강조(기본 false). */
  skipFormat?: boolean;
}

/** 자동 정렬(Prettier) + 구문 강조 + 줄 번호 코드 뷰어. 토큰 색은 globals.css에서 테마 연동. */
export default function CodeView({ code, language, className = '', skipFormat = false }: Props) {
  const [pretty, setPretty] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPretty(null);
    // 스트리밍 중(미완성)엔 Prettier가 실패하므로 생략 — 원본을 그대로 강조.
    if (skipFormat || !code) return;
    formatCode(code, language)
      .then((f) => alive && setPretty(f.trimEnd()))
      .catch(() => alive && setPretty(code)); // 포맷 실패 시 원본 그대로
    return () => {
      alive = false;
    };
  }, [code, language, skipFormat]);

  const source = pretty ?? code;

  const html = useMemo(() => {
    const lang = LANG_MAP[language] ?? 'javascript';
    // hljs.highlight는 입력을 이스케이프하므로 dangerouslySetInnerHTML에 안전
    const highlighted = hljs.highlight(source || '', { language: lang, ignoreIllegals: true }).value;
    const lines = highlighted.split('\n');
    if (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.map((line) => `<span class="code-line">${line || ' '}</span>`).join('');
  }, [source, language]);

  if (!code) {
    return <p className={`p-4 text-[14px] text-muted ${className}`}>내용이 없어요</p>;
  }

  return (
    <pre className={`code-view overflow-auto p-4 font-mono text-[13.5px] leading-relaxed ${className}`}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
}
