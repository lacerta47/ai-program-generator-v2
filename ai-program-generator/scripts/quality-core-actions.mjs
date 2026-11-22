// Browser probes for the guided generation rules in lib/ai/typeGuides.ts.
const CLICK_TIMEOUT = 1200;
export const CORE_ACTION_VERSION = 3;

const markers = {
  paint: '#paint-canvas',
  game: '#game-stage',
  card: '#card-preview',
  calc: '#calc-result, #calc-problem',
  fortune: '#fortune-draw',
  sound: '[data-sound-pad]',
  dressup: '#dressup-stage',
  clock: '#clock-display',
};

export const hasCoreAction = type => Object.hasOwn(markers, type);

function requireAction(condition, message) {
  if (!condition) throw new Error(message);
}

const click = locator => locator.click({ timeout: CLICK_TIMEOUT });
const read = async locator => (await locator.innerText({ timeout: CLICK_TIMEOUT })).trim();

async function previewPng(image) {
  await image.waitFor({ state: 'visible', timeout: CLICK_TIMEOUT });
  const src = await image.getAttribute('src', { timeout: CLICK_TIMEOUT });
  const decoded = src?.startsWith('data:image/png;base64,') && await image.evaluate(element =>
    element.decode().then(() => element.naturalWidth > 0, () => false));
  requireAction(decoded, '화면에 PNG 이미지가 표시되지 않음');
  return src;
}

const probes = {
  async paint(frame, page, answers) {
    const canvas = frame.locator('#paint-canvas');
    await canvas.scrollIntoViewIfNeeded({ timeout: CLICK_TIMEOUT });
    const box = await canvas.boundingBox();
    requireAction(box?.width > 30 && box?.height > 30, '그릴 수 있는 캔버스 영역이 없음');
    const pixels = () => canvas.evaluate(element => element.toDataURL('image/png'));
    const initial = await pixels();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 4 });
    await page.mouse.up();
    requireAction(await pixels() !== initial, '그린 뒤 캔버스 픽셀이 바뀌지 않음');
    const checks = ['그리기', '전체 지우기'];
    if (answers.save === 'no') {
      requireAction(await frame.locator('#paint-save').count() === 0, '저장 안 함 선택에 저장 버튼이 있음');
    }
    if (answers.save === 'download') {
      const drawn = await pixels();
      await click(frame.locator('#paint-save'));
      requireAction(await previewPng(frame.locator('img#paint-png')) === drawn, '현재 그림을 PNG로 보여주지 않음');
      checks.push('현재 그림의 PNG 표시');
    }
    await click(frame.locator('#paint-clear'));
    requireAction(await pixels() === initial, '전체 지우기 후 처음 종이 또는 도안으로 돌아오지 않음');
    return checks;
  },

  async game(frame, page, answers) {
    const stage = frame.locator('#game-stage');
    const end = frame.locator('#game-end');
    requireAction(await stage.getAttribute('data-game-state') === 'ready', '첫 화면이 시작 대기 상태가 아님');
    await click(frame.locator('#game-start'));
    requireAction(await stage.getAttribute('data-game-state') === 'playing' && !await end.isVisible(),
      '시작을 눌러도 플레이로 전환되지 않거나 종료 안내가 계속 보임');
    const checks = ['시작 상태 전환'];
    const ended = async () => await end.isVisible() && await stage.getAttribute('data-game-state') === 'ended';
    if (answers.genre === 'rps' && ['best3', 'best5'].includes(answers.rps_rounds)) {
      for (let i = 0; i < 36 && !await ended(); i++) {
        const move = ['rock', 'paper', 'scissors'][i % 3];
        try {
          await click(frame.locator('[data-rps-move="' + move + '"]'));
        } catch (error) {
          // A completed round can show the end overlay while the next move is waiting to be clickable.
          if (!await ended()) throw error;
        }
        // Give the round time to settle even when a move button stays enabled during its animation.
        if (!await ended()) await page.waitForTimeout(450);
      }
      requireAction(await ended(), '정해진 승수에 도달해도 가위바위보 종료로 전환되지 않음');
      checks.push('대결 후 종료');
    }
    const restart = frame.locator('#game-restart');
    if (await end.isVisible()) {
      await click(restart);
      requireAction(await stage.getAttribute('data-game-state') === 'playing' && !await end.isVisible(),
        '다시 시작 후 플레이 상태 또는 종료 안내가 갱신되지 않음');
      checks.push('다시 시작');
    }
    return checks;
  },

  async card(frame, _page, answers) {
    const card = frame.locator('#card-preview');
    const message = card.locator('#card-message');
    requireAction(await message.isVisible() && (await read(message)).length > 0, '카드 본문이 처음부터 보이지 않음');
    const checks = ['기본 문구'];
    if (answers.nameField === 'yes') {
      await frame.locator('#card-name').fill('테스트 이름', { timeout: CLICK_TIMEOUT });
      requireAction((await read(card.locator('#card-recipient'))).includes('테스트 이름'), '입력한 이름이 카드에 반영되지 않음');
      checks.push('이름 즉시 반영');
    }
    if (answers.nameField === 'no') requireAction(!await frame.locator('#card-name').count(), '이름 입력을 끈 카드에 입력칸이 있음');
    if (answers.kind === 'me' && Array.isArray(answers.meinfo) && answers.meinfo.length && !answers.meinfo.includes('dream')) {
      const dream = card.getByText(/^(?:나의|내가 꾸는|내)\s*(?:멋진\s*)?꿈$|^장래\s*희망$/).first();
      requireAction(!await dream.isVisible(), '고르지 않은 꿈 항목이 카드에 표시됨');
    }
    return checks;
  },

  async calc(frame, _page, answers) {
    if (answers.mode && answers.mode !== 'calc' && answers.mode !== 'aichoose') {
      const problem = frame.locator('#calc-problem');
      const original = await read(problem);
      requireAction(Boolean(original), '첫 문제가 표시되지 않음');
      await click(frame.locator('#calc-check'));
      const feedback = frame.locator('#calc-feedback');
      const status = () => feedback.getAttribute('data-answer-status', { timeout: CLICK_TIMEOUT });
      requireAction(await status() === 'idle' && await read(problem) === original, '빈 답을 채점하거나 문제를 넘김');
      const checks = ['첫 문제 표시', '빈 입력 채점 방지'];
      if (['times', 'speed'].includes(answers.mode)) {
        const equation = original.match(/(\d+)\s*([×x*+−-])\s*(\d+)/);
        requireAction(equation, '표시된 연산 문제를 읽을 수 없음');
        const [, left, operator, right] = equation;
        const correct = operator === '+' ? Number(left) + Number(right) :
          operator === '-' || operator === '−' ? Number(left) - Number(right) : Number(left) * Number(right);
        const entry = frame.locator('#calc-entry');
        const enter = async value => {
          if (await entry.evaluate(element => element.matches('input:not([readonly]),textarea:not([readonly]),[contenteditable]:not([contenteditable="false"])'))) {
            await entry.fill(String(value), { timeout: CLICK_TIMEOUT });
            return;
          }
          for (const character of String(value)) {
            const label = character === '-' ? /^(−|-)$/ : character;
            await click(frame.getByRole('button', { name: label, exact: true }));
          }
        };
        await enter(correct + 1);
        await click(frame.locator('#calc-check'));
        requireAction(await status() === 'incorrect' && await read(problem) === original, '오답을 판정하지 않거나 같은 문제를 다시 풀 수 없음');
        await enter(correct);
        await click(frame.locator('#calc-check'));
        requireAction(await status() === 'correct', '표시된 문제의 정확한 답을 정답으로 처리하지 않음');
        checks.push('오답 판정과 재시도', '정답 판정');
      }
      return checks;
    }
    const operations = { add: 10, sub: 6, mul: 16, div: 4, pct: 0.08 };
    const selected = Array.isArray(answers.ops) && answers.ops.length ? answers.ops : ['add', 'sub', 'mul', 'div'];
    const key = value => frame.locator('[data-calc-key="' + value + '"]');
    for (const operation of Object.keys(operations)) {
      requireAction(Boolean(await key(operation).count()) === selected.includes(operation), '선택과 계산 연산 버튼이 다름: ' + operation);
    }
    const [operator] = selected;
    const sequence = operator === 'pct' ? ['8', 'pct'] : ['8', operator, '2', 'equals'];
    for (const value of sequence) await click(key(value));
    const display = frame.locator('#calc-result');
    const value = display.locator('#calc-result-value');
    const source = await value.count() ? value : display;
    const readable = await source.evaluate(element => !element.closest('[hidden], [aria-hidden="true"]')) && await source.isVisible();
    const result = (await read(source)).replaceAll(',', '');
    requireAction(readable && result && Number.isFinite(Number(result)), '계산 결과의 전체 숫자를 읽을 수 있는 텍스트가 없음');
    requireAction(Number(result) === operations[operator], '선택한 연산의 실제 계산 결과가 다름');
    return ['연산 선택 일치', '계산 결과'];
  },

  async fortune(frame, _page, answers) {
    const draw = frame.locator('#fortune-draw');
    await click(draw);
    const cards = frame.locator('#fortune-results[data-fortune-message]:visible, #fortune-results [data-fortune-message]:visible');
    await cards.first().waitFor({ state: 'visible', timeout: CLICK_TIMEOUT });
    const messages = (await cards.allTextContents()).map(message => message.trim());
    const count = { one: 1, three: 3, five: 5 }[answers.count];
    requireAction((!count || messages.length === count) && messages.every(Boolean) && new Set(messages).size === messages.length,
      '표시된 결과가 비어 있거나 개수·내용이 맞지 않음');
    if (answers.again === 'no') requireAction(!await draw.isVisible() || await draw.isDisabled(), '한 번만 모드에서 다시 뽑기가 가능함');
    const checks = ['뽑은 메시지 개수·내용'];
    if (answers.again === 'no') checks.push('한 번만 뽑기');
    if (answers.kind === 'riddle') {
      const card = cards.first();
      const solution = card.locator('[data-fortune-solution]');
      requireAction(!await solution.isVisible(), '뽑기 직후 정답이 이미 노출됨');
      await click(card.locator('[data-fortune-answer]'));
      requireAction(await solution.isVisible() && Boolean(await read(solution)), '뽑기를 끝낸 뒤 정답을 열 수 없음');
      checks.push('수수께끼 정답 공개');
    }
    if (['copy', 'show', 'nothing'].includes(answers.share)) {
      requireAction(!await frame.locator('#fortune-image-button').isVisible(), '이미지를 고르지 않았는데 이미지 버튼이 표시됨');
    }
    if (answers.share === 'save' && messages.length === 1) {
      await click(frame.locator('#fortune-image-button'));
      await previewPng(frame.locator('img#fortune-image'));
      checks.push('메시지 PNG 표시');
    }
    return checks;
  },

  async sound(frame, _page, answers) {
    if (answers.instrument !== 'piano' || answers.playmode === 'free') {
      const practice = frame.getByRole('button', { name: /따라\s*(치기|연주)/ }).first();
      requireAction(!await practice.isVisible(), '따라치기를 고르지 않은 악기에 연습 버튼이 표시됨');
    }
    const pads = frame.locator('[data-sound-pad]:visible');
    const geometry = await pads.evaluateAll(elements => {
      const bounds = elements.map(element => element.getBoundingClientRect());
      return {
        fit: bounds.every(rect => rect.left >= -2 && rect.right <= document.documentElement.clientWidth + 2),
        smallest: Math.min(...bounds.map(rect => Math.min(rect.width, rect.height))),
      };
    });
    requireAction(geometry.fit, '연주 건반이나 패드가 화면 가로 영역 밖에 있음');
    if (['large', 'two_octaves'].includes(answers.keycount)) {
      requireAction(geometry.smallest >= 43.5, '건반이나 패드의 터치 영역이 44px보다 작음');
    }
    const pad = pads.first();
    await frame.evaluate(() => {
      window.__lunTestAudioStarts = 0;
      const start = AudioScheduledSourceNode.prototype.start;
      AudioScheduledSourceNode.prototype.start = function (...args) {
        const result = start.apply(this, args);
        if (this.context.state === 'running') window.__lunTestAudioStarts++;
        return result;
      };
    });
    for (let i = 0; i < 3; i++) {
      const previousStarts = await frame.evaluate(() => window.__lunTestAudioStarts);
      await click(pad);
      await frame.waitForFunction(previous => window.__lunTestAudioStarts > previous, previousStarts, { timeout: CLICK_TIMEOUT });
    }
    return ['표시된 건반·패드 가로 배치', '반복 입력에서 실행 중인 Web Audio 소스 시작'];
  },

  async dressup(frame, _page, answers) {
    requireAction(await frame.locator('#dressup-stage').isVisible(), '꾸미기 무대가 안 보임');
    const checks = ['꾸미기 무대'];
    const photo = frame.locator('img#dressup-photo');
    const originalPhoto = answers.base === 'photo' ? await photo.getAttribute('src', { timeout: CLICK_TIMEOUT }) : null;
    if (answers.base === 'photo') requireAction(Boolean(originalPhoto) && await photo.isVisible(), '꾸미기 무대에 원본 사진이 없음');
    if (['yes', 'reset', 'both'].includes(answers.random)) {
      const visible = async id => frame.locator('#dressup-' + id).isVisible();
      requireAction(await visible('random') === (answers.random !== 'reset') &&
        await visible('reset') === (answers.random !== 'yes'), '고른 랜덤·초기화 버튼과 실제 버튼이 다름');
      checks.push('랜덤·초기화 선택 일치');
      if (originalPhoto) {
        for (const control of ['random', 'reset']) {
          if (await visible(control)) await click(frame.locator('#dressup-' + control));
          requireAction(await photo.getAttribute('src', { timeout: CLICK_TIMEOUT }) === originalPhoto, '랜덤 또는 초기화 동작에서 원본 사진이 바뀜');
        }
        checks.push('사진 원본 유지');
      }
    }
    if (['card', 'name', 'compare'].includes(answers.finish)) {
      const result = frame.locator('#dressup-result');
      requireAction(!await result.isVisible(), '꾸미기 전에 완성 결과가 이미 보임');
      await click(frame.locator('#dressup-finish'));
      requireAction(await result.isVisible(), '완성 버튼을 눌러도 결과가 보이지 않음');
      checks.push('완성 결과 표시');
    }
    return checks;
  },

  async clock(frame, page, answers) {
    const display = frame.locator('#clock-display');
    const elapsed = async () => {
      const value = await display.getAttribute('data-clock-seconds', { timeout: CLICK_TIMEOUT });
      requireAction(value !== null && /^\d+$/.test(value), '시간을 나타내는 초 값이 없음');
      return Number(value);
    };
    const initial = await elapsed();
    const initialText = await read(display);
    requireAction(await display.isVisible() && Boolean(initialText), '시간 표시가 비었거나 안 보임');
    const controlled = ['timer', 'stopwatch'].includes(answers.kind);
    const start = frame.locator('#clock-start'), pause = frame.locator('#clock-pause'), reset = frame.locator('#clock-reset');
    if (controlled) await click(start);
    else if (['clock', 'alarm'].includes(answers.kind)) requireAction(!(await start.count() || await pause.count() || await reset.count()), '현재 시각 시계에 타이머 버튼이 있음');
    await page.clock.runFor(1600);
    const progressed = await elapsed();
    const moved = answers.kind === 'timer' ? progressed < initial : progressed !== initial;
    requireAction(moved && (answers.seconds === 'no' || await read(display) !== initialText),
      '시작하고 기다려도 표시 시간이 올바르게 진행되지 않음');
    if (!controlled) return ['시각 진행'];
    await click(answers.controls === 'onebig' || !await pause.count() ? start : pause);
    const paused = await elapsed();
    await page.clock.runFor(1600);
    requireAction(await elapsed() === paused, '멈춤 뒤에도 시간이 계속 감');
    await click(reset);
    requireAction(await elapsed() === initial, '다시 버튼이 처음 시각을 복원하지 않음');
    return ['시작 후 진행', '멈춤', '초기화'];
  },
};

export async function inspectCoreAction(frame, page, type, answers = {}, strict = false) {
  try {
    if (!await frame.locator(markers[type]).count()) {
      return { status: strict ? 'failed' : 'unverified', reason: '핵심 동작 검사 표식 없음' };
    }
    const onScreen = await frame.locator(markers[type]).first().evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      return document.documentElement.scrollWidth <= viewport + 2 &&
        (bounds.width === 0 || (bounds.left >= -2 && bounds.right <= viewport + 2));
    }, undefined, { timeout: CLICK_TIMEOUT });
    requireAction(onScreen, '핵심 화면이 뷰포트 가로 영역을 벗어남');
    const checks = await probes[type](frame, page, answers);
    return { status: 'passed', checks };
  } catch (error) {
    return { status: 'failed', reason: error.message };
  }
}
