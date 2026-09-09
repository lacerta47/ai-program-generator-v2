// 선택지(설문) 유형별 '제작 규칙' — 아이가 고른 내용(basePrompt·선택 조각)은 그대로 두고, 그 유형이
// 구조적으로 깨지지 않게 만드는 방법만 서버가 시스템 프롬프트에 덧붙인다. /api/generate(programType)와
// 자동예시(generateExampleOnce)가 같은 표를 쓴다. 유형 id는 lib/survey/programs의 ProgramType.id.
//
// 실측 배경(2026-09-10): 미로는 "코드로 자동 생성"만 지시하니 칸마다 무작위 벽을 세워 출구까지 길이 없는
// 미로가 자주 나왔고, 보물·열쇠도 도달 불가 위치에 놓였다. 완전 미로(perfect maze) 알고리즘을 강제하면
// 모든 칸이 연결되므로 구조적으로 못 깨는 미로가 나오지 않는다.

const MAZE_GUIDE = `

**미로 제작 규칙 (반드시 지킬 것 — 이 규칙을 어기면 풀 수 없는 미로가 나옵니다)**:
1. 미로는 반드시 아래 \`generateMaze\` 함수(재귀 백트래킹, 완전 미로)로만 만드세요. 이 함수는 홀수 크기 격자에서 모든 길 칸이 서로 연결됨을 보장합니다. **아래 코드를 한 글자도 바꾸지 말고 그대로 넣으세요**(이름·변수·줄 하나라도 고치면 보장이 깨집니다). 칸마다 무작위로 벽을 세우는 방식은 절대 금지입니다.
\`\`\`
function generateMaze(w, h) {
  /* w, h는 홀수. 1=벽, 0=길. 시작(1,1) 출구(h-2,w-2)는 항상 연결됨 */
  var g = [];
  for (var y = 0; y < h; y++) { g.push([]); for (var x = 0; x < w; x++) g[y].push(1); }
  var stack = [[1, 1]]; g[1][1] = 0;
  var dirs = [[0, 2], [0, -2], [2, 0], [-2, 0]];
  while (stack.length) {
    var cur = stack[stack.length - 1];
    var cx = cur[0], cy = cur[1];
    var options = [];
    for (var i = 0; i < 4; i++) {
      var nx = cx + dirs[i][0], ny = cy + dirs[i][1];
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && g[ny][nx] === 1) options.push([nx, ny]);
    }
    if (options.length === 0) { stack.pop(); continue; }
    var next = options[Math.floor(Math.random() * options.length)];
    g[cy + (next[1] - cy) / 2][cx + (next[0] - cx) / 2] = 0;
    g[next[1]][next[0]] = 0;
    stack.push(next);
  }
  return g;
}
\`\`\`
2. 크기는 홀수로: 작게=11×11, 보통=15×15, 크게=21×21, 아주 크게=25×25. 계획서에 더 큰 수가 있어도 25를 넘기지 마세요(저학년 화면·조작 한계).
3. 시작 위치는 (1,1), 출구는 (h-2, w-2)로 고정하고 두 칸을 눈에 띄게 표시하세요.
4. 보물·별·열쇠·문처럼 '가야 하는 것'은 반드시 길 칸(값 0) 위에만, 시작·출구가 아닌 칸에 놓으세요. 길 칸 목록에서 무작위로 고르면 됩니다(완전 미로라 길 칸은 모두 도달 가능).
5. 함정(구덩이·귀신·화살·얼음)은 벽을 추가하거나 길을 막으면 안 됩니다. 밟으면 시작점으로 돌아가거나 한 칸 더 미끄러지는 식으로만 구현하세요. 귀신처럼 움직이는 것은 길 칸 위로만 움직이게 하세요.
6. \`generateMaze\`가 만든 미로는 항상 풀 수 있으므로 **길이 있는지 다시 검사하거나 검사 결과에 따라 다시 생성하는 루프(while·do-while)를 만들지 마세요.** 그런 검사 코드가 잘못 쓰이면 프로그램이 영원히 멈춥니다. 미로는 한 번만 생성해서 그대로 쓰세요.
7. 이동은 한 번에 한 칸, 벽(값 1)으로는 못 가게 하세요. 방향키와 화면 버튼(↑↓←→) 둘 다 같은 이동 함수를 부르게 하세요.
8. 미로는 화면에 다 보이게 그리세요(칸 크기 = 화면 폭 ÷ 칸 수). 미니맵을 넣더라도 본 미로가 우선입니다.`;

/** 유형 id → 제작 규칙. 없는 유형은 빈 문자열(아무것도 덧붙이지 않음). */
const SURVEY_TYPE_GUIDES: Record<string, string> = {
  maze: MAZE_GUIDE,
};

export function getTypeGuide(programType?: string): string {
  return (programType && SURVEY_TYPE_GUIDES[programType]) || '';
}
