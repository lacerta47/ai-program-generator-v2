import { describe, it, expect } from 'vitest';
import { getTypeGuide } from './typeGuides';

describe('getTypeGuide', () => {
  it('미로에만 규칙이 있고, 모르는 유형·미지정은 빈 문자열', () => {
    expect(getTypeGuide('maze')).toMatch(/generateMaze/);
    expect(getTypeGuide('quiz')).toBe('');
    expect(getTypeGuide(undefined)).toBe('');
  });

  it('미로 가이드에 넣은 예시 코드는 실제로 동작하고, 만든 미로는 항상 출구까지 길이 있다', () => {
    const guide = getTypeGuide('maze');
    const blocks = [...guide.matchAll(/```\n([\s\S]*?)```/g)].map((m) => m[1]);
    expect(blocks.length).toBe(1); // hasPath 검사 함수는 뺐다 — 모델이 변형해(q.push(next)) 무한 루프를 만든 실측(10건 중 6건 변형)
    // 프롬프트 규칙(주석은 /* */만)을 예시 코드도 지킨다
    expect(blocks[0]).not.toMatch(/\/\//);
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
