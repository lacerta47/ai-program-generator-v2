import { describe, it, expect } from 'vitest';
import { detectConcepts } from './detectConcepts';

const code = (html: string, javascript = '') => ({ html, css: '', javascript });

describe('detectConcepts — 코드 사실 기반 개념 탐지', () => {
  it('빈 코드는 아무 개념도 없다', () => {
    expect(detectConcepts(code('', ''))).toEqual([]);
  });

  it('보이는 텍스트만 있으면 순서·출력', () => {
    expect(detectConcepts(code('<h1>안녕</h1>'))).toEqual(['순서', '출력']);
  });

  it('if·for·버튼·textContent가 있으면 다섯 개념 모두, 고정 순서', () => {
    const js = `for (let i = 0; i < 3; i++) { if (i > 1) { document.getElementById('o').textContent = i; } }`;
    expect(detectConcepts(code('<button id="b"></button><p id="o"></p>', js))).toEqual([
      '순서',
      '조건',
      '반복',
      '입력',
      '출력',
    ]);
  });

  it('문자열·주석 속 if/for는 개념으로 세지 않는다', () => {
    const js = `const msg = "if you for"; // if (x) for (;;)\n/* while (1) */ console.log(msg);`;
    const tags = detectConcepts(code('<p>x</p>', js));
    expect(tags).not.toContain('조건');
    expect(tags).not.toContain('반복');
  });

  it("주석 속 따옴표(// don't)가 뒤 코드를 삼키지 않는다 — 과거 회귀", () => {
    const js = `// don't touch\nif (a) { b(); }`;
    expect(detectConcepts(code('<p>x</p>', js))).toContain('조건');
  });

  it('문자열 속 //는 주석으로 오인하지 않는다', () => {
    const js = `const u = "http://a.b"; if (u) { setInterval(() => {}, 10); }`;
    const tags = detectConcepts(code('<p>x</p>', js));
    expect(tags).toContain('조건');
    expect(tags).toContain('반복');
  });

  it('입력은 조작 이벤트 리스너·on속성·입력 요소로 판정하고, load 같은 비조작 이벤트는 제외', () => {
    expect(detectConcepts(code('<p>x</p>', `window.addEventListener('load', f)`))).not.toContain('입력');
    expect(detectConcepts(code('<p>x</p>', `el.addEventListener('keydown', f)`))).toContain('입력');
    expect(detectConcepts(code('<div onclick="f()">x</div>'))).toContain('입력');
    expect(detectConcepts(code('<input>'))).toContain('입력');
  });

  it('HTML 주석 속 태그는 무시한다', () => {
    expect(detectConcepts(code('<!-- <button> --><p>x</p>'))).not.toContain('입력');
  });

  it('canvas·오디오 API는 출력으로 본다', () => {
    expect(detectConcepts(code('<canvas id="c"></canvas>'))).toContain('출력');
    expect(detectConcepts(code('', `ctx.fillRect(0,0,1,1)`))).toContain('출력');
  });
});
