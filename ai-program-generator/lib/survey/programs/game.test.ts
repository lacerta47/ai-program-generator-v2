import { describe, expect, it } from 'vitest';
import { assemblePrompt, visibleSteps } from '../assemble';
import { game } from './game';

const newGenres = [
  ['blockstack', '블록 쌓기 게임'],
  ['breakout', '블록 깨기 게임'],
  ['snake', '꼬리 키우기 게임'],
  ['shooter', '우주 슈팅 게임'],
  ['tower', '탑 높이 쌓기 게임'],
  ['numbermerge', '숫자 합치기 게임'],
] as const;

describe('game survey genres', () => {
  it('기존 6종과 새 게임 6종을 모두 제공한다', () => {
    const genreStep = game.steps.find((step) => step.id === 'genre');

    expect(genreStep?.options.map((option) => option.id)).toEqual([
      'dodge',
      'collect',
      'mole',
      'run',
      'rps',
      'memory',
      'blockstack',
      'breakout',
      'snake',
      'shooter',
      'tower',
      'numbermerge',
    ]);
  });

  it.each(newGenres)('%s 장르의 작품 이름을 만든다', (genre, expectedName) => {
    expect(game.buildName({ genre })).toBe(expectedName);
  });

  it.each([
    ['blockstack', ['blockstack_theme', 'blockstack_difficulty']],
    ['breakout', ['breakout_theme', 'breakout_difficulty']],
    ['snake', ['snake_food', 'snake_difficulty']],
    ['shooter', ['hero', 'shooter_enemy', 'shooter_weapon']],
    ['tower', ['tower_material', 'tower_speed']],
    ['numbermerge', ['numbermerge_goal', 'numbermerge_theme']],
  ] as const)('%s 장르에는 전용 선택지만 노출한다', (genre, expectedIds) => {
    const ids = visibleSteps(game, { genre }).map((step) => step.id);

    expect(ids).toEqual(expect.arrayContaining([...expectedIds]));
    expect(ids).not.toEqual(expect.arrayContaining(['control', 'scoring', 'endcond', 'speed', 'powerup']));
  });

  it.each([
    ['blockstack', ['10×18', '가득 찬 줄', '생성 위치']],
    ['breakout', ['목숨 3개', '블록을 모두', '같은 충돌']],
    ['snake', ['바로 반대 방향', '빈 칸', '자기 몸']],
    ['shooter', ['스페이스바', '발사 버튼', '안전하게 제거']],
    ['tower', ['겹친 부분', '전혀 겹치지', '카메라']],
    ['numbermerge', ['압축', '한 번만', '움직였을 때만']],
  ] as const)('%s 생성 프롬프트에 핵심 작동 규칙이 들어간다', (genre, rules) => {
    const prompt = assemblePrompt(game, { genre });

    for (const rule of rules) expect(prompt).toContain(rule);
  });

  it('장르를 바꿔도 이전 액션 장르의 조건부 질문이 남지 않는다', () => {
    const ids = visibleSteps(game, {
      genre: 'numbermerge',
      collectitem: 'star',
      speed: 'fast',
      powerup: ['shield'],
    }).map((step) => step.id);

    expect(ids).not.toEqual(expect.arrayContaining(['star_effect', 'speedup', 'powerup_effect']));
  });
});
