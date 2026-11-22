import { describe, expect, it, vi } from 'vitest';
import { getTypeGuide } from './typeGuides';

function example(type: 'quiz' | 'roulette'): string {
  const code = getTypeGuide(type).match(/```\n([\s\S]*?)```/)?.[1];
  if (!code) throw new Error('Missing prompt example: ' + type);
  return code;
}

describe('퀴즈 프롬프트의 실행 예시', () => {
  it('정답과 종료 영역을 숨기는 CSS가 기본 레이아웃보다 우선한다', () => {
    expect(getTypeGuide('quiz')).toContain('[hidden] { display: none !important; }');
  });

  it('빈 답을 안내하고 한글 조합 Enter를 건너뛰며 한 문제를 한 번만 채점한다', () => {
    const events = new Map<string, (event?: unknown) => void>();
    const bind = (name: string) => ({
      addEventListener: (eventName: string, listener: (event?: unknown) => void) => events.set(name + ':' + eventName, listener),
    });
    const answerInput = { ...bind('input'), value: '' };
    const feedback = { hidden: true, dataset: { quizState: '' } };
    const correction = { textContent: '' };
    const explanation = { textContent: '' };
    const nextButton = { hidden: true };
    const recordAnswer = vi.fn();
    const clearInterval = vi.fn();
    const api = new Function(
      'answerInput', 'feedback', 'correction', 'explanation', 'nextButton', 'confirmButton',
      'readAnswer', 'currentQuestion', 'recordAnswer', 'clearInterval',
      `let graded = false;
      const timerId = 7;
      ${example('quiz')}
      return { expire: () => submitQuiz(true), reset: () => { graded = false; } };`,
    )(answerInput, feedback, correction, explanation, nextButton, bind('confirm'),
      () => answerInput.value, () => ({ answer: '4', explanation: '2에 2를 더하면 4예요.' }), recordAnswer, clearInterval);
    const click = () => events.get('confirm:click')?.();
    const enter = (options = {}) => events.get('input:keydown')?.({ key: 'Enter', preventDefault() {}, ...options });

    click();
    expect(feedback).toEqual({ hidden: false, dataset: { quizState: 'empty' } });
    expect(correction.textContent).toBe('답을 먼저 써 주세요.');
    expect(nextButton.hidden).toBe(true);
    expect(recordAnswer).not.toHaveBeenCalled();
    expect(clearInterval).not.toHaveBeenCalled();

    answerInput.value = ' ４ ';
    enter({ isComposing: true });
    expect(recordAnswer).not.toHaveBeenCalled();
    enter();
    click();
    api.expire();
    enter({ repeat: true });
    expect(recordAnswer).toHaveBeenCalledExactlyOnceWith(true);
    expect(clearInterval).toHaveBeenCalledExactlyOnceWith(7);
    expect(feedback.dataset.quizState).toBe('correct');
    expect(explanation.textContent).toBe('2에 2를 더하면 4예요.');
    expect(nextButton.hidden).toBe(false);

    api.reset();
    api.expire();
    click();
    expect(recordAnswer.mock.calls).toEqual([[true], [false]]);
    expect(feedback.dataset.quizState).toBe('timeout');
    expect(correction.textContent).toContain('정답: 4');
  });
});

describe('룰렛 프롬프트의 실행 예시', () => {
  it.each([4, 5, 8, 30])('%i개 칸에서 일반·줄인 동작 모두 포인터 아래 결과를 표시한다', (count) => {
    const scheduled: Array<() => void> = [];
    let reduced = false;
    const wheel = { style: { transition: '', transform: '' }, dataset: { spinCount: '0' } };
    const result = { textContent: '' };
    const spinTo = new Function('wheel', 'result', 'matchMedia', 'setTimeout', `${example('roulette')}\nreturn spinTo;`)(
      wheel, result, () => ({ matches: reduced }), (fn: () => void) => scheduled.push(fn),
    );
    const items = Array.from({ length: count }, (_, i) => '칸 ' + (i + 1));
    function expectWinner(index: number, turn: number) {
      const rotation = Number(wheel.style.transform.match(/rotate\(([-.\d]+)deg\)/)?.[1]);
      // Inverse projection from rendered rotation to the 12-o'clock sector.
      const pointerSector = Math.round((((-rotation % 360) + 360) % 360) / (360 / count)) % count;
      expect(pointerSector).toBe(index);
      expect(result.textContent).toBe('당첨 결과: ' + items[pointerSector]);
      expect(wheel.dataset.spinCount).toBe(String(turn));
    }

    spinTo(1, items, 2000);
    spinTo(0, items, 2000);
    expect(scheduled).toHaveLength(1);
    expect(result.textContent).toBe('');
    scheduled.shift()!();
    expectWinner(1, 1);

    reduced = true;
    spinTo(count - 1, items, 2000);
    expect(scheduled).toHaveLength(0);
    expect(wheel.style.transition).toBe('none');
    expectWinner(count - 1, 2);

    reduced = false;
    spinTo(0, items, 2000);
    scheduled.shift()!();
    expectWinner(0, 3);
  });
});
