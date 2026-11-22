import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function quizApp(withMetadata) {
  const byId = (id) => document.getElementById('quiz-' + id);
  const question = byId('question'), confirm = byId('confirm'), feedback = byId('feedback');
  const next = byId('next'), finish = byId('finish'), restart = byId('restart'), input = byId('answer');
  const correction = byId('correction'), explanation = byId('explanation');
  let position = 0, selected = '', graded = false, timer;
  function grade(state) {
    if (graded) return;
    const answer = input?.value || selected;
    if (!answer && state !== 'timeout') {
      if (withMetadata) feedback.dataset.quizState = 'empty';
      correction.textContent = '답을 골라 주세요.';
      return;
    }
    graded = true;
    clearTimeout(timer);
    if (withMetadata) feedback.dataset.quizState = state === 'timeout' ? state : answer === '4' ? 'correct' : 'incorrect';
    correction.textContent = (state === 'timeout' ? '시간이 끝났어요!' : answer === '4' ? '맞았어요!' : '아쉬워요.') + ' 정답: 4';
    explanation.textContent = '두 수를 계산하면 4예요.';
    next.hidden = false;
  }
  function reset() {
    clearTimeout(timer);
    selected = '';
    if (input) input.value = '';
    graded = false;
    question.textContent = ['2 + 2', '5 - 1', '2 × 2'][position];
    if (withMetadata) feedback.dataset.quizState = 'ready';
    correction.textContent = '';
    explanation.textContent = '';
    next.hidden = finish.hidden = restart.hidden = true;
    if (input) timer = setTimeout(() => grade('timeout'), 10_000);
  }
  for (const option of document.querySelectorAll('[data-quiz-option]')) option.onclick = () => { selected = option.textContent; };
  if (input) input.onkeydown = e => { if (e.key === 'Enter') grade(); };
  confirm.onclick = () => grade();
  next.onclick = () => {
    if (++position < 3) reset();
    else { next.hidden = true; finish.hidden = restart.hidden = false; }
  };
  restart.onclick = () => { position = 0; reset(); };
  reset();
}

function quiz(typed, broken = false, withMetadata = true) {
  const html = '<h1 id="quiz-question">문제</h1>'
    + (typed ? '<input id="quiz-answer" inputmode="numeric">'
      : '<button data-quiz-option>4</button><button data-quiz-option>6</button>')
    + '<button type="button" id="quiz-confirm">확인</button>'
    + '<div id="quiz-feedback" aria-live="polite"><p id="quiz-correction"></p><p id="quiz-explanation"></p></div>'
    + '<button id="quiz-next" hidden>다음</button><p id="quiz-finish" hidden>다 풀었어요!</p>'
    + '<button id="quiz-restart" hidden>다시하기</button>';
  return { type: 'quiz', answers: { topic: '숫자', count: '3', lives: 'no', answer: typed ? 'type' : 'choice2', timer: typed ? 'yes10' : 'no' },
    code: { html, css: 'body{padding:12px}', javascript: broken ? '' : '(' + quizApp + ')(' + withMetadata + ')' } };
}

function rouletteApp(again, broken) {
  const el = name => document.getElementById('roulette-' + name);
  const wheel = el('wheel'), legend = el('legend'), result = el('result');
  const items = ['사과', '배', '귤', '포도'];
  let spinning = false, complete = 0;
  function draw() {
    const sweep = 360 / items.length;
    const colors = ['#fe9', '#e9f', '#9f9', '#fc9'];
    const stops = items.map((_, i) => colors[i] + ' ' + i * sweep + 'deg ' + (i + 1) * sweep + 'deg');
    wheel.style.background = 'conic-gradient(from ' + (-sweep / 2) + 'deg, ' + stops.join(',') + ')';
    wheel.innerHTML = items.map((_, i) => {
      const a = i * Math.PI * 2 / items.length;
      return '<span data-roulette-slot="' + (i + 1) + '" style="left:' + (50 + 33 * Math.sin(a)) +
        '%;top:' + (50 - 33 * Math.cos(a)) + '%">' + (i + 1) + '</span>';
    }).join('');
    legend.innerHTML = items.map((item, i) => '<li data-roulette-item="' + (i + 1) +
      '"><span data-roulette-label>' + item + '</span></li>').join('');
  }
  function spin() {
    if (spinning) return;
    spinning = true;
    if (complete && again === 'exclude' && items.length > 1) items.shift();
    draw();
    wheel.style.transform = 'rotate(' + (complete + 1) * 360 + 'deg)';
    const finish = () => {
      result.textContent = '당첨 결과: ' + items[broken ? 1 : 0];
      wheel.dataset.spinCount = ++complete;
      el('again').hidden = again === 'no';
      spinning = false;
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else setTimeout(finish, 80);
  }
  draw();
  el('spin').onclick = el('again').onclick = spin;
  if (again === 'no') wheel.onclick = spin;
}

function roulette(again, broken = false) {
  const html = '<div id="mount"><div id="roulette-wheel" data-spin-count="0"></div>'
    + '<i id="roulette-pointer" data-direction="down"></i></div>'
    + '<button id="roulette-spin">돌리기</button><p id="roulette-result">눌러 보세요</p>'
    + '<button id="roulette-again" hidden>다시 돌리기</button><ul id="roulette-legend"></ul>';
  const css = '#mount{position:relative;margin:44px auto 8px;width:220px;height:220px}'
    + '#roulette-wheel{position:absolute;inset:0;border-radius:50%}'
    + '#roulette-wheel span{position:absolute;transform:translate(-50%,-50%)}'
    + '#roulette-pointer{position:absolute;top:-12px;left:calc(50% - 9px);width:0;height:0;'
    + 'border-left:9px solid transparent;border-right:9px solid transparent;border-top:15px solid #202532}';
  const javascript = '(' + rouletteApp + ')(' + JSON.stringify(again) + ',' + broken + ')';
  return { type: 'roulette', answers: { use: 'snack', slots: 's4', again }, code: { html, css, javascript } };
}

function ledCalculator() {
  return {
    type: 'calc',
    answers: { mode: 'calc', ops: ['pct'], display: 'ledold' },
    code: {
      html: '<output id="calc-result"><span aria-hidden="true">.</span><span id="calc-result-value" aria-live="polite">0</span></output>'
        + '<button data-calc-key="8">8</button><button data-calc-key="pct">%</button>',
      css: '#calc-result-value{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}',
      javascript: "let number = 0; const value = document.querySelector('#calc-result-value'); "
        + "document.querySelector('[data-calc-key=\"8\"]').onclick = () => { number = 8; value.textContent = number; }; "
        + "document.querySelector('[data-calc-key=pct]').onclick = () => { value.textContent = number / 100; };",
    },
  };
}

// Run the real offline inspector with working and broken samples. No AI or public network.
test('offline inspector distinguishes working quiz, roulette and LED flows from broken outputs', () => {
  const root = realpathSync(tmpdir());
  const dir = mkdtempSync(join(root, 'lun-quality-actions-'));
  try {
    const fixtures = {
      'quiz-choices': quiz(false), 'quiz-typed-timer': quiz(true), 'quiz-dead-confirm': quiz(false, true),
      'quiz-visible-feedback': quiz(false, false, false),
      'roulette-repeat': roulette('yes'), 'roulette-exclude': roulette('exclude'), 'roulette-wheel': roulette('no'),
      'roulette-delegated': { ...roulette('exclude'), answers: { again: 'aichoose' } },
      'roulette-wrong-winner': roulette('yes', true),
      'calc-led-text': ledCalculator(),
    };
    for (const [name, fixture] of Object.entries(fixtures)) {
      writeFileSync(join(dir, name + '-after.json'), JSON.stringify(fixture));
    }
    const runner = fileURLToPath(new URL('inspect-quality-actions.mjs', import.meta.url));
    const execution = spawnSync(process.execPath, [runner, dir], { encoding: 'utf8', timeout: 110_000 });
    assert.equal(execution.status, 0, execution.stdout + execution.stderr + (execution.error ?? ''));
    const outputs = Object.fromEntries(Object.keys(fixtures).map(name =>
      [name, JSON.parse(readFileSync(join(dir, name + '-after.actions.json'), 'utf8'))]));
    for (const [name, result] of Object.entries(outputs)) assert.equal(result.incomplete, false, JSON.stringify({ name, result }));
    for (const name of ['quiz-choices', 'quiz-typed-timer', 'quiz-visible-feedback', 'roulette-repeat', 'roulette-exclude', 'roulette-wheel', 'roulette-delegated']) {
      assert.deepEqual(outputs[name].errors, [], name);
    }
    assert.deepEqual(outputs['quiz-choices'].quizContract.graded, ['correct', 'incorrect', 'correct']);
    assert.equal(outputs['quiz-visible-feedback'].quizContract.metadataWarnings, 4);
    assert.deepEqual(outputs['quiz-typed-timer'].quizContract.graded, ['incorrect', 'incorrect', 'incorrect']);
    assert.equal(outputs['quiz-typed-timer'].quizContract.timeout, true);
    assert.deepEqual(outputs['roulette-repeat'].rouletteContract.spins.map(spin => spin.winner), ['사과', '사과']);
    assert.deepEqual(outputs['roulette-exclude'].rouletteContract.spins.map(spin => spin.count), [4, 3]);
    assert.deepEqual(outputs['roulette-delegated'].rouletteContract.spins.map(spin => spin.count), [4, 3]);
    assert(outputs['quiz-dead-confirm'].errors.some(error => error.stage === 'quiz-empty'));
    assert(outputs['roulette-wrong-winner'].errors.some(error => error.stage === 'roulette-result'));
    assert.deepEqual(outputs['calc-led-text'].errors, []);
    assert.deepEqual(outputs['calc-led-text'].coreAction.runs.map(run => run.status), ['passed', 'passed']);
  } finally {
    const target = realpathSync(dir);
    assert.equal(dirname(target), root);
    rmSync(target, { recursive: true, force: true });
  }
});
