import { describe, expect, it } from 'vitest';
import { planDisplayFields } from './planDisplay';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlanContent from '@/components/board/PlanContent';

describe('planDisplayFields', () => {
  it('shows the saved plan values and skips empty fields', () => {
    expect(planDisplayFields({ name: '새 이름', look: '', usage: '  ', how: '움직여요', etc: '새 요청' })).toEqual([
      { label: '프로그램 이름', value: '새 이름' },
      { label: '동작 방식', value: '움직여요' },
      { label: '기타 사항', value: '새 요청' },
    ]);
  });

  it('handles older posts without a plan', () => {
    expect(planDisplayFields()).toEqual([]);
  });
});

describe('계획서 표시', () => {
  it('shows the edited plan before the separately folded saved request', () => {
    const html = renderToStaticMarkup(createElement(PlanContent, {
      plan: { name: '수정된 이름', look: '', usage: '', how: '', etc: '수정된 요청' },
      prompt: '이전 요청',
    }));
    expect(html).toContain('수정된 이름');
    expect(html).toContain('수정된 요청');
    expect(html).toMatch(/<details[^>]*>.*저장된 생성 요청 보기.*이전 요청.*<\/details>/);
    expect(html.indexOf('수정된 요청')).toBeLessThan(html.indexOf('<details'));
  });

  it('shows the saved request directly for older posts', () => {
    const html = renderToStaticMarkup(createElement(PlanContent, { prompt: '이전 작품 요청' }));
    expect(html).toContain('저장된 이전 요청을 보여줘요');
    expect(html).toContain('이전 작품 요청');
    expect(html).not.toContain('<details');
  });
});
