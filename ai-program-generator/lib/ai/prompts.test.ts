import { describe, expect, it } from 'vitest';
import { DEFAULT_SYSTEM_PROMPT, MODIFY_SYSTEM_SUFFIX, SURVEY_SYSTEM_PROMPT } from './prompts';

const OUTPUT_FIELDS = [
  'html',
  'css',
  'javascript',
  'logicSummary',
  'conceptTags',
  'nextChallenge',
  'conceptNotes',
];

describe('생성 프롬프트 출력 계약', () => {
  it.each([DEFAULT_SYSTEM_PROMPT, SURVEY_SYSTEM_PROMPT])('공통 프롬프트가 실제 7필드를 모두 요구한다', (prompt) => {
    for (const field of OUTPUT_FIELDS) expect(prompt).toContain(field);
    expect(prompt).not.toContain('세 개의 키');
    expect(prompt).not.toContain('15만 자');
  });

  it('수정 모드도 전체 결과의 실행 계약과 7필드 출력을 요구한다', () => {
    const composed = DEFAULT_SYSTEM_PROMPT + MODIFY_SYSTEM_SUFFIX;
    for (const field of OUTPUT_FIELDS) expect(composed).toContain(field);
    expect(MODIFY_SYSTEM_SUFFIX).toContain('최종 전체 코드');
    expect(MODIFY_SYSTEM_SUFFIX).not.toContain('그대로 두세요');
  });
});
