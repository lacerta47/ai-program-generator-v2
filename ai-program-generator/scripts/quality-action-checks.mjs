// These probes run only in the local sandboxed preview. They use what the
// student can see and click, without executing the generated app in Node.
const action = { timeout: 900 };
const read = { timeout: 600 };
const quizTimerSeconds = { yes10: 10, yes20: 20, yes30: 30 };
export const hasQuizTimer = (answers) => Object.hasOwn(quizTimerSeconds, answers.timer);

async function visibleText(locator) {
  return await locator.isVisible() ? (await locator.innerText(read)).trim() : '';
}

function visibleQuizOutcome(message) {
  if (/(?:시간이|제한 시간).*(?:끝|다 됐|초과)/.test(message)) return 'timeout';
  if (/오답|틀렸|아쉬워/.test(message)) return 'incorrect';
  if (/맞았|맞혔|정답(?:이에요|입니다|이야|[!！])/.test(message)) return 'correct';
  return null;
}

async function waitUntil(page, predicate, timeout = 1000) {
  const deadline = Date.now() + timeout;
  do {
    if (await predicate()) return true;
    await page.waitForTimeout(40);
  } while (Date.now() < deadline);
  return false;
}

export async function inspectQuiz(frame, page, answers, fail) {
  const question = frame.locator('#quiz-question');
  const confirm = frame.locator('#quiz-confirm');
  const feedback = frame.locator('#quiz-feedback');
  const correctionText = frame.locator('#quiz-correction');
  const next = frame.locator('#quiz-next');
  const input = frame.locator('#quiz-answer');
  const options = frame.locator('[data-quiz-option]:visible');
  const finish = frame.locator('#quiz-finish');
  const restart = frame.locator('#quiz-restart');
  const record = { graded: [], restarted: false, metadataWarnings: 0 };
  async function readOutcome() {
    const message = await visibleText(feedback);
    const tag = await feedback.getAttribute('data-quiz-state', read);
    const state = visibleQuizOutcome(await visibleText(correctionText)) ?? tag;
    return { state, message, tag };
  }

  if (!(await question.isVisible()) || !(await confirm.isVisible()) || await feedback.count() !== 1) {
    fail('contract', '문제·확인 버튼·채점 안내 영역이 필요함');
    return record;
  }
  const first = await visibleText(question);
  const firstInput = await input.isVisible();
  const expectedOptions = { ox: 2, choice2: 2, choice4: 4 }[answers.answer];
  if ((answers.answer === 'type' && !firstInput)
      || (['ox', 'choice2', 'choice4', 'picture'].includes(answers.answer) && firstInput)) {
    fail('input', '선택한 답 입력 방식과 실제 조작이 다름');
  }

  if (!(await confirm.isEnabled())) {
    fail('empty', '답이 비어 있을 때 확인 버튼이 꺼져 안내를 볼 수 없음');
  } else {
    await confirm.click(action);
    const warned = await waitUntil(page, async () => /(?:답|보기|선택).*(?:고르|골라|선택|입력|써|적어)/.test(await visibleText(feedback)));
    if (!warned) fail('empty', '답을 비운 채 확인하면 안내가 필요함');
    else if (await feedback.getAttribute('data-quiz-state', read) !== 'empty') record.metadataWarnings++;
  }
  if (await visibleText(question) !== first || await next.isVisible()) {
    fail('empty', '답을 비운 채 확인하면 안내만 보여야 함');
    return record;
  }

  for (let round = 0; round < 15; round++) {
    const before = await visibleText(question);
    const typed = await input.isVisible();
    const optionCount = await options.count();
    if (!before || (!typed && optionCount < 2)) {
      fail('question', '문제나 조작 가능한 답 입력이 없음');
      return record;
    }
    if (!typed && expectedOptions && optionCount !== expectedOptions) fail('input', '고른 보기 개수가 아님');
    if (typed) {
      const type = await input.getAttribute('type', read);
      await input.fill(type === 'number' || await input.getAttribute('inputmode', read) === 'numeric' ? '987654321' : '확인용오답987654321', action);
    } else {
      const labels = (await options.allInnerTexts()).map(label => label.trim());
      if (labels.some(label => !label) || new Set(labels).size !== optionCount) {
        fail('options', '보기에 빈 항목이나 중복 답이 있음');
        return record;
      }
      await options.nth(round % optionCount).click(action);
    }
    if (await next.isVisible()) {
      fail('confirm', '보기 선택만으로 문제를 채점함');
      return record;
    }
    if (typed && round === 1) await input.press('Enter', action);
    else await confirm.click(action);

    await waitUntil(page, async () => ['correct', 'incorrect', 'timeout'].includes((await readOutcome()).state));
    const { state, message, tag } = await readOutcome();
    const explanation = await visibleText(frame.locator('#quiz-explanation'));
    const correction = await visibleText(correctionText);
    if (!(typed ? state === 'incorrect' : ['correct', 'incorrect'].includes(state)) || !message
        || !explanation || !correction || !(await next.isVisible()) || await visibleText(question) !== before) {
      fail('grade', '확인 후 같은 문제에서 정오답·정답·설명·다음 버튼이 함께 보여야 함');
      return record;
    }
    if (tag !== state) record.metadataWarnings++;
    if (answers.topic === '숫자') {
      const expressions = [...before.matchAll(/\d+(?:\s*[+−\-×*]\s*\d+)+/g)];
      const equation = expressions.length === 1 && expressions[0][0].match(/^(\d+)\s*([+−\-×*])\s*(\d+)$/);
      const answer = correction.match(/(?:^|정답\s*(?:은|[:：])\s*)(-?\d+)\s*(?:이에요|예요|입니다)?[.!]?$/);
      if (equation && answer) {
        const [, left, op, right] = equation;
        const a = Number(left), b = Number(right);
        const expected = op === '+' ? a + b : op === '×' || op === '*' ? a * b : a - b;
        const multiplication = op === '×' || op === '*';
        if (expected < 0 || Number(answer[1]) !== expected || (multiplication && (a > 9 || b > 9))) {
          fail('math', '계산식·정답 또는 한 자리 곱셈 범위가 맞지 않음');
        }
      }
    }
    record.graded.push(state);
    if (await confirm.isVisible() && await confirm.isEnabled()) {
      await confirm.click(action);
      const afterRepeat = await readOutcome();
      if (await visibleText(question) !== before || afterRepeat.message !== message || afterRepeat.state !== state) {
        fail('repeat', '같은 답을 다시 확인했을 때 문제나 채점 결과가 바뀜');
        return record;
      }
    }
    await next.click(action);
    if (!(await waitUntil(page, async () => await finish.isVisible() || (await visibleText(question)) !== before))) {
      fail('next', '다음 버튼을 눌러도 문제나 결과 화면으로 넘어가지 않음');
      return record;
    }
    if (await finish.isVisible()) {
      const count = Number(answers.count);
      if (count > 0 && (record.graded.length > count || (answers.lives !== 'yes' && answers.lives !== 'aichoose' && record.graded.length !== count))) {
        fail('count', '선택한 문제 수와 실제로 푼 문제 수가 다름');
      }
      if (!(await visibleText(finish)) || !(await restart.isVisible())) {
        fail('finish', '결과나 다시하기 버튼이 없음');
        return record;
      }
      await restart.click(action);
      record.restarted = await waitUntil(page, async () => await question.isVisible() && await confirm.isVisible()
        && !(await finish.isVisible()) && !(await next.isVisible()));
      if (!record.restarted) {
        fail('restart', '다시하기 후 첫 문제를 새로 풀 수 없음');
      } else if (hasQuizTimer(answers)) {
        const afterRestart = await visibleText(question);
        await page.clock.runFor(quizTimerSeconds[answers.timer] * 1000 + 750);
        const afterTimeout = await readOutcome();
        record.timeout = afterTimeout.state === 'timeout'
          && await visibleText(question) === afterRestart && await next.isVisible()
          && Boolean(await visibleText(correctionText))
          && Boolean(await visibleText(frame.locator('#quiz-explanation')));
        if (!record.timeout) fail('timer', '시간이 끝나도 같은 문제에 정답·설명과 다음 버튼이 나타나지 않음');
        else if (afterTimeout.tag !== 'timeout') record.metadataWarnings++;
      }
      return record;
    }
  }
  fail('finish', '15문제를 풀어도 결과 화면이 나오지 않음');
  return record;
}

async function readRoulette(frame) {
  return frame.evaluate(() => {
    const wheel = document.querySelector('#roulette-wheel');
    const pointer = document.querySelector('#roulette-pointer');
    if (!wheel || !pointer) return null;
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const { visibility, display, opacity } = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && visibility === 'visible' && display !== 'none' && Number(opacity) > 0;
    };
    const center = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    };
    const origin = center(wheel);
    const angle = (el) => {
      const c = center(el);
      return Math.atan2(c.x - origin.x, origin.y - c.y);
    };
    const pointerAngle = angle(pointer);
    const distance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const markers = [...wheel.querySelectorAll('[data-roulette-slot]')].map(el => ({
      number: Number(el.getAttribute('data-roulette-slot')),
      text: el.textContent.normalize('NFKC').trim().replace(/번$/, ''),
      distance: distance(angle(el), pointerAngle),
      visible: visible(el),
    })).sort((a, b) => a.distance - b.distance);
    const legend = [...document.querySelectorAll('#roulette-legend [data-roulette-item]')].map(el => {
      const label = el.querySelector('[data-roulette-label]');
      return { number: Number(el.getAttribute('data-roulette-item')), label: label?.textContent.trim() || '', visible: !!label && visible(label) };
    });
    return {
      count: Number(wheel.getAttribute('data-spin-count') ?? Number.NaN),
      markers,
      legend,
    };
  });
}

export async function inspectRouletteSpins(frame, page, answers, fail) {
  const before = await readRoulette(frame);
  const spins = [];
  if (!before || before.count !== 0) {
    fail('contract', '회전 원판에 완료한 회전 횟수 data-spin-count=0이 필요함');
    return spins;
  }
  const spin = frame.locator('#roulette-spin');
  if (!(await spin.isVisible())) {
    fail('trigger', '돌리기 버튼이 없음');
    return spins;
  }
  const dynamic = answers.use === 'name' && answers.namemethod !== 'preset';
  const expectedCount = dynamic ? null : ({ s4: 4, s6: 6, s8: 8, s10: 10 })[answers.slots];
  if (before.legend.length < 2 || (expectedCount && before.legend.length !== expectedCount)) {
    fail('count', '처음에 돌릴 수 있는 항목이나 고른 고정 칸 수가 맞지 않음');
    return spins;
  }
  const repeat = frame.locator('#roulette-again');
  const wheel = frame.locator('#roulette-wheel');
  const resultDisplay = frame.locator('#roulette-result');
  const delegatedRetry = !['yes', 'exclude', 'no'].includes(answers.again);
  if (answers.use === 'name' && answers.namemethod === 'count'
      && before.legend.some(({label}, i) => label.normalize('NFKC').trim().replace(/번$/, '') !== String(i + 1))) {
    fail('candidates', '인원 수 모드는 첫 화면부터 번호로 채워야 함');
  }
  let previous = before;
  let previousWinner = '';
  for (let turn = 0; turn < 2; turn++) {
    let target = spin;
    if (turn === 1) {
      if (answers.again === 'no') target = wheel;
      else if (!delegatedRetry || await repeat.isVisible()) target = repeat;
      else if (!(await spin.isVisible())) target = wheel;
    }
    if (!(await target.isVisible())) {
      fail('trigger', '고른 방식으로 다시 돌릴 조작이 없음');
      return spins;
    }
    if (turn === 1) await page.emulateMedia({ reducedMotion: 'reduce' });
    await target.click(action);
    if (turn === 0) {
      await target.evaluate((button, count) => {
        const wheel = document.querySelector('#roulette-wheel');
        if (Number(wheel?.getAttribute('data-spin-count')) === count) button.click();
      }, previous.count);
    }
    let current;
    if (!(await waitUntil(page, async () => {
      current = await readRoulette(frame);
      return current?.count === previous.count + 1;
    }, 5800))) {
      fail('settle', '회전을 시작한 뒤 6초 안에 한 번의 당첨이 확정되지 않음');
      return spins;
    }
    // A CSS transform can land one browser frame after the completion counter.
    // Read the actual geometry again during the same short settling window.
    const aligned = await waitUntil(page, async () => {
      current = await readRoulette(frame);
      const closest = current?.markers[0];
      const winner = current?.legend.find(item => item.number === closest?.number)?.label;
      return current?.count === previous.count + 1 && closest
        && closest.distance <= (2 * Math.PI / current.markers.length) * 0.4
        && winner && await visibleText(resultDisplay) === '당첨 결과: ' + winner;
    }, 350);
    if (!current) {
      fail('contract', '회전 뒤 원판이나 포인터가 사라짐');
      return spins;
    }
    const { markers, legend } = current;
    const count = markers.length;
    const winner = legend.find(item => item.number === markers[0]?.number)?.label;
    const expectedNumbers = Array.from({ length: count }, (_, index) => index + 1).join(',');
    if (!count || count > 30 || legend.length !== count
        || markers.some(m => !m.visible || m.text !== String(m.number))
        || legend.some(item => !item.label || !item.visible)
        || markers.map(m => m.number).sort((a, b) => a - b).join(',') !== expectedNumbers
        || legend.map(item => item.number).sort((a, b) => a - b).join(',') !== expectedNumbers) {
      fail('legend', '원판의 번호와 읽을 수 있는 범례가 1:1로 대응하지 않음');
      return spins;
    }
    if (!aligned) {
      fail('result', '포인터가 가리킨 칸·범례·당첨 결과가 일치하지 않음');
      return spins;
    }
    await resultDisplay.scrollIntoViewIfNeeded(read);
    const unobstructed = await resultDisplay.evaluate(el => {
      const { left, top, width, height } = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(left + width / 2, top + height / 2));
    });
    if (!unobstructed) fail('result', '당첨 결과가 다른 요소에 가려짐');
    if (turn === 0 && previous.legend.length !== count) {
      fail('count', '첫 회전에서 시작 항목 수가 바뀜');
      return spins;
    }
    if (turn === 1) {
      const prior = previous.legend.map(l => l.label).sort();
      const actual = legend.map(l => l.label).sort().join('\n');
      const unchanged = actual === prior.join('\n');
      prior.splice(prior.indexOf(previousWinner), 1);
      const excluded = actual === prior.join('\n');
      if (!(answers.again === 'exclude' ? excluded : delegatedRetry ? unchanged || excluded : unchanged)) {
        fail('candidates', '재회전에서 고른 방식과 실제 후보 목록이 다름');
        return spins;
      }
    }
    spins.push({ count, winner, slot: markers[0].number });
    previous = current;
    previousWinner = winner;
  }
  return spins;
}
