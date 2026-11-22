import { describe, expect, it } from 'vitest';
import { getTypeGuide } from '../ai/typeGuides';
import { assemblePrompt, surveyToPlan, visibleSteps } from './assemble';
import { calc } from './programs/calc';
import { card } from './programs/card';
import { clock } from './programs/clock';
import { dressup } from './programs/dressup';
import { fortune } from './programs/fortune';
import { game } from './programs/game';
import { paint } from './programs/paint';
import { sound } from './programs/sound';
import { AI_PICK, type ProgramType, type SurveyAnswers } from './types';

const steps = (type: ProgramType, answers: SurveyAnswers) => visibleSteps(type, answers).map(step => step.id);

describe('나머지 골라서 만들기 유형의 선택 연결', () => {
  it('다른 붓으로 바꾸면 무지개 색과 무지개 속도를 함께 숨긴다', () => {
    const answers = { brush: 'crayon', rainbow: 'yes', rainbow_speed: 'fast' };
    expect(steps(paint, answers)).toContain('rainbow_speed');
    expect(steps(paint, { ...answers, brush: 'pen' })).not.toContain('rainbow_speed');
    expect(steps(paint, { ...answers, brush: 'pen' })).not.toContain('rainbow');
  });

  it('12개 게임 장르에 공통 시작 규칙을 주고 장르별 이전 답을 섞지 않는다', () => {
    const genres = game.steps.find(step => step.id === 'genre')!.options;
    expect(genres).toHaveLength(12);
    for (const { id } of genres) {
      const answers = { genre: id, rps_rounds: 'best3', powerup: ['shield'], powerup_effect: 'flash' };
      expect(steps(game, answers).includes('rps_rounds')).toBe(id === 'rps');
      expect(steps(game, answers).includes('powerup_effect')).toBe(['dodge', 'collect', 'mole', 'run'].includes(id));
      expect(getTypeGuide('game', assemblePrompt(game, answers))).toContain('data-game-state="ready|playing|ended"');
    }
  });

  it('자기소개와 좋아하는 것을 모두 골랐을 때만 동물을 반영한다', () => {
    const answers = { kind: 'me', meinfo: ['fav'], favkind: 'animal', animaldetail: 'cat' };
    expect(steps(card, answers)).toEqual(expect.arrayContaining(['favkind', 'animaldetail']));
    for (const changed of [{ ...answers, kind: 'birthday' }, { ...answers, meinfo: ['name'] }]) {
      expect(steps(card, changed)).not.toContain('favkind');
      expect(steps(card, changed)).not.toContain('animaldetail');
      expect(surveyToPlan(card, changed).etc).not.toContain('어떤 동물을 좋아해?');
    }
  });

  it('이름 칸을 생략해도 사진 선택은 유지하고 사진만 움직이지 않는다', () => {
    const answers = { deco: ['photo'], decomotion: 'spin', nameField: 'no' };
    const prompt = assemblePrompt(card, answers);
    expect(prompt).toContain('카드에 내가 올린 사진');
    expect(prompt).not.toContain('사진 첨부·사진 영역을 넣지 마');
    expect(steps(card, answers)).not.toContain('decomotion');
    expect(steps(card, { ...answers, deco: ['heart', 'photo'] })).toContain('decomotion');
  });

  it('계산기에서 이전 힌트나 채점 효과음을 적용하지 않는다', () => {
    const answers = { mode: 'calc', range: 'r100', hint: 'count', btnsound: 'click', soundfx: 'fanfare', ops: ['add'] };
    expect(steps(calc, answers)).not.toContain('hint');
    expect(steps(calc, answers)).not.toContain('soundfx');
    expect(assemblePrompt(calc, answers)).toContain('[적용 연산] 더하기 ＋.');
    expect(assemblePrompt(calc, { mode: 'calc' })).toContain('[적용 연산] 더하기, 빼기, 곱하기, 나누기.');
    expect(assemblePrompt(calc, answers)).not.toContain('팡파레');
  });

  it('힌트는 고른 방식이 우선이며 소리를 끈 연습에서 소리 선택이 나오지 않는다', () => {
    const answers = { mode: 'guess', range: 'r100', hint: 'count', wrongfx: 'funny', soundfx: 'fanfare' };
    for (const btnsound of ['none', AI_PICK]) {
      const input = { ...answers, btnsound };
      expect(steps(calc, input)).not.toContain('soundfx');
      expect(assemblePrompt(calc, input)).toContain('힌트 방식을 안 고르면');
      expect(assemblePrompt(calc, input)).toContain('몇 번 시도했는지');
      expect(assemblePrompt(calc, input)).not.toContain('Web Audio로 웃긴 효과음');
    }
    expect(steps(calc, { ...answers, btnsound: 'piano' })).toContain('soundfx');
  });

  it('수수께끼에는 이전 행운 동물 답을 쓰지 않고 한 번만 뽑아도 정답을 볼 수 있다', () => {
    const answers = { kind: 'riddle', luckyextras: ['animal'], animalshow: 'spin', again: 'no' };
    expect(steps(fortune, answers)).not.toContain('animalshow');
    const prompt = assemblePrompt(fortune, answers);
    expect(prompt).toContain('정답 보기');
    expect(prompt).toContain('처음 뽑기 버튼을 비활성화');
    expect(prompt).not.toContain('행운의 동물이 빙글');
  });

  it('운세 발표와 현재 화면의 확대를 다른 행동으로 요구한다', () => {
    expect(assemblePrompt(fortune, { share: 'show', again: 'no' })).toMatch(/비활성화.*발표 화면/);
    expect(assemblePrompt(fortune, { share: 'copy' })).toContain('현재 결과 목록 안에서');
    expect(assemblePrompt(fortune, { share: 'copy' })).not.toContain('발표 화면');
  });

  it.each(['follow', 'both'])('피아노 %s에서만 연습곡과 점수가 활성화된다', (playmode) => {
    const answers = { instrument: 'piano', playmode, songslist: 'twinkle', score: 'stars' };
    expect(steps(sound, answers)).toEqual(expect.arrayContaining(['songslist', 'score']));
    for (const changed of [{ ...answers, instrument: 'drum' }, { ...answers, playmode: 'free' }]) {
      expect(steps(sound, changed)).not.toContain('songslist');
      expect(steps(sound, changed)).not.toContain('score');
      expect(assemblePrompt(sound, changed)).not.toContain('반짝반짝 작은 별');
    }
  });

  it('작은 건반으로도 연습곡에 필요한 음을 칠 수 있어야 한다', () => {
    const prompt = assemblePrompt(sound, { instrument: 'piano', playmode: 'follow', songslist: 'twinkle', keycount: 'small' });
    expect(prompt).toContain('음역 전환');
    expect(getTypeGuide('sound', prompt)).toContain('음역 전환으로 나눠서 같은 전체 음을 칠 수 있게');
  });

  it('계속 꾸미기를 골라도 색종이 효과를 쓸 수 있다', () => {
    const prompt = assemblePrompt(dressup, { finish: 'keep', effect: ['confetti'] });
    expect(prompt).toContain('계속 꾸미기를 골랐다면 부품을 선택할 때');
  });

  it('사진 꾸미기는 사진을 바탕색으로 덮지 않고 선택한 소품을 유지한다', () => {
    const answers = { base: 'photo', basecolor: 'green', random: 'both', finish: 'compare' };
    expect(steps(dressup, answers)).not.toContain('basecolor');
    expect(assemblePrompt(dressup, answers)).not.toContain('캐릭터 바탕 색을 초록 계열로');
    expect(getTypeGuide('dressup', assemblePrompt(dressup, answers), true)).toContain('캐릭터 종류와 사진 원본은 선택한 상태로 유지');
  });

  it.each([
    ['clock', false, false],
    ['alarm', true, false],
    ['timer', true, true],
    ['stopwatch', false, true],
  ] as const)('%s에 맞는 알림과 조작 선택지만 보인다', (kind, alarm, controls) => {
    const answers = { kind, sound: 'beep', controls: 'onebig', endfx: ['flash'], extra: ['lap'] };
    expect(steps(clock, answers).includes('sound')).toBe(alarm);
    expect(steps(clock, answers).includes('controls')).toBe(controls);
    expect(steps(clock, answers).includes('extra')).toBe(controls);
    expect(steps(clock, { ...answers, seconds: 'no' }).includes('seconds')).toBe(!controls);
    if (controls) expect(assemblePrompt(clock, { ...answers, seconds: 'no' })).toContain('분:초를 보여주고');
    expect(assemblePrompt(clock, answers).includes('시작↔멈춤이 바뀌는')).toBe(controls);
  });
});
