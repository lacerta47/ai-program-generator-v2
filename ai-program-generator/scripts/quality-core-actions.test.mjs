import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { inspectCoreAction } from './quality-core-actions.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE ??
  'C:/Users/amh47/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const fixtures = {
  paint: {
    answers: { save: 'no' },
    html: '<canvas id="paint-canvas" width="240" height="120"></canvas><button id="paint-clear">모두 지우기</button>',
    js: "const c = document.querySelector('canvas'), ctx = c.getContext('2d'); c.onpointermove = e => { if (e.buttons) ctx.fillRect(e.offsetX, e.offsetY, 8, 8); }; document.querySelector('button').onclick = () => ctx.clearRect(0, 0, c.width, c.height);",
    bad: 'c.onpointermove = null;',
  },
  paintPng: {
    type: 'paint',
    answers: { save: 'download' },
    html: '<canvas id="paint-canvas" width="200" height="80"></canvas><button id="paint-clear">지우기</button><button id="paint-save">PNG</button><img hidden id="paint-png" alt="내 그림">',
    js: "const c = document.querySelector('canvas'), ctx = c.getContext('2d'); c.onpointermove = e => { if (e.buttons) ctx.fillRect(e.offsetX, e.offsetY, 8, 8); }; document.getElementById('paint-clear').onclick = () => ctx.clearRect(0, 0, c.width, c.height); document.getElementById('paint-save').onclick = () => { const img = document.querySelector('img'); img.src = c.toDataURL('image/png'); img.hidden = false; };",
    bad: "document.getElementById('paint-save').onclick = null;",
  },
  game: {
    answers: { genre: 'rps', rps_rounds: 'best3' },
    html: '<div id="game-stage" data-game-state="ready"><button id="game-start">시작</button><div id="moves" hidden><button data-rps-move="rock">바위</button><button data-rps-move="paper">보</button><button data-rps-move="scissors">가위</button></div><div id="game-end" hidden><button id="game-restart">다시 시작</button></div></div>',
    js: "const stage = document.getElementById('game-stage'), end = document.getElementById('game-end'); let wins = 0; const start = () => { wins = 0; stage.dataset.gameState = 'playing'; end.hidden = true; moves.hidden = false; }; document.getElementById('game-start').onclick = start; document.getElementById('game-restart').onclick = start; for (const action of moves.querySelectorAll('button')) action.onclick = () => { if (++wins === 2) setTimeout(() => { stage.dataset.gameState = 'ended'; end.hidden = false; }, 550); };",
    bad: "document.getElementById('game-restart').onclick = null;",
  },
  card: {
    answers: { nameField: 'yes' },
    html: '<section id="card-preview"><p id="card-message">축하해요!</p><output id="card-recipient">친구야</output><input id="card-name"></section>',
    js: "document.getElementById('card-name').oninput = e => { document.getElementById('card-recipient').textContent = e.target.value; };",
    bad: "document.getElementById('card-name').oninput = null;",
  },
  calc: {
    answers: { mode: 'calc', ops: ['add'] },
    html: '<output id="calc-result">0</output><button data-calc-key="8">8</button><button data-calc-key="2">2</button><button data-calc-key="add">+</button><button data-calc-key="equals">=</button>',
    js: "let expression = ''; for (const key of document.querySelectorAll('button')) key.onclick = () => { const value = key.dataset.calcKey; if (value === 'equals') { const numbers = expression.split('+').map(Number); document.getElementById('calc-result').textContent = numbers[0] + numbers[1]; } else expression += value === 'add' ? '+' : value; };",
    bad: "document.querySelector('[data-calc-key=equals]').onclick = null;",
  },
  calcLed: {
    type: 'calc',
    answers: { mode: 'calc', ops: ['pct'], display: 'ledold' },
    html: '<style>#calc-result-value{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}</style><output id="calc-result" aria-live="polite"><span aria-hidden="true">.</span><span id="calc-result-value">0</span></output><button data-calc-key="8">8</button><button data-calc-key="pct">%</button>',
    js: "let input = 0; const value = document.getElementById('calc-result-value'); document.querySelector('[data-calc-key=\"8\"]').onclick = () => { input = 8; value.textContent = input; }; document.querySelector('[data-calc-key=\"pct\"]').onclick = () => { value.textContent = input / 100; };",
    bad: "document.getElementById('calc-result-value').setAttribute('aria-hidden', 'true');",
  },
  calcPractice: {
    type: 'calc',
    answers: { mode: 'times' },
    html: '<p id="calc-problem">2×3</p><input id="calc-entry" type="number"><button id="calc-check">확인</button><output id="calc-feedback" data-answer-status="idle"></output>',
    js: "document.getElementById('calc-check').onclick = () => { const answer = document.querySelector('input').value; if (!answer) return; const feedback = document.getElementById('calc-feedback'); feedback.dataset.answerStatus = Number(answer) === 6 ? 'correct' : 'incorrect'; feedback.textContent = Number(answer) === 6 ? '정답' : '다시 해보세요'; };",
    bad: "document.querySelector('button').onclick = () => { document.getElementById('calc-feedback').dataset.answerStatus = 'incorrect'; };",
  },
  fortune: {
    answers: { count: 'three', again: 'no' },
    html: '<button id="fortune-draw">뽑기</button><section id="fortune-results"></section>',
    js: "document.querySelector('button').onclick = e => { document.querySelector('section').innerHTML = '<p data-fortune-message>좋은 일이 있어요</p><p data-fortune-message>오늘도 웃어요</p><p data-fortune-message>친구를 만나요</p>'; e.currentTarget.disabled = true; };",
    bad: "document.querySelector('button').addEventListener('click', e => { e.currentTarget.disabled = false; });",
  },
  fortunePng: {
    type: 'fortune',
    answers: { count: 'one', share: 'save' },
    html: '<button id="fortune-draw">뽑기</button><section id="fortune-results"></section><button id="fortune-image-button" hidden>PNG</button><img id="fortune-image" alt="메시지 그림" hidden>',
    js: "const save = document.getElementById('fortune-image-button'); document.getElementById('fortune-draw').onclick = () => { document.querySelector('section').innerHTML = '<p data-fortune-message>오늘도 웃어요</p>'; save.hidden = false; }; save.onclick = () => { const canvas = document.createElement('canvas'); canvas.getContext('2d').fillText(document.querySelector('p').textContent, 5, 12); const image = document.querySelector('img'); image.src = canvas.toDataURL('image/png'); image.hidden = false; };",
    bad: "save.onclick = null;",
  },
  riddle: {
    type: 'fortune',
    answers: { kind: 'riddle', count: 'one', again: 'no' },
    html: '<button id="fortune-draw">뽑기</button><section id="fortune-results"></section>',
    js: "document.querySelector('button').onclick = e => { document.querySelector('section').innerHTML = '<article data-fortune-message>하늘에서 내리는 하얀 것은?<button data-fortune-answer>정답 보기</button><p data-fortune-solution hidden>눈</p></article>'; document.querySelector('[data-fortune-answer]').onclick = () => { document.querySelector('[data-fortune-solution]').hidden = false; }; e.currentTarget.disabled = true; };",
    bad: "document.querySelector('section').addEventListener('click', e => { if (e.target.matches('[data-fortune-answer]')) document.querySelector('[data-fortune-solution]').hidden = true; });",
  },
  sound: {
    answers: { instrument: 'piano', playmode: 'free' },
    html: '<button data-sound-pad="C4">도</button>',
    js: "let ctx; document.querySelector('button').onclick = async () => { ctx ??= new AudioContext(); await ctx.resume(); const osc = ctx.createOscillator(), gain = ctx.createGain(); gain.gain.value = 0.01; osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.05); };",
    bad: "document.querySelector('button').onclick = null;",
  },
  soundLarge: {
    type: 'sound',
    answers: { instrument: 'piano', playmode: 'free', keycount: 'large' },
    html: '<style>#keys{display:grid;grid-template-columns:repeat(4,minmax(44px,1fr));gap:6px} #keys button{min-height:44px}</style><div id="keys"></div>',
    js: "let ctx; for (let i = 0; i < 13; i++) { const pad = document.createElement('button'); pad.dataset.soundPad = i; pad.textContent = i + 1; pad.onclick = async () => { ctx ??= new AudioContext(); await ctx.resume(); const tone = ctx.createOscillator(), gain = ctx.createGain(); gain.gain.value = 0.01; tone.frequency.value = 220 + i * 10; tone.connect(gain).connect(ctx.destination); tone.start(); tone.stop(ctx.currentTime + 0.07); }; document.getElementById('keys').append(pad); }",
    bad: "document.querySelectorAll('#keys button').forEach(pad => { pad.style.width = '36px'; });",
  },
  dressup: {
    answers: { base: 'animal', random: 'both', finish: 'card' },
    html: '<section id="dressup-stage">고양이</section><button id="dressup-random">랜덤</button><button id="dressup-reset">처음부터</button><button id="dressup-finish">완성</button><article id="dressup-result" hidden>고양이 카드</article>',
    js: "document.getElementById('dressup-finish').onclick = () => { document.getElementById('dressup-result').hidden = false; };",
    bad: "document.getElementById('dressup-finish').onclick = null;",
  },
  photoDressup: {
    type: 'dressup',
    answers: { base: 'photo', random: 'both', finish: 'card' },
    html: '<section id="dressup-stage"><img id="dressup-photo" width="48" height="48" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22green%22/%3E%3C/svg%3E" alt="예시 그림"></section><button id="dressup-random">랜덤</button><button id="dressup-reset">처음부터</button><button id="dressup-finish">완성</button><article id="dressup-result" hidden>사진 카드</article>',
    js: "document.getElementById('dressup-finish').onclick = () => { document.getElementById('dressup-result').hidden = false; };",
    bad: "document.getElementById('dressup-random').onclick = () => { document.getElementById('dressup-photo').setAttribute('src', ''); };",
  },
  clock: {
    answers: { kind: 'timer', controls: 'onebig' },
    html: '<output id="clock-display" data-clock-seconds="8">8</output><button id="clock-start">시작</button><button id="clock-reset">다시</button>',
    js: "const clock = document.getElementById('clock-display'); let remaining = 8, deadline = 0; const draw = () => { clock.textContent = remaining; clock.dataset.clockSeconds = remaining; }; const start = document.getElementById('clock-start'); start.onclick = () => { deadline = deadline ? 0 : Date.now() + remaining * 1000; start.textContent = deadline ? '멈춤' : '시작'; }; document.getElementById('clock-reset').onclick = () => { deadline = 0; remaining = 8; start.textContent = '시작'; draw(); }; setInterval(() => { if (!deadline) return; remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); draw(); }, 100);",
    bad: "document.getElementById('clock-start').onclick = null;",
  },
};

const server = createServer((request, response) => {
  const [section, name, mode] = request.url.slice(1).split('/');
  const fixture = Object.hasOwn(fixtures, name) ? fixtures[name] : null;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!fixture) return response.end('');
  if (section === 'view') return response.end('<style>body{margin:0}iframe{display:block;width:100%;height:820px;border:0}</style>' +
    '<iframe sandbox="allow-scripts" src="/frame/' + name + '/' + mode + '"></iframe>');
  response.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
  response.end('<!doctype html><meta charset="utf-8">' + fixture.html + '<script>' + fixture.js +
    (mode === 'bad' ? fixture.bad : '') + '</script>');
});

let browser;
before(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath = process.env.CHROMIUM_EXECUTABLE ??
    (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  browser = await chromium.launch({ executablePath });
});
after(async () => {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
});

async function inspect(name, mode, width) {
  const fixture = fixtures[name], type = fixture.type ?? name;
  const page = await browser.newPage({ viewport: { width, height: 844 } });
  try {
    if (type === 'clock') await page.clock.install();
    await page.goto('http://127.0.0.1:' + server.address().port + '/view/' + name + '/' + mode);
    const frame = page.frames().find(item => item.url().includes('/frame/'));
    return await inspectCoreAction(frame, page, type, fixture.answers, true);
  } finally {
    await page.close();
  }
}

for (const name of Object.keys(fixtures)) {
  test(name + ' works at 360px and 390px and detects a broken action', async () => {
    for (const width of [360, 390]) {
      const result = await inspect(name, 'good', width);
      assert.equal(result.status, 'passed', JSON.stringify(result));
      assert.ok(result.checks.length > 0);
    }
    const result = await inspect(name, 'bad', 360);
    assert.equal(result.status, 'failed', JSON.stringify(result));
  });
}

test('missing markers are unverified for historical samples and fail strict inspection', async () => {
  const page = await browser.newPage();
  try {
    assert.equal((await inspectCoreAction(page.mainFrame(), page, 'paint')).status, 'unverified');
    assert.equal((await inspectCoreAction(page.mainFrame(), page, 'paint', {}, true)).status, 'failed');
  } finally {
    await page.close();
  }
});
