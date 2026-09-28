import { describe, expect, it } from 'vitest';
import { buildExemplarBlock, exemplarCodeReference, EXEMPLAR_CODE_CAP, type Exemplar } from './exemplars';

function exemplar(javascript: string): Exemplar {
  return {
    variant: 'survey',
    plan: { name: '예시', look: '', usage: '', how: '', etc: '' },
    code: { html: '<button>눌러요</button>', css: 'button { color: black; }', javascript },
    sourcePostId: 'post',
    sourceTitle: '예시',
    approvedBy: 'admin',
    approvedAt: 1,
  };
}

describe('참고 예시 프롬프트', () => {
  it('완전한 소형 코드는 참고 예시에 포함한다', () => {
    const block = buildExemplarBlock(exemplar('function start() { return true; }'));

    expect(block).toContain('완전한 결과 코드');
    expect(block).toContain('function start()');
  });

  it('잘렸거나 상한을 넘긴 코드는 모델에게 제공하지 않는다', () => {
    const truncated = buildExemplarBlock(exemplar('function broken() {\n/* …생략… */'));
    const oversized = buildExemplarBlock(exemplar('x'.repeat(EXEMPLAR_CODE_CAP + 1)));

    expect(truncated).toContain('불완전한 코드는 제공하지 않습니다');
    expect(truncated).not.toContain('function broken');
    expect(oversized).not.toContain('x'.repeat(100));
  });

  it('관리자 화면에 보여줄 코드 참고 상태를 판정한다', () => {
    expect(exemplarCodeReference(exemplar('function start() {}').code)).toBe('full');
    expect(exemplarCodeReference(exemplar('x'.repeat(EXEMPLAR_CODE_CAP + 1)).code)).toBe('plan-only');
  });
});
