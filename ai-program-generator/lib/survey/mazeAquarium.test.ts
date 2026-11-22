import { describe, expect, it } from 'vitest';
import { getTypeGuide } from '../ai/typeGuides';
import { assemblePrompt, visibleSteps } from './assemble';
import { aquarium } from './programs/aquarium';
import { maze } from './programs/maze';

describe('미로 선택과 실행 지침', () => {
  it.each([['small', 11], ['medium', 15], ['large', 21], ['huge', 25]])('크기 %s를 같은 홀수 칸으로 조립한다', (size, side) => {
    expect(assemblePrompt(maze, { size })).toContain(side + '×' + side + ' 칸');
    expect(getTypeGuide('maze')).toContain(side + '×' + side);
  });

  it('목표나 크기를 바꾸면 이전 보물 힌트와 미니맵을 적용하지 않는다', () => {
    const answers = { goal: 'key', treasure_count: '5', treasure_hint: 'arrow', size: 'small', minimap: 'yes' };
    expect(visibleSteps(maze, answers).map(step => step.id)).not.toContain('treasure_hint');
    expect(assemblePrompt(maze, answers)).not.toMatch(/작은 화살표를 보여줘|미니맵을 넣어/);
    expect(assemblePrompt(maze, { ...answers, goal: 'treasure', size: 'large' })).toMatch(/미니맵을 넣어.*작은 화살표를 보여줘/);
  });

  it('열쇠 획득 전 이동, 함정 해제, 조작과 승리 표시를 일치시킨다', () => {
    const prompt = assemblePrompt(maze, { goal: 'key', control: 'swipe', trap: ['hole'] });
    expect(prompt).toContain('열쇠를 찾기 전에도 출구 칸은 지날 수 있어');
    expect(prompt).toContain('키보드 방향키와 화면 버튼');
    expect(prompt).toContain('스와이프하면 한 칸씩');
    expect(prompt).toContain('구덩이는 이번 도전에서 해제');
    const guide = getTypeGuide('maze');
    expect(guide).toContain('승리만 보류');
    expect(guide).toContain('data-maze-goal');
    expect(guide).toContain('id="maze-victory"');
    expect(guide).toContain('승리 화면이 팝업이면 그 팝업 안의 버튼에 붙이고');
    expect(guide).not.toContain('data-aquarium-tracks');
  });
});

describe('수족관 선택과 실행 지침', () => {
  it('먹은 뒤 그대로여도 먹이 놓기·접근·섭취는 동작한다', () => {
    const prompt = assemblePrompt(aquarium, {
      place: 'forest', decor: 'yes', creatures: ['turtle', 'fish'], count: 'few', click: 'feed', grow: 'none',
    });
    expect(prompt).toContain('연못은 돌과 연잎');
    expect(prompt).toContain('먹이 놓기·접근·섭취는 그대로 작동');
    expect(prompt).toContain('크기, 색, 속도, 수는 그대로 유지');
    expect(prompt).toContain('수를 합쳐서 처음에 총 5마리·개');
    expect(prompt).not.toContain('특별한 반응이나 추가 효과를 넣지 마');
    const guide = getTypeGuide('aquarium');
    expect(guide).toContain('실제로 닿았을 때 먹이를 제거');
    expect(guide).toContain('data-aquarium-tracks');
    expect(guide).toContain('종류·수를 유지');
    expect(guide).toContain('360px와 390px');
    expect(guide).toMatch(/min-width: 0;\s+max-width: 100%;[\s\S]*?aspect-ratio: auto;\s+min-height: 0;/);
    expect(guide).not.toContain('data-maze-goal');
  });

  it('장식 없음과 선택한 배경 효과를 함께 유지하고 지난 먹이 답을 제외한다', () => {
    const prompt = assemblePrompt(aquarium, {
      place: 'space', decor: 'no', spacefx: 'meteor', click: 'ripple', feedkind: 'shrimp', grow: 'bigger',
    });
    expect(prompt).toContain('별똥별이 화면을 가로질러');
    expect(prompt).toContain('추가 장식 없이');
    expect(prompt).toContain('물결이 퍼지는 효과');
    expect(prompt).not.toMatch(/작은 새우 모양|먹이를 먹은 생물/);
  });
});
