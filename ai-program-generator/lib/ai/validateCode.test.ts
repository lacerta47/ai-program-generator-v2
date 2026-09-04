import { describe, it, expect } from 'vitest';
import { validateGeneratedCode } from './validateCode';

const base = { css: '' };

describe('validateGeneratedCode — 실행 가능성 게이트', () => {
  it('JS가 없는 정적 작품은 검사하지 않는다', () => {
    expect(validateGeneratedCode({ ...base, html: '<h1>안녕</h1>', javascript: '   ' })).toBeNull();
  });

  it('정상 코드는 통과한다', () => {
    const html = '<button id="go">시작</button><p id="out"></p>';
    const js = `document.getElementById('go').addEventListener('click', () => {
      document.getElementById('out').textContent = '눌렀어요';
    });`;
    expect(validateGeneratedCode({ ...base, html, javascript: js })).toBeNull();
  });

  it('문법 오류를 잡는다', () => {
    const r = validateGeneratedCode({ ...base, html: '', javascript: 'function ( { ' });
    expect(r).toMatch(/JS 문법 오류/);
  });

  it('줄바꿈 없는 // 주석이 뒤 코드를 삼킨 결함을 문법 검사보다 먼저 잡는다', () => {
    // 괄호가 우연히 맞아 문법상 유효하지만 90%가 주석이 된 코드
    const js = `let n = 0; // 카운터 초기화 const btn = document.getElementById('b'); btn.onclick = () => { n++; };`;
    const r = validateGeneratedCode({ ...base, html: '<button id="b"></button>', javascript: js });
    expect(r).toMatch(/삼킴/);
  });

  it('문서 끝의 짧은 설명 주석은 삼킴으로 보지 않는다', () => {
    const js = `const x = 1;\nconsole.log(x); // 끝`;
    expect(validateGeneratedCode({ ...base, html: '', javascript: js })).toBeNull();
  });

  it('문자열 안의 //는 주석으로 오인하지 않는다', () => {
    const js = `const url = "https://example.com/a"; const el = document.getElementById('x'); el.textContent = url;`;
    expect(validateGeneratedCode({ ...base, html: '<p id="x"></p>', javascript: js })).toBeNull();
  });

  it('HTML에 없는 요소 참조를 잡는다', () => {
    const js = `document.getElementById('missing').textContent = 'x';`;
    const r = validateGeneratedCode({ ...base, html: '<p id="other"></p>', javascript: js });
    expect(r).toMatch(/없는 요소를 참조: missing/);
  });

  it('JS가 동적으로 만든 id는 없는 요소로 오판하지 않는다', () => {
    const js = `document.body.innerHTML = '<div id="dyn"></div>';
      const d = document.createElement('div'); d.id = 'dyn2';
      document.getElementById('dyn').textContent = 'a';
      document.querySelector('#dyn2');`;
    expect(validateGeneratedCode({ ...base, html: '', javascript: js })).toBeNull();
  });

  it('주석 속 예시 셀렉터는 실제 참조로 보지 않는다', () => {
    const js = `/* 예) getElementById('timer-display') */\nconst a = document.getElementById('real');`;
    expect(validateGeneratedCode({ ...base, html: '<p id="real"></p>', javascript: js })).toBeNull();
  });
});
