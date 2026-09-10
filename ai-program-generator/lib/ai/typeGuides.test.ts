import { describe, it, expect } from 'vitest';
import { getTypeGuide } from './typeGuides';

describe('getTypeGuide', () => {
  it('품질 점검에서 고위험으로 확인된 유형에만 규칙이 있고, 모르는 유형·미지정은 빈 문자열', () => {
    expect(getTypeGuide('maze')).toMatch(/generateMaze/);
    expect(getTypeGuide('dressup')).toMatch(/\(200, 220\)/); // 좌표 고정 규칙
    expect(getTypeGuide('dressup')).not.toMatch(/<svg|canvas|<div/); // 그리는 방식은 강제하지 않는다
    expect(getTypeGuide('paint')).toMatch(/toDataURL/);
    expect(getTypeGuide('paint')).toMatch(/localStorage/);
    expect(getTypeGuide('paint')).toMatch(/navigator\.clipboard/);
    expect(getTypeGuide('paint')).toMatch(/모두 PNG 다운로드로 바꾸세요/);
    expect(getTypeGuide('paint')).toMatch(/getImageData/);
    expect(getTypeGuide('paint')).toMatch(/button-label/);
    expect(getTypeGuide('maze')).toMatch(/gameReady/);
    expect(getTypeGuide('maze')).toMatch(/maze\[y\]\[x\]/);
    expect(getTypeGuide('maze')).toMatch(/maze = generateMaze/);
    expect(getTypeGuide('sound')).toMatch(/ensureAudio/);
    expect(getTypeGuide('sound')).toMatch(/성공 여부\(boolean\)/);
    expect(getTypeGuide('sound')).toMatch(/if \(!ensureAudio\(\)\) return/);
    expect(getTypeGuide('sound')).toMatch(/재생할 때마다 새로/);
    expect(getTypeGuide('sound')).toMatch(/유한한 숫자/);
    expect(getTypeGuide('aquarium')).toMatch(/AudioContext/);
    expect(getTypeGuide('aquarium')).toMatch(/CanvasGradient/);
    expect(getTypeGuide('aquarium')).toMatch(/NaN/);
    expect(getTypeGuide('quiz')).toBe('');
    expect(getTypeGuide(undefined)).toBe('');
  });

  it('소리를 요구한 유형에는 공통 오디오 규칙을 조건부로 붙인다', () => {
    expect(getTypeGuide('quiz', '정답이면 Web Audio로 효과음을 넣어.')).toMatch(/ensureAudio/);
    expect(getTypeGuide('card', '버튼을 누르면 짧은 멜로디가 나게 해.')).toMatch(/ensureAudio/);
    expect(getTypeGuide('quiz', '소리 없이 조용하게 만들어.')).not.toMatch(/ensureAudio/);
  });

  it('사진 꾸미기는 고정 얼굴 좌표 대신 사진용 배치 규칙을 쓴다', () => {
    const guide = getTypeGuide('dressup', '첨부한 사진을 꾸며.', true);

    expect(guide).toMatch(/드래그/);
    expect(guide).not.toMatch(/\(200, 220\)/);
  });

  it('미로 가이드에 넣은 예시 코드는 실제로 동작하고, 만든 미로는 항상 출구까지 길이 있다', () => {
    const guide = getTypeGuide('maze');
    const blocks = [...guide.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length).toBe(1); // hasPath 검사 함수는 뺐다 — 모델이 변형해(q.push(next)) 무한 루프를 만든 실측(10건 중 6건 변형)
    // 생성 JavaScript에 주석을 넣지 않는 프롬프트 규칙을 예시 코드도 지킨다.
    expect(blocks[0]).not.toMatch(/\/\//);
    expect(blocks[0]).not.toMatch(/\/\*/);
    const generateMaze = new Function(`${blocks[0]}; return generateMaze;`)() as (w: number, h: number) => number[][];
    // 테스트용 독립 BFS(가이드에 넣지 않음)
    const reachable = (g: number[][], sx: number, sy: number, ex: number, ey: number) => {
      const h = g.length, w = g[0].length, seen = new Set<number>([sy * w + sx]), q = [sy * w + sx];
      while (q.length) {
        const c = q.shift()!, cx = c % w, cy = Math.floor(c / w);
        if (cx === ex && cy === ey) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy, k = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && g[ny][nx] === 0 && !seen.has(k)) { seen.add(k); q.push(k); }
        }
      }
      return false;
    };
    for (const size of [11, 15, 21, 25]) {
      for (let k = 0; k < 20; k++) {
        const g = generateMaze(size, size);
        expect(g.length).toBe(size);
        expect(g[1][1]).toBe(0);
        expect(g[size - 2][size - 2]).toBe(0);
        expect(reachable(g, 1, 1, size - 2, size - 2)).toBe(true);
        // 완전 미로: 모든 홀수 좌표 칸이 길이다(도달 가능)
        for (let y = 1; y < size; y += 2) for (let x = 1; x < size; x += 2) expect(g[y][x]).toBe(0);
      }
    }
  });
});
