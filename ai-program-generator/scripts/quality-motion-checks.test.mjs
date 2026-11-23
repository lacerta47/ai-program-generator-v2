import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { planMazeRoute } from './quality-motion-checks.mjs';

test('maze routes exclude walls and use the only open turn to reach the key', () => {
  const start = { x: 1, y: 1 };
  const gate = { x: 2, y: 1 };
  const key = { x: 2, y: 2 };
  assert.deepEqual(planMazeRoute([start, gate, key], start, key).map(step => step.key), ['ArrowRight', 'ArrowDown']);
  assert.equal(planMazeRoute([start, gate, key], start, key, [gate]), null);
});

function mazeApp(gateBehavior, restartMode) {
  const board = document.getElementById('maze-board');
  const restart = document.getElementById('maze-restart');
  const victoryRestart = document.getElementById('victory-restart-btn');
  const victory = document.getElementById('maze-victory');
  const available = new Set(['1,1', '2,1', '3,1', '3,2']);
  let x, y, hasKey, frozen = false;
  function render() {
    board.replaceChildren();
    for (let row = 0; row < 5; row++) for (let column = 0; column < 5; column++) {
      const coordinate = [column, row].join(',');
      const cell = document.createElement('div');
      cell.dataset.x = column;
      cell.dataset.y = row;
      cell.dataset.mazeCell = available.has(coordinate) ? 'path' : 'wall';
      if (coordinate === '3,1') cell.dataset.mazeExit = '';
      if (coordinate === '3,2' && !hasKey) cell.dataset.mazeGoal = '';
      if (x === column && y === row) cell.dataset.mazePlayer = '';
      board.append(cell);
    }
  }
  function reset() {
    frozen = restartMode === 'frozen' && board.dataset.mazeState === 'won';
    x = y = 1;
    hasKey = false;
    victory.hidden = restart.hidden = true;
    board.dataset.mazeState = 'playing';
    render();
  }
  const directions = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  function move(key) {
    if (frozen || !directions[key] || board.dataset.mazeState !== 'playing') return;
    const [dx, dy] = directions[key];
    const next = [x + dx, y + dy].join(',');
    if (!available.has(next) || (next === '3,1' && gateBehavior === 'blocked' && !hasKey)) return;
    x += dx;
    y += dy;
    if (next === '3,2') hasKey = true;
    if (next === '3,1' && hasKey) {
      board.dataset.mazeState = 'won';
      victory.hidden = restart.hidden = false;
    } else if (next === '3,1' && gateBehavior === 'early-victory') {
      victory.hidden = false;
    } else if (next === '3,1' && gateBehavior === 'early-key') {
      hasKey = true;
    }
    render();
  }
  addEventListener('keydown', event => move(event.key));
  for (const button of document.querySelectorAll('[data-maze-move]')) {
    button.onclick = () => move(button.dataset.mazeMove);
  }
  restart.onclick = reset;
  if (victoryRestart) victoryRestart.onclick = reset;
  reset();
}

function mazeFixture(gateBehavior = 'open', restartMode = 'page') {
  const victoryButton = restartMode === 'modal' ? '<button id="victory-restart-btn">한 번 더 놀기</button>' : '';
  const overlay = ['modal', 'covered'].includes(restartMode)
    ? '#maze-victory:not([hidden]){position:fixed;inset:0;z-index:5;display:grid;place-content:center;background:white}'
    : '';
  return {
    type: 'maze', answers: { goal: 'key' },
    code: {
      html: '<div id="maze-board"></div><button data-maze-move="ArrowRight">→</button>'
        + '<section id="maze-victory" hidden><p>탈출했어요</p>' + victoryButton + '</section>'
        + '<button id="maze-restart" hidden>다시</button>',
      css: '#maze-board{display:grid;width:200px;grid-template-columns:repeat(5,40px)}'
        + '[data-maze-cell]{height:40px}[data-maze-player]{background:blue}[data-maze-cell="wall"]{background:#333}' + overlay,
      javascript: '(' + mazeApp + ')(' + JSON.stringify(gateBehavior) + ',' + JSON.stringify(restartMode) + ')',
    },
  };
}

function aquariumApp(expireFood) {
  const stage = document.getElementById('aquarium-stage');
  const fish = document.getElementById('fish');
  const food = document.getElementById('food');
  let x = 0.48, y = 0.48, pellet, eaten = 0;
  stage.dataset.aquariumMode = 'feed';
  stage.onclick = event => {
    const box = stage.getBoundingClientRect();
    pellet = { id: 2, x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
    if (expireFood) setTimeout(() => { pellet = null; }, 500);
  };
  function swim(time) {
    if (pellet && !expireFood) {
      const dx = pellet.x - x, dy = pellet.y - y, length = Math.hypot(dx, dy);
      if (length < 0.024) { pellet = null; eaten++; }
      else { x += dx / length * 0.008; y += dy / length * 0.008; }
    } else {
      x = 0.48 + Math.sin(time / 350) * 0.07;
    }
    fish.style.left = x * 100 + '%';
    fish.style.top = y * 100 + '%';
    food.hidden = !pellet;
    if (pellet) {
      food.style.left = pellet.x * 100 + '%';
      food.style.top = pellet.y * 100 + '%';
    }
    stage.dataset.aquariumTracks = JSON.stringify([{ id: 1, x, y }]);
    stage.dataset.aquariumFood = JSON.stringify(pellet ? [pellet] : []);
    stage.dataset.aquariumEaten = eaten;
    requestAnimationFrame(swim);
  }
  swim(0);
}

function aquariumFixture(expireFood, layout = 'normal') {
  const baseCss = '#aquarium-stage{position:relative;height:300px;max-width:500px;background:#b5e9fa}'
    + '#fish,#food{position:absolute;pointer-events:none;width:10px;height:10px;border-radius:50%;background:navy}';
  const overflowCss = '.stage-card{min-width:440px}#aquarium-stage{width:100%;aspect-ratio:4/3;min-height:300px}';
  const guide = readFileSync(new URL('../lib/ai/typeGuides.ts', import.meta.url), 'utf8');
  const mobileCss = guide.match(/(@media \(max-width: 600px\) \{[\s\S]*?\n\})/)?.[1];
  assert(mobileCss, 'Aquarium mobile CSS example is missing');
  return {
    type: 'aquarium', answers: { click: 'feed', grow: 'none' },
    code: {
      html: '<section class="stage-card"><div id="aquarium-stage"><i id="fish"></i><i id="food" hidden></i></div></section>',
      css: baseCss + (layout === 'normal' ? '' : overflowCss) + (layout === 'fixed' ? mobileCss : ''),
      javascript: '(' + aquariumApp + ')(' + expireFood + ')',
    },
  };
}

test('offline inspector verifies maze goals, usable restart controls, and aquarium feeding', () => {
  const root = realpathSync(tmpdir());
  const dir = mkdtempSync(join(root, 'lun-quality-motion-'));
  try {
    const results = {
      'maze-key': mazeFixture(), 'maze-block': mazeFixture('blocked'),
      'maze-early-victory': mazeFixture('early-victory'),
      'maze-early-key': mazeFixture('early-key'),
      'maze-modal-restart': mazeFixture('open', 'modal'),
      'maze-covered-restart': mazeFixture('open', 'covered'),
      'maze-frozen-restart': mazeFixture('open', 'frozen'),
      'aquarium-feed': aquariumFixture(false), 'aquarium-expiry': aquariumFixture(true),
      'aquarium-overflow': aquariumFixture(false, 'overflow'),
      'aquarium-mobile-fix': aquariumFixture(false, 'fixed'),
      'aquarium-count': { ...aquariumFixture(false), answers: { click: 'feed', count: 'few' } },
    };
    for (const [name, result] of Object.entries(results)) {
      writeFileSync(join(dir, name + '-after.json'), JSON.stringify(result));
    }
    const inspector = fileURLToPath(new URL('inspect-quality-actions.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [inspector, dir], { encoding: 'utf8', timeout: 85_000 });
    assert.equal(run.status, 0, run.stdout + run.stderr + (run.error ?? ''));
    const output = name => JSON.parse(readFileSync(join(dir, name + '-after.actions.json'), 'utf8'));
    const maze = output('maze-key'), aquarium = output('aquarium-feed');
    assert.deepEqual(maze.errors, [], JSON.stringify(maze));
    assert.equal(maze.mazeGoals.status, 'pass');
    assert.equal(maze.mazeGoals.gateChecked, true);
    assert.equal(maze.mazeGoals.reachedExit, true);
    assert.equal(maze.mazeGoals.victorySignaled, true);
    assert.equal(maze.mazeGoals.restarted, true);
    assert.equal(maze.mazeGoals.restartControl, 'page');
    assert.equal(output('maze-block').mazeGoals.reason, 'movement-blocked');
    assert.equal(output('maze-early-victory').mazeGoals.reason, 'victory-before-collecting');
    assert.equal(output('maze-early-key').mazeGoals.reason, 'goal-removed-at-locked-exit');
    const modal = output('maze-modal-restart');
    assert.deepEqual(modal.errors, [], JSON.stringify(modal));
    assert.equal(modal.mazeGoals.status, 'pass');
    assert.equal(modal.mazeGoals.restartControl, 'victory');
    assert.equal(modal.mazeGoals.restartId, 'victory-restart-btn');
    assert.equal(modal.mazeGoals.restarted, true);
    assert.equal(modal.mazeGoals.movedAfterRestart, true);
    const covered = output('maze-covered-restart');
    assert.equal(covered.mazeGoals.reason, 'restart-not-actionable');
    assert.equal(covered.incomplete, false);
    assert.equal(output('maze-frozen-restart').mazeGoals.reason, 'restart-input-broken');
    assert.deepEqual(aquarium.errors, [], JSON.stringify(aquarium));
    assert.equal(aquarium.aquariumMotion.status, 'pass', JSON.stringify(aquarium.aquariumMotion));
    assert.equal(aquarium.aquariumMotion.mobile, true);
    assert.deepEqual(aquarium.aquariumMotion.viewports.map(result => result.width), [360, 390]);
    assert.equal(aquarium.aquariumMotion.consumed, true);
    assert.equal(output('aquarium-expiry').aquariumMotion.reason, 'food-not-consumed');
    assert.equal(output('aquarium-count').aquariumMotion.reason, 'selected-count-mismatch');
    const overflow = output('aquarium-overflow').aquariumMotion;
    assert.equal(overflow.reason, 'mobile-layout-overflow', JSON.stringify(overflow));
    assert.equal(overflow.feeding.status, 'pass');
    assert.equal(overflow.consumed, true);
    assert(overflow.viewports.every(result => !result.fits));
    const fixed = output('aquarium-mobile-fix').aquariumMotion;
    assert.equal(fixed.status, 'pass', JSON.stringify(fixed));
    assert(fixed.viewports.every(result => result.fits && result.creaturesPreserved));
  } finally {
    const target = realpathSync(dir);
    assert.equal(dirname(target), root);
    rmSync(target, { recursive: true, force: true });
  }
});
