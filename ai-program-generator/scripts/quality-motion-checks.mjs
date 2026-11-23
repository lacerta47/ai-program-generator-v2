const moves = [
  [1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp'],
];
const cellId = ({ x, y }) => [x, y].join(',');

export function planMazeRoute(paths, start, target, blocked = []) {
  const passable = new Set(paths.map(cellId));
  for (const cell of blocked) passable.delete(cellId(cell));
  const startId = cellId(start), targetId = cellId(target);
  if (!passable.has(startId) || !passable.has(targetId)) return null;
  const queue = [start];
  const previous = new Map([[startId, null]]);
  for (let i = 0; i < queue.length && !previous.has(targetId); i++) {
    const point = queue[i];
    for (const [dx, dy, key] of moves) {
      const next = { x: point.x + dx, y: point.y + dy };
      const id = cellId(next);
      if (!passable.has(id) || previous.has(id)) continue;
      previous.set(id, { from: cellId(point), key, next });
      queue.push(next);
    }
  }
  if (!previous.has(targetId)) return null;
  const route = [];
  for (let step = previous.get(targetId); step; step = previous.get(step.from)) route.push(step);
  return route.reverse();
}

const mazeBoard = '#maze-board[data-maze-state]';

async function mazeState(frame) {
  return frame.evaluate(selector => {
    const board = document.querySelector(selector);
    const cells = [...board.querySelectorAll('[data-maze-cell][data-x][data-y]')];
    const point = element => element && { x: Number(element.dataset.x), y: Number(element.dataset.y) };
    return {
      state: board.dataset.mazeState,
      position: point(cells.find(cell => cell.hasAttribute('data-maze-player'))),
      exit: point(cells.find(cell => cell.hasAttribute('data-maze-exit'))),
      goals: cells.filter(cell => cell.hasAttribute('data-maze-goal')).map(point),
      paths: cells.filter(cell => cell.dataset.mazeCell === 'path').map(point),
      width: Math.max(-1, ...cells.map(cell => Number(cell.dataset.x))) + 1,
      height: Math.max(-1, ...cells.map(cell => Number(cell.dataset.y))) + 1,
    };
  }, mazeBoard);
}

export async function inspectMazeGoals(page, frame, answers) {
  if (!(await frame.locator(mazeBoard).count())) return { status: 'unverified', reason: 'maze-markers-missing' };
  const first = await mazeState(frame);
  if (!first.position || !first.exit || !first.paths.length || first.state !== 'playing') {
    return { status: 'fail', reason: 'invalid-start-state' };
  }
  const expectedSize = { small: 11, medium: 15, large: 21, huge: 25 }[answers.size];
  const expectedGoals = answers.goal === 'key' ? 1
    : answers.goal === 'treasure' && /^[135]$/.test(answers.treasure_count) ? Number(answers.treasure_count)
    : answers.goal === 'exit' ? 0 : null;
  const size = [first.width, first.height], goalCount = first.goals.length;
  const report = { size, goalCount, gateChecked: false, reachedExit: false, victorySignaled: false, restarted: false, inputs: 0 };
  const end = (status, reason) => ({ ...report, status, reason });
  if (expectedSize && size.some(side => side !== expectedSize)) return end('fail', 'selected-size-mismatch');
  if ((expectedGoals !== null && expectedGoals !== goalCount)
      || (['star', 'treasure'].includes(answers.goal) && goalCount === 0)) return end('fail', 'selected-goals-missing');
  if (first.goals.some(cell => cellId(cell) === cellId(first.position) || cellId(cell) === cellId(first.exit))) {
    return end('fail', 'goal-overlaps-start-or-exit');
  }
  if (![...first.goals, first.exit].every(target => planMazeRoute(first.paths, first.position, target))) {
    return end('fail', 'unreachable-goal-or-exit');
  }

  let current = first;
  let stalledSince = null;
  const stallBudget = answers.trap?.includes('ghost') ? 6500 : 1000;
  const earlyExit = goalCount > 0 && planMazeRoute(first.paths, first.position, first.exit, first.goals);
  const victory = frame.locator('#maze-victory');
  const deadline = Date.now() + 26_000;
  while (report.inputs < 750 && Date.now() < deadline && current.state === 'playing') {
    const testingGate = earlyExit && !report.gateChecked && current.goals.length === goalCount;
    const candidates = testingGate ? [current.exit] : current.goals.length ? current.goals : [current.exit];
    const route = candidates.map(target => planMazeRoute(current.paths, current.position, target, testingGate ? current.goals : []))
      .filter(steps => steps?.length).sort((a, b) => a.length - b.length)[0];
    if (!route) return end('fail', 'no-progress-route');
    for (const { key, next } of route) {
      if (report.inputs >= 750 || Date.now() >= deadline) break;
      const before = current;
      if (report.inputs === 0) {
        const button = frame.locator('[data-maze-move="' + key + '"]');
        if (!(await button.isVisible())) return end('fail', 'direction-button-missing');
        await button.click({ timeout: 1500 });
      } else {
        await page.keyboard.press(key);
      }
      report.inputs++;
      current = await mazeState(frame);
      if (current.state === 'playing' && current.position && cellId(current.position) === cellId(before.position)) {
        await page.waitForTimeout(250);
        current = await mazeState(frame);
      }
      if (!current.position) return end('fail', 'player-marker-lost');
      if (current.state === 'won' && current.goals.length) return end('fail', 'victory-before-collecting');
      if (testingGate && cellId(current.position) === cellId(current.exit)) {
        if (current.state === 'won' || await victory.isVisible()) return end('fail', 'victory-before-collecting');
        if (current.goals.length !== goalCount) return end('fail', 'goal-removed-at-locked-exit');
        report.gateChecked = current.state === 'playing';
        break;
      }
      if (current.state !== 'playing') break;
      if (cellId(current.position) === cellId(before.position)) {
        stalledSince ??= Date.now();
        if (Date.now() - stalledSince >= stallBudget) return end('fail', 'movement-blocked');
        break;
      }
      stalledSince = null;
      if (cellId(current.position) !== cellId(next) || before.goals.length !== current.goals.length) break;
    }
  }
  if (current.state === 'lost') return end('fail', 'lost-before-completion');
  if (current.state !== 'won') return end('unverified', 'playback-budget-exhausted');
  report.reachedExit = cellId(current.position) === cellId(current.exit);
  report.victorySignaled = await victory.isVisible();
  if (!report.reachedExit || !report.victorySignaled || current.goals.length) return end('fail', 'victory-incomplete');
  const markedInVictory = victory.locator('#maze-restart:visible');
  const namedInVictory = victory.getByRole('button', {
    name: /^다시$|다시\s*(?:하기|시작|도전|놀기|만들기)|재시작|한\s*번\s*더|새\s*미로/u,
  });
  const inVictory = await markedInVictory.count() ? markedInVictory : namedInVictory;
  const useVictory = Boolean(await inVictory.count());
  const restart = (useVictory ? inVictory : frame.locator('#maze-restart:visible')).first();
  if (!(await restart.isVisible())) return end('fail', 'restart-missing');
  report.restartControl = useVictory ? 'victory' : 'page';
  report.restartId = await restart.getAttribute('id');
  try {
    await restart.click({ timeout: 1500 });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
    return end('fail', 'restart-not-actionable');
  }
  const reset = await mazeState(frame);
  const goalsRestored = expectedGoals !== null ? reset.goals.length === expectedGoals
    : (reset.goals.length > 0) === (goalCount > 0);
  report.restarted = reset.state === 'playing' && cellId(reset.position ?? {}) === cellId(first.position)
    && goalsRestored && !(await victory.isVisible());
  if (!report.restarted) return end('fail', 'restart-incomplete');

  const firstStep = reset.exit && planMazeRoute(reset.paths, reset.position, reset.exit)?.[0];
  if (!firstStep) return end('fail', 'restart-route-missing');
  await page.keyboard.press(firstStep.key);
  let moved = await mazeState(frame);
  if (moved.position && cellId(reset.position) === cellId(moved.position)) {
    await page.waitForTimeout(250);
    moved = await mazeState(frame);
  }
  const [dx, dy] = moves.find(([, , key]) => key === firstStep.key);
  const slide = { x: firstStep.next.x + dx, y: firstStep.next.y + dy };
  const destination = cellId(moved.position ?? {});
  report.movedAfterRestart = moved.state === 'playing' && (destination === cellId(firstStep.next)
    || (Boolean(answers.trap?.includes('ice')) && destination === cellId(slide)
      && reset.paths.some(cell => cellId(cell) === destination)));
  if (report.movedAfterRestart) return end('pass');
  const canSendBack = ['hole', 'ghost', 'arrow_trap'].some(trap => answers.trap?.includes(trap));
  if (canSendBack && destination === cellId(reset.position)) return end('unverified', 'restart-movement-ambiguous');
  return end('fail', 'restart-input-broken');
}

const aquariumStage = '#aquarium-stage';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function tankState(stage) {
  return stage.evaluate(element => {
    const box = element.getBoundingClientRect();
    const { aquariumTracks, aquariumFood, aquariumEaten, aquariumMode } = element.dataset;
    function points(value) {
      const list = JSON.parse(value);
      if (!Array.isArray(list) || !list.every(point => point && ['number', 'string'].includes(typeof point.id)
        && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1)
        || new Set(list.map(point => point.id)).size !== list.length) throw new Error('invalid tracks');
      return list;
    }
    try {
      return { tracks: points(aquariumTracks), food: points(aquariumFood), eaten: Number(aquariumEaten), mode: aquariumMode, width: box.width, height: box.height };
    } catch { return null; }
  });
}

export async function inspectAquariumLayout(frame) {
  return frame.evaluate(selector => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const stage = document.querySelector(selector);
    const fits = element => {
      const { left, right, width: w, height } = element.getBoundingClientRect();
      return w > 0 && height > 0 && left >= -1 && right <= width + 1;
    };
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility === 'visible' && rect.width > 0 && rect.height > 0;
    };
    const overflow = Math.max(0, root.scrollWidth - width);
    const visibleControls = [...document.querySelectorAll('.control-panel, button, input, select, [role="button"]')].filter(visible);
    const stageFits = Boolean(stage && visible(stage) && fits(stage));
    const cardFits = Boolean(stage?.parentElement && fits(stage.parentElement));
    const canvasFits = Boolean(stage && [...stage.querySelectorAll('canvas')].filter(visible).every(fits));
    const controlsFit = visibleControls.every(fits);
    return { width, overflow, stageFits, cardFits, canvasFits, controlsFit,
      fits: overflow <= 1 && stageFits && cardFits && canvasFits && controlsFit };
  }, aquariumStage);
}

export async function inspectAquarium(page, frame, answers) {
  const stage = frame.locator(aquariumStage);
  if (!(await stage.count())) return { status: 'unverified', reason: 'tank-markers-missing' };
  const first = await tankState(stage);
  if (!first || !Number.isInteger(first.eaten) || first.eaten < 0
      || !['feed', 'spawn', 'flash', 'ripple', 'nametag', 'none'].includes(first.mode) || !await stage.isVisible()) {
    return { status: 'fail', reason: 'invalid-tank-state' };
  }
  if (!first.tracks.length || first.width < 1 || first.height < 1) return { status: 'fail', reason: 'empty-tank' };
  if (answers.click && answers.click !== 'aichoose' && answers.click !== first.mode) {
    return { status: 'fail', reason: 'selected-mode-mismatch' };
  }
  const initialCount = { few: 5, medium: 10, many: 20, huge: 30 }[answers.count];
  const exactCount = answers.count === 'few' || answers.count === 'medium';
  if (initialCount && (exactCount ? first.tracks.length !== initialCount : first.tracks.length < initialCount)) {
    return { status: 'fail', reason: 'selected-count-mismatch', occupants: first.tracks.length };
  }
  await page.clock.runFor(450);
  const swimming = await tankState(stage);
  const moved = first.tracks.some(point => swimming?.tracks.some(next => next.id === point.id && distance(next, point) > 0.001));
  if (!moved) return { status: 'fail', reason: 'no-movement', occupants: first.tracks.length };
  const viewport = page.viewportSize();
  const viewports = [];
  try {
    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.clock.runFor(200);
      const resized = await tankState(stage);
      const ids = new Set(resized?.tracks.map(point => point.id));
      const creaturesPreserved = resized?.tracks.length === first.tracks.length && first.tracks.every(point => ids.has(point.id));
      viewports.push({ ...await inspectAquariumLayout(frame), creaturesPreserved });
    }
  } finally { if (viewport) await page.setViewportSize(viewport); }
  await page.clock.runFor(200);
  const mobile = viewports.every(layout => layout.fits && layout.creaturesPreserved);
  const feedSelected = first.mode === 'feed';
  const { status: feedStatus, reason: feedReason, ...feeding } = feedSelected ? await inspectAquariumFeeding(page, frame) : {};
  const report = { occupants: first.tracks.length, moved, mobile, viewports, feedSelected, ...feeding,
    ...(feedSelected && { feeding: { status: feedStatus, reason: feedReason } }) };
  const end = (status, reason) => ({ ...report, status, reason });
  if (!viewports.every(layout => layout.fits)) return end('fail', 'mobile-layout-overflow');
  if (!mobile) return end('fail', 'creatures-lost-on-resize');
  return feedSelected ? end(feedStatus, feedReason) : end('pass');
}

export async function inspectAquariumFeeding(page, frame, useTouch = false) {
  const stage = frame.locator(aquariumStage);
  const report = { foodPlaced: false, approached: false, consumed: false };
  const end = (status, reason) => ({ ...report, status, reason });
  const before = await tankState(stage);
  if (!before?.tracks.length || before.food.length) return end('unverified', 'ambiguous-initial-food');
  report.eatenBefore = before.eaten;
  report.occupantsBefore = before.tracks.length;
  const offsets = [0.12, 0.3, 0.5, 0.7, 0.88];
  const spots = offsets.flatMap(x => offsets.map(y => ({ x, y })));
  const point = spots.map(spot => ({ ...spot, nearest: Math.min(...before.tracks.map(fish =>
    Math.hypot((fish.x - spot.x) * before.width, (fish.y - spot.y) * before.height))) }))
    .sort((a, b) => b.nearest - a.nearest)[0];
  const input = { position: { x: before.width * point.x, y: before.height * point.y }, timeout: 1800 };
  if (useTouch) await stage.tap(input);
  else await stage.click(input);
  let placed = await tankState(stage);
  if (!placed?.food.length) {
    await page.clock.runFor(34);
    placed = await tankState(stage);
  }
  if (!placed?.food.length) return end('fail', 'food-not-visible');
  const pellet = placed.food[0];
  report.foodPlaced = true;
  report.tapDistance = distance(pellet, point);
  if (report.tapDistance > 0.13) return end('fail', 'food-position-mismatch');
  const starts = new Map(placed.tracks.map(fish => [fish.id, fish]));
  for (let elapsed = 0; elapsed < 10800;) {
    const interval = elapsed < 720 ? 30 : 120;
    await page.clock.runFor(interval);
    elapsed += interval;
    const sample = await tankState(stage);
    if (!sample) return end('fail', 'invalid-tank-state');
    const remaining = sample.food.find(food => food.id === pellet.id);
    if (remaining) {
      // Use displacement toward the pellet's current position so sinking food alone does not count as approach.
      report.approached ||= sample.tracks.some(fish => {
        const initial = starts.get(fish.id);
        return initial && distance(initial, remaining) - distance(fish, remaining) > Math.min(0.035, distance(initial, pellet) / 3);
      });
    } else {
      report.consumed = sample.eaten > before.eaten;
      report.eatenAfter = sample.eaten;
      report.occupantsAfter = sample.tracks.length;
      if (!report.consumed) return end('fail', 'food-not-consumed');
      return report.approached ? end('pass') : end('unverified', 'food-approach-not-observed');
    }
  }
  return report.approached ? end('unverified', 'feeding-observation-budget-exhausted') : end('fail', 'no-food-approach');
}
