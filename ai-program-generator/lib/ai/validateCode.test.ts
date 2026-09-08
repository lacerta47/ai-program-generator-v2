import { describe, it, expect } from 'vitest';
import { validateGeneratedCode, gateReasonKey } from './validateCode';

describe('gateReasonKey — 실패 사유 → 집계 키', () => {
  it('각 검사의 사유 문구를 짧은 키로 바꾼다', () => {
    expect(gateReasonKey('줄바꿈 없는 // 주석이 뒤 코드를 삼킴: "x"')).toBe('swallowed');
    expect(gateReasonKey('JS 문법 오류: Unexpected token')).toBe('syntax');
    expect(gateReasonKey('HTML에 없는 요소를 참조: a')).toBe('missingId');
    expect(gateReasonKey('정의 없는 이름을 호출/참조: gameLoop')).toBe('undefinedRef');
    expect(gateReasonKey('HTML에 없는 클래스를 참조: .x')).toBe('missingClass');
    expect(gateReasonKey('알 수 없음')).toBe('other');
  });

  it('validateGeneratedCode의 실제 반환값과 키가 맞물린다', () => {
    const r = validateGeneratedCode({ html: '', css: '', javascript: 'undefinedThing();' });
    expect(r && gateReasonKey(r)).toBe('undefinedRef');
  });
});

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

  it('정의 없는 함수 호출·변수 참조를 잡는다 (실측: gameLoop(), saveRecords(), html2canvas)', () => {
    const html = '<button id="go"></button>';
    expect(validateGeneratedCode({ ...base, html, javascript: `function start() { gameLoop(); }\nstart();` })).toMatch(
      /정의 없는 이름.*gameLoop/,
    );
    expect(validateGeneratedCode({ ...base, html, javascript: `pullButton.addEventListener('click', () => {});` })).toMatch(
      /정의 없는 이름.*pullButton/,
    );
    expect(validateGeneratedCode({ ...base, html, javascript: `html2canvas(document.body);` })).toMatch(/html2canvas/);
  });

  it('선언된 이름·매개변수·구조분해·catch·html id·브라우저 전역은 미정의로 보지 않는다', () => {
    const html = '<div id="board"></div><p class="x"></p>';
    const js = `
      const { sin, cos } = Math; let [a, b] = [1, 2]; var total = 0;
      function tick(dt, cb) { cb(dt); requestAnimationFrame(tick); }
      const draw = (ctx) => { ctx.fillRect(0, 0, 1, 1); };
      items.forEach(item => item.update());
      try { localStorage.getItem('k'); } catch (err) { console.log(err.message); }
      for (const el of document.querySelectorAll('.x')) el.textContent = String(sin(a) + cos(b) + total);
      board.textContent = 'hi'; window.addEventListener('resize', () => draw(board));
      class Ball { move() { this.x += 1; } } new Ball().move(); const it2 = new Audio(); parseInt('1');
      setTimeout(() => tick(0, (d) => draw(d)), 10);
    `;
    // items는 미정의라 걸려야 하고, 나머지는 전부 통과해야 한다.
    expect(validateGeneratedCode({ ...base, html, javascript: js })).toBe('정의 없는 이름을 호출/참조: items');
    expect(validateGeneratedCode({ ...base, html, javascript: `const items = [];\n${js}` })).toBeNull();
  });

  it('대문자 시작 이름(생성자·내장)은 검사하지 않는다', () => {
    expect(validateGeneratedCode({ ...base, html: '', javascript: `const m = new Map(); const c = new AudioContext(); Tone.start();` })).toBeNull();
  });

  it('HTML에 없는 클래스 셀렉터를 잡되, JS가 문자열로 붙이는 클래스는 통과', () => {
    const html = '<div class="tool active"></div>';
    expect(validateGeneratedCode({ ...base, html, javascript: `document.querySelector('.tool').classList.add('on');` })).toBeNull();
    expect(validateGeneratedCode({ ...base, html, javascript: `document.querySelector('.missing').classList.add('on');` })).toMatch(
      /없는 클래스.*\.missing/,
    );
    const dyn = `const d = document.createElement('div'); d.className = 'made'; document.body.appendChild(d); document.querySelector('.made').textContent = 'x';`;
    expect(validateGeneratedCode({ ...base, html, javascript: dyn })).toBeNull();
  });

  it('querySelectorAll의 없는 클래스는 빈 목록이라 통과, querySelector(단일)만 잡는다', () => {
    const html = '<div class="a"></div>';
    expect(validateGeneratedCode({ ...base, html, javascript: `document.querySelectorAll('.tempo-btn').forEach(b => b.remove());` })).toBeNull();
    expect(validateGeneratedCode({ ...base, html, javascript: `document.querySelector('.tempo-btn').remove();` })).toMatch(/\.tempo-btn/);
  });

  it('변수로 id를 붙이는 헬퍼가 있으면 없는 id 검사를 건너뛴다(동적 생성 오탐 방지)', () => {
    const js = `function make(id) { const el = document.createElement('div'); el.id = id; document.body.appendChild(el); return el; }
      let key = document.getElementById('key-item'); if (!key) key = make('key-item'); key.textContent = 'k';`;
    expect(validateGeneratedCode({ ...base, html: '<div id="root"></div>', javascript: js })).toBeNull();
  });

  it('없는 클래스라도 결과를 null 검사하면 통과(두더지 .mole-item 오탐 방지)', () => {
    const html = '<div class="cell"></div>';
    const guarded = `const cell = document.querySelector('.cell'); const mole = cell.querySelector('.mole-item'); if (mole) { mole.remove(); }`;
    expect(validateGeneratedCode({ ...base, html, javascript: guarded })).toBeNull();
    const unguarded = `const mole = document.querySelector('.mole-item'); mole.remove();`;
    expect(validateGeneratedCode({ ...base, html, javascript: unguarded })).toMatch(/\.mole-item/);
  });

  it('addEventListener에 넘긴 콜백 이름이 정의돼 있지 않으면 잡는다(selectStarStamp)', () => {
    const html = '<button id="b"></button>';
    expect(validateGeneratedCode({ ...base, html, javascript: `document.getElementById('b').addEventListener('click', selectStarStamp);` })).toMatch(
      /selectStarStamp/,
    );
    expect(validateGeneratedCode({ ...base, html, javascript: `function go() {}\ndocument.getElementById('b').addEventListener('click', go);` })).toBeNull();
  });

  it('주석 속 예시 셀렉터는 실제 참조로 보지 않는다', () => {
    const js = `/* 예) getElementById('timer-display') */\nconst a = document.getElementById('real');`;
    expect(validateGeneratedCode({ ...base, html: '<p id="real"></p>', javascript: js })).toBeNull();
  });
});
