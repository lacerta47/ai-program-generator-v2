// Offline second pass: no AI requests, no publication, no external network.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/amh47/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir = resolve(process.argv[2]);
const docs = new Map();
const server = createServer((req, res) => {
  const id = req.url.slice(1);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (id.startsWith('frame/')) {
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
    res.end(docs.get(id.slice(6)) || 'missing');
  } else res.end(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}iframe{display:block;width:100vw;height:100vh;border:0}</style><iframe sandbox="allow-scripts" src="http://127.0.0.1:${server.address().port}/frame/${id}"></iframe>`);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const typeFilter = process.argv[3] ? new Set(process.argv[3].split(',').filter(Boolean)) : null;
const files = readdirSync(dir).filter(f => /-(before|after)\.json$/.test(f)).filter(f => !typeFilter || typeFilter.has(JSON.parse(readFileSync(resolve(dir, f), 'utf8')).type));
let next = 0, done = 0;
try {
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < files.length) {
      const file = files[next++];
      const id = file.slice(0, -5);
      const output = resolve(dir, `${id}.actions.json`);
      if (existsSync(output)) {
        const saved = JSON.parse(readFileSync(output, 'utf8'));
        if (saved.inspectionVersion === 8 && (!id.startsWith('maze-') || saved.mazeAutoPlay)) continue;
      }
      const row = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
      if (!row.code) continue;
      const c = row.code;
      docs.set(id, `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${c.css}</style><body>${c.html}<script>${c.javascript}</script></body></html>`);
      const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: false });
      const result = { id, inspectionVersion: 8, errors: [], actions: [], incomplete: false };
      let stage = 'load', timer;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === String(server.address().port) && route.request().method() === 'GET' ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.on('pageerror', e => result.errors.push({ stage, message: e.message }));
      page.on('dialog', d => d.dismiss());
      async function work() {
        await page.goto(`http://127.0.0.1:${server.address().port}/${id}`, { timeout: 8000 });
        await page.waitForTimeout(500);
        const frame = page.frames().find(f => f.url().includes('/frame/'));
        const contractError = (probe, message) => result.errors.push({ stage: `${row.type}-${probe}`, message });
        if (row.type === 'roulette') {
          stage = 'roulette-contract';
          const wheel = frame.locator('#roulette-wheel');
          const pointer = frame.locator('#roulette-pointer');
          const display = frame.locator('#roulette-result');
          result.rouletteContract = {
            wheel: Boolean(await wheel.count()),
            pointer: Boolean(await pointer.count()),
            result: Boolean(await display.count()),
          };
          for (const key of ['wheel', 'pointer', 'result']) {
            if (!result.rouletteContract[key]) contractError('contract', `필수 요소 누락: roulette-${key}`);
          }
          if (result.rouletteContract.wheel && result.rouletteContract.pointer) {
            const geometry = await frame.evaluate(() => {
              const wheel = document.querySelector('#roulette-wheel');
              const pointer = document.querySelector('#roulette-pointer');
              const wr = wheel.getBoundingClientRect(), pr = pointer.getBoundingClientRect();
              const style = getComputedStyle(pointer);
              const visibleBorder = (side) => parseFloat(style[`border${side}Width`]) > 0 && !/transparent|rgba\([^)]*,\s*0\)/.test(style[`border${side}Color`]);
              const cssDirection = visibleBorder('Top') ? 'down' : visibleBorder('Bottom') ? 'up' : 'unknown';
              return {
                declaredDirection: pointer.dataset.direction || null,
                cssDirection,
                aboveWheel: pr.top < wr.top,
                horizontallyCentered: Math.abs((pr.left + pr.width / 2) - (wr.left + wr.width / 2)) <= Math.max(8, wr.width * 0.08),
              };
            });
            Object.assign(result.rouletteContract, geometry);
            if (geometry.declaredDirection !== 'down' || geometry.cssDirection === 'up' || !geometry.aboveWheel || !geometry.horizontallyCentered) {
              contractError('pointer', '고정 포인터가 원판 12시 방향에서 아래쪽을 향하지 않음');
            }
          }
          if (result.rouletteContract.result) {
            const before = (await display.innerText({ timeout: 500 })).trim();
            const namedSpinButton = frame.locator('#spin-button:visible, button[id*="spin" i]:visible, [role=button][id*="spin" i]:visible, button[class*="spin" i]:visible').first();
            const labeledSpinButton = frame.locator('button:visible, [role=button]:visible, [onclick]:visible').filter({ hasText: /돌리|뽑|출발|시작|spin/i }).first();
            const trigger = await namedSpinButton.count() ? namedSpinButton : await labeledSpinButton.count() ? labeledSpinButton : wheel;
            if (!await trigger.count()) contractError('result', '룰렛을 시작할 조작 요소가 없음');
            else {
              try { await trigger.click({ timeout: 1000 }); } catch { contractError('result', '룰렛 시작 조작 실패'); }
              let after = before;
              for (let i = 0; i < 24 && (after === before || !/당첨 결과\s*:/.test(after)); i++) {
                await page.waitForTimeout(250);
                after = (await display.innerText({ timeout: 500 })).trim();
              }
              const resultBox = await display.boundingBox({ timeout: 500 }).catch(() => null);
              const visible = resultBox && resultBox.width > 0 && resultBox.height > 0 && resultBox.y < 900 && resultBox.y + resultBox.height > 0;
              Object.assign(result.rouletteContract, { before, after, changed: after !== before, visible: Boolean(visible) });
              if (after === before || !/당첨 결과\s*:/.test(after)) contractError('result', '6초 안에 명시적인 당첨 결과가 표시되지 않음');
              if (!visible) contractError('result', '당첨 결과 영역이 현재 화면에 보이지 않음');
            }
          }
        }
        if (row.type === 'game') {
          stage = 'game-lifecycle';
          const start = frame.locator('button, [role=button], [onclick]').filter({ hasText: /시작|게임 시작|출발/ }).first();
          result.gameLifecycle = { startAvailable: Boolean(await start.count()) };
          if (!result.gameLifecycle.startAvailable) contractError('lifecycle', '게임 시작 버튼이 없음');
          else {
            try { await start.click({ timeout: 1000 }); await page.waitForTimeout(500); } catch { contractError('lifecycle', '게임 시작 버튼 조작 실패'); }
            let visibleText = await frame.locator('body').innerText({ timeout: 1000 });
            result.gameLifecycle.gameOverVisibleAfterStart = /게임\s*오버|game\s*over/i.test(visibleText);
            if (result.gameLifecycle.gameOverVisibleAfterStart) contractError('lifecycle', '게임 시작 직후 게임 종료 화면이 남아 있음');
            const restart = frame.locator('button, [role=button], [onclick]').filter({ hasText: /다시|재시작|restart/i }).first();
            if (await restart.count() && await restart.isVisible()) {
              try { await restart.click({ timeout: 1000 }); await page.waitForTimeout(300); } catch { contractError('lifecycle', '다시하기 버튼 조작 실패'); }
              visibleText = await frame.locator('body').innerText({ timeout: 1000 });
              result.gameLifecycle.gameOverVisibleAfterRestart = /게임\s*오버|game\s*over/i.test(visibleText);
              if (result.gameLifecycle.gameOverVisibleAfterRestart) contractError('lifecycle', '다시하기 뒤에도 게임 종료 화면이 남아 있음');
            }
          }
        }
        if (row.type === 'clock' && (row.answers?.seconds === 'yes' || ['timer', 'stopwatch'].includes(row.answers?.kind))) {
          stage = 'clock-progression';
          const readClock = () => frame.evaluate(() => {
            const visible = (element) => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
            const nodes = [...document.querySelectorAll('[id*="time" i], [class*="time" i], [id*="clock" i], [class*="clock" i], [id*="display" i], [class*="display" i]')];
            return nodes.filter(visible).map((node) => node.textContent.trim()).find((text) => /\d{1,3}\s*[:.]\s*\d{1,2}/.test(text)) || null;
          });
          const before = await readClock();
          if (['timer', 'stopwatch'].includes(row.answers?.kind)) {
            const start = frame.locator('button, [role=button], [onclick]').filter({ hasText: /시작|start/i }).first();
            if (await start.count()) try { await start.click({ timeout: 1000 }); } catch {}
          }
          await page.waitForTimeout(1300);
          const after = await readClock();
          result.clockProgression = { before, after, changed: Boolean(before && after && before !== after) };
          if (!result.clockProgression.changed) contractError('progression', '실행 후에도 표시 시간이 진행되지 않음');
        }
        if (row.type === 'maze') {
          stage = 'maze-generator-probe';
          result.mazeConnectivity = await frame.evaluate(() => {
            let generate;
            try { generate = (0, eval)('generateMaze'); } catch { return { available: false }; }
            if (typeof generate !== 'function') return { available: false };
            let passed = 0;
            for (let trial = 0; trial < 20; trial++) {
              const size = [11, 15, 21, 25][trial % 4];
              const grid = generate(size, size);
              if (!Array.isArray(grid) || grid.length !== size || grid.some(r => !Array.isArray(r) || r.length !== size)) continue;
              const seen = new Set(['1,1']), queue = [[1, 1]];
              if (grid[1][1] !== 0) continue;
              for (let i = 0; i < queue.length; i++) {
                const [x, y] = queue[i];
                for (const [dx, dy] of [[1,0], [-1,0], [0,1], [0,-1]]) {
                  const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
                  if (grid[ny]?.[nx] === 0 && !seen.has(key)) { seen.add(key); queue.push([nx, ny]); }
                }
              }
              if (seen.has(`${size - 2},${size - 2}`)) passed++;
            }
            return { available: true, trials: 20, passed, scope: 'generator connectivity only, not full game completion' };
          });
          stage = 'maze-start';
          const startButton = frame.locator('button, [role=button], [onclick]').filter({ hasText: /시작|출발/ }).first();
          if (await startButton.count()) {
            try { await startButton.click({ timeout: 1000 }); await page.waitForTimeout(300); } catch {}
          }
          result.mazeVisualBounds = await frame.evaluate(() => {
            const visibleRect = (element) => {
              const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 ? rect : null;
            };
            const players = [...document.querySelectorAll('[data-player="true"], .player-cell, .maze-player, #player, #player-element, [id*="player" i], [class*="player" i], .character, .hero')]
              .map((element) => ({ element, rect: visibleRect(element) }))
              .filter((item) => item.rect)
              .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);
            const player = players[0];
            const boards = [...document.querySelectorAll('#maze-grid, .maze-grid, #mazeContainer, #maze-container, #maze, .maze-board, [id*="maze" i], [class*="maze" i], canvas')]
              .filter((element) => element !== player?.element && !element.matches('.maze-cell, [class*="cell" i]'))
              .map((element) => ({
                element,
                rect: visibleRect(element),
                rank: element.matches('#maze-grid, .maze-grid, #mazeContainer, #maze-container, #maze, .maze-board') ? 0 : element.matches('canvas') ? 1 : 2,
              }))
              .filter((item) => item.rect && item.rect.width > 80 && item.rect.height > 80)
              .sort((a, b) => a.rank - b.rank || a.rect.width * a.rect.height - b.rect.width * b.rect.height);
            if (!player || !boards.length) return { available: false, playerFound: Boolean(player), boardFound: Boolean(boards.length) };
            const pr = player.rect, br = boards[0].rect, tolerance = 3;
            return {
              available: true,
              inside: pr.left >= br.left - tolerance && pr.right <= br.right + tolerance && pr.top >= br.top - tolerance && pr.bottom <= br.bottom + tolerance,
              player: { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom },
              board: { left: br.left, top: br.top, right: br.right, bottom: br.bottom },
            };
          });
          if (result.mazeVisualBounds.available && !result.mazeVisualBounds.inside) contractError('visual-bounds', '플레이어가 미로 표시 영역 밖에 있음');
          stage = 'maze-auto-plan';
          const plan = await frame.evaluate(() => {
            const read = (names) => {
              for (const name of names) {
                try { const value = (0, eval)(name); if (value !== undefined && value !== null) return value; } catch {}
              }
              return null;
            };
            const grids = ['maze', 'mazeGrid', 'grid', 'board'].map(name => ({ name, value: read([name]) }));
            const picked = grids.find(item => Array.isArray(item.value) && item.value.length > 2 && item.value.every(row => Array.isArray(row)));
            if (!picked) return { supported: false, reason: '2d-grid-not-found' };
            const grid = picked.value, height = grid.length, width = Math.min(...grid.map(row => row.length));
            const point = (objectNames, xNames, yNames, fallback) => {
              const object = read(objectNames);
              if (object && Number.isInteger(object.x) && Number.isInteger(object.y)) return { x: object.x, y: object.y };
              const x = read(xNames), y = read(yNames);
              return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : fallback;
            };
            const start = point(['playerPos', 'player', 'position'], ['playerX', 'playerCol', 'currentX'], ['playerY', 'playerRow', 'currentY'], { x: 1, y: 1 });
            const exit = point(['exitPos', 'goalPos', 'exit', 'goal'], ['exitX', 'goalX'], ['exitY', 'goalY'], { x: width - 2, y: height - 2 });
            const passable = value => value !== 1 && value !== '1' && value !== '#' && value !== 'wall' && value !== true;
            if (grid[start.y]?.[start.x] === undefined || grid[exit.y]?.[exit.x] === undefined) return { supported: false, reason: 'invalid-endpoints' };
            const queue = [start], previous = new Map([[`${start.x},${start.y}`, null]]);
            const steps = [[1, 0, 'ArrowRight'], [-1, 0, 'ArrowLeft'], [0, 1, 'ArrowDown'], [0, -1, 'ArrowUp']];
            for (let i = 0; i < queue.length; i++) {
              const current = queue[i];
              for (const [dx, dy, key] of steps) {
                const next = { x: current.x + dx, y: current.y + dy }, id = `${next.x},${next.y}`;
                if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height || previous.has(id) || !passable(grid[next.y][next.x])) continue;
                previous.set(id, { from: `${current.x},${current.y}`, key });
                queue.push(next);
              }
            }
            const exitKey = `${exit.x},${exit.y}`;
            if (!previous.has(exitKey)) return { supported: true, grid: picked.name, start, exit, pathFound: false };
            const stepsToExit = [];
            for (let cursor = exitKey; previous.get(cursor); ) {
              const step = previous.get(cursor), [x, y] = cursor.split(',').map(Number);
              stepsToExit.push({ key: step.key, x, y }); cursor = step.from;
            }
            stepsToExit.reverse();
            return { supported: true, grid: picked.name, start, exit, pathFound: true, steps: stepsToExit };
          });
          result.mazeAutoPlay = { ...plan, steps: undefined, pathLength: plan.steps?.length || 0 };
          if (plan.pathFound && plan.steps.length <= 1000) {
            stage = 'maze-auto-input';
            const readPosition = () => frame.evaluate(() => {
              const read = (names) => { for (const name of names) { try { const value = (0, eval)(name); if (value !== undefined && value !== null) return value; } catch {} } return null; };
              const object = read(['playerPos', 'player', 'position', 'currentPosition', 'characterPosition']);
              const x = object?.x ?? read(['playerX', 'playerCol', 'currentX']);
              const y = object?.y ?? read(['playerY', 'playerRow', 'currentY']);
              if (Number.isInteger(x) && Number.isInteger(y)) return { x, y };
              const player = document.querySelector('.player-cell, .player, [data-player="true"]');
              const cell = player?.matches?.('[data-x][data-y]') ? player : player?.closest?.('[data-x][data-y]');
              const dx = Number(cell?.getAttribute('data-x')), dy = Number(cell?.getAttribute('data-y'));
              return Number.isInteger(dx) && Number.isInteger(dy) ? { x: dx, y: dy } : null;
            });
            const arrows = { ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓', ArrowLeft: '←' };
            let completedSteps = 0, divergedAt = null;
            for (const step of plan.steps) {
              await page.keyboard.press(step.key); await page.waitForTimeout(15);
              let current = await readPosition();
              if (current?.x !== step.x || current?.y !== step.y) {
                const arrow = frame.locator('button, [role=button], [onclick]').filter({ hasText: new RegExp(`^\\s*${arrows[step.key]}\\s*$`) }).first();
                if (await arrow.count()) { try { await arrow.click({ timeout: 400 }); await page.waitForTimeout(15); } catch {} current = await readPosition(); }
              }
              if (current?.x !== step.x || current?.y !== step.y) { divergedAt = { expected: { x: step.x, y: step.y }, actual: current, key: step.key }; break; }
              completedSteps++;
            }
            await page.waitForTimeout(250);
            const outcome = await frame.evaluate((exit) => {
              const read = (names) => { for (const name of names) { try { const value = (0, eval)(name); if (value !== undefined && value !== null) return value; } catch {} } return null; };
              const object = read(['playerPos', 'player', 'position']);
              const x = object?.x ?? read(['playerX', 'playerCol', 'currentX']);
              const y = object?.y ?? read(['playerY', 'playerRow', 'currentY']);
              const text = document.body.innerText;
              return { finalPosition: Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null, reachedExit: x === exit.x && y === exit.y, victorySignaled: /성공했|승리했|탈출했|도착했|축하해|완료했|다 만들/.test(text) };
            }, plan.exit);
            Object.assign(result.mazeAutoPlay, { completedSteps, divergedAt }, outcome);
          }
        }
        stage = 'layout-containment';
        result.layoutContainment = await frame.evaluate(() => {
          const visible = (element) => {
            const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.01;
          };
          const describe = (element) => ({ tag: element.tagName, id: element.id || null, className: typeof element.className === 'string' ? element.className.slice(0, 80) : null });
          const textOverflow = [...document.querySelectorAll('[id*="time" i], [class*="time" i], [id*="display" i], [class*="display" i]')]
            .filter((element) => visible(element) && element.textContent.trim())
            .filter((element) => {
              const range = document.createRange();
              range.selectNodeContents(element);
              const textRect = range.getBoundingClientRect(), box = element.getBoundingClientRect();
              return textRect.left < box.left - 4 || textRect.right > box.right + 4;
            })
            .slice(0, 10)
            .map(describe);
          const clippedCritical = [...document.querySelectorAll('.game-container, .container, .card, [id*="container" i]')]
            .filter((container) => visible(container) && /hidden|clip/.test(getComputedStyle(container).overflow))
            .flatMap((container) => {
              const box = container.getBoundingClientRect();
              return [...container.querySelectorAll('h1, h2, p, button, input, [role="button"], [id*="display" i], [class*="display" i], [id*="result" i], [class*="result" i]')]
                .filter(visible)
                .filter((element) => {
                  const rect = element.getBoundingClientRect();
                  return rect.left < box.left - 4 || rect.right > box.right + 4 || rect.top < box.top - 4 || rect.bottom > box.bottom + 4;
                })
                .map((element) => ({ container: describe(container), element: describe(element) }));
            })
            .slice(0, 10);
          return { textOverflow, clippedCritical };
        });
        if (result.layoutContainment.textOverflow.length) contractError('layout', '시간·결과 글자가 자신의 표시 영역을 벗어남');
        if (result.layoutContainment.clippedCritical.length) contractError('layout', '핵심 내용이 숨김 컨테이너 밖으로 밀려 잘림');

        const buttons = frame.locator('button, input[type=button], input[type=submit], [role=button], [onclick], [tabindex="0"], .card, .tile, .cell');
        const total = await buttons.count();
        result.buttonCount = total;
        // Text actions first so swatch palettes do not hide reset/save/audio controls.
        const candidates = [];
        for (let i = 0; i < Math.min(total, 60); i++) {
          const label = (await buttons.nth(i).textContent({ timeout: 500 }) || '').trim().slice(0, 80);
          candidates.push({ i, label });
        }
        candidates.sort((a, b) => Number(!!b.label) - Number(!!a.label));
        for (const { i, label } of candidates.slice(0, 35)) {
          stage = `button:${i}:${label}`;
          try { await buttons.nth(i).click({ timeout: 450 }); await page.waitForTimeout(80); result.actions.push({ i, label, ok: true }); }
          catch { result.actions.push({ i, label, ok: false }); }
        }
        if (row.type === 'sound' || row.type === 'aquarium') {
          const repeatable = candidates.filter(item => row.type === 'sound' || /소리|음악|연주|벨|건반|피아노|효과음/.test(item.label)).slice(0, 20);
          result.audioRepeat = { attempted: 0, succeeded: 0 };
          for (let round = 0; round < 2; round++) for (const { i, label } of repeatable) {
            stage = `audio-repeat:${round + 2}:${i}:${label}`;
            result.audioRepeat.attempted++;
            try { await buttons.nth(i).click({ timeout: 450 }); await page.waitForTimeout(80); result.audioRepeat.succeeded++; } catch {}
          }
        }
        stage = 'keyboard';
        for (const key of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space', 'Enter']) await page.keyboard.press(key);
        await page.waitForTimeout(500);
        stage = 'responsive-390';
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(250);
        result.responsive = await frame.evaluate(() => {
          const width = document.documentElement.clientWidth;
          const overflow = document.documentElement.scrollWidth - width;
          const selectors = 'canvas, button, input, [role="button"], [id*="result" i], [class*="result" i], [id*="clock" i], [class*="clock" i], [id*="time" i], [class*="time" i], [id*="display" i], [class*="display" i], .container, .card';
          const elements = [...document.querySelectorAll(selectors)];
          const offscreen = elements.filter((element) => {
            const r = element.getBoundingClientRect(), s = getComputedStyle(element);
            return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && (r.left < -4 || r.right > width + 4);
          }).slice(0, 10).map((element) => ({ tag: element.tagName, id: element.id || null, className: typeof element.className === 'string' ? element.className.slice(0, 80) : null }));
          const internalOverflow = elements.filter((element) => {
            const r = element.getBoundingClientRect(), s = getComputedStyle(element);
            return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && element.scrollWidth - element.clientWidth > 4;
          }).slice(0, 10).map((element) => ({ tag: element.tagName, id: element.id || null, className: typeof element.className === 'string' ? element.className.slice(0, 80) : null, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
          return { width, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: overflow > 4, offscreen, internalOverflow };
        });
        await page.screenshot({ path: resolve(dir, `${id}.mobile.png`), fullPage: true });
        if (result.responsive.offscreen.length || result.responsive.internalOverflow.length) contractError('responsive', '390px 화면에서 잘리거나 내부 영역을 벗어난 핵심 요소가 있음');
      }
      try { await Promise.race([work(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('deadline')), 45000); })]); }
      catch (e) { result.incomplete = true; result.harnessError = e.message; }
      finally { clearTimeout(timer); await context.close(); docs.delete(id); }
      writeFileSync(output, JSON.stringify(result, null, 2));
      console.log(JSON.stringify({ done: ++done, id, errors: result.errors, incomplete: result.incomplete }));
    }
  }));
} finally { await browser.close(); server.close(); }
