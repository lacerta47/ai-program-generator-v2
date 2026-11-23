// 선택지(설문) 유형별 '제작 규칙' — 아이가 고른 내용(basePrompt·선택 조각)은 그대로 두고, 그 유형이
// 구조적으로 깨지지 않게 만드는 방법만 서버가 시스템 프롬프트에 덧붙인다. /api/generate(programType)와
// 자동예시(generateExampleOnce)가 같은 표를 쓴다. 유형 id는 lib/survey/programs의 ProgramType.id.
//
// 실측 배경(2026-09-10): 미로는 "코드로 자동 생성"만 지시하니 칸마다 무작위 벽을 세워 출구까지 길이 없는
// 미로가 자주 나왔고, 보물·열쇠도 도달 불가 위치에 놓였다. 완전 미로(perfect maze) 알고리즘을 강제하면
// 모든 칸이 연결되므로 구조적으로 못 깨는 미로가 나오지 않는다.

const DESIGN_SELECTION_CONTRACT = `

**학생 선택 디자인 연동 규칙 (디자인 프리셋보다 우선)**:
1. 새 계획서의 끝에 \`[학생이 고른 디자인]\`이 있으면 그 안의 배경·색·모양·분위기를 그대로 구현하세요. 아래 프리셋의 기본 색이나 분위기로 바꾸지 마세요.
2. 분위기·테마가 암시하는 색과 별도의 구체적인 색 선택이 다르면 구체적인 선택이 우선입니다. 예를 들어 '사탕 나라'와 '깊은 파란 배경'을 함께 골랐다면 배경은 깊은 파란색으로 만들고, 사탕 나라 느낌은 소품·무늬·형태로 표현하세요.
3. 배경 선택은 페이지·놀이 무대의 바탕에, 버튼 색 선택은 버튼에, 캐릭터·물고기·블록 색 선택은 그 대상에만 적용하세요. 한 대상의 색을 화면 전체 대표색으로 무리하게 확대하지 마세요.
4. 선택한 색을 기준으로 CSS 변수 \`--canvas\`, \`--surface\`, \`--ink\`, \`--primary\`, \`--accent\`를 정하세요. 배경과 글자는 4.5:1 이상 대비시키고, 선택한 색이 연하면 글자를 짙게, 어두우면 글자를 밝게 하세요.
5. 무지개·알록달록·네온처럼 여러 색을 고른 경우 그 색은 선택한 대상에 집중하고, 나머지 카드·설명·조작부는 흰색·짙은 남색 같은 중립색으로 정리하세요. 명시된 여러 색 외에 강한 색을 더 늘리지 마세요.
6. 색 선택이 없거나 AI에게 맡긴 경우에만 아래 유형 프리셋의 기본 팔레트를 고르세요.`;

const PLAYFUL_TOOL_DESIGN = `

**도구·학습 놀이 디자인 프리셋**:
1. 화면 순서는 짧은 제목 → 가장 중요한 문제·결과 카드 → 주요 조작 → 상태·도움말로 구성하고, 한 화면에서 가장 중요한 행동 하나만 진한 버튼으로 강조하세요.
2. 바깥 컨테이너는 \`width: min(100%, 720px)\`, 모바일 좌우 padding 16px 이상으로 중앙 배치하세요. 카드 간격은 16px, 카드 안쪽 여백은 20~24px로 통일하세요.
3. 카드 모서리는 16~20px, 버튼·입력은 12~16px로 통일하고, 기본 카드에는 얇은 테두리 또는 아주 약한 그림자 중 하나만 사용하세요.
4. 선택지·숫자 버튼은 데스크톱 2~4열에서 모바일 1~2열로 줄이고, 좁게 찌그러뜨리거나 가로 스크롤시키지 마세요. 선택·정답·오답은 색뿐 아니라 글자나 테두리 변화로도 구분하세요.
5. 별도 색 선택이 없으면 밝은 바탕, 흰 카드, 짙은 남색 글자에 민트·노랑·코랄 중 최대 2개를 포인트로 쓰세요.`;

const CREATIVE_STUDIO_DESIGN = `

**창작 놀이터 디자인 프리셋**:
1. 그림·캐릭터·수족관·악기 같은 창작 무대가 화면에서 가장 크고 먼저 보이게 하세요. 도구와 설명 패널이 무대보다 넓거나 화려하면 안 됩니다.
2. 데스크톱은 무대와 조작부를 나란히 둘 수 있지만, 모바일은 무대 다음에 조작부를 한 열로 배치하세요. 조작부는 기능별 작은 묶음으로 나누고 한 줄에 버튼을 3개 넘게 빽빽하게 넣지 마세요.
3. 같은 작품의 SVG·Canvas 그래픽은 윤곽선 굵기, 둥근 선 끝, 명암 단계와 하이라이트 방식을 통일하세요. 서로 다른 화풍의 이모지·문자 그림을 핵심 그래픽에 섞지 마세요.
4. 무대 주변 카드와 도구는 차분한 중립색으로 두어 학생이 고른 작품 색이 주인공이 되게 하세요. 장식 그라데이션·반짝임·그림자는 한 화면에 각각 한 종류만 사용하세요.
5. 별도 색 선택이 없으면 따뜻한 흰 바탕과 파스텔 민트·라일락·코랄 중 어울리는 2색을 사용하세요.`;

const FRIENDLY_ARCADE_DESIGN = `

**친근한 게임 디자인 프리셋**:
1. 제목 → 점수·시간·목숨을 담은 짧은 HUD → 가장 큰 게임 무대 → 조작 버튼 → 결과·다시하기 순서로 구성하세요. 긴 설명 카드나 게임과 무관한 장식 패널은 만들지 마세요.
2. 미로·룰렛은 정사각형 무대를, 움직이는 아케이드 게임은 4:3 또는 16:9 무대를 사용하고, 무대가 모바일 화면 너비를 넘지 않게 하세요. HUD는 가능하면 한 줄, 모바일에서는 두 줄 이내로 유지하세요.
3. 시작·다시하기 같은 대표 행동 하나만 진한 버튼으로 강조하고, 화면 조작 버튼은 48×48px 이상으로 게임 무대 아래 엄지손가락이 닿기 쉬운 곳에 배치하세요.
4. 게임 오브젝트와 배경은 명확히 구분하고, 충돌 대상·목표·플레이어는 색뿐 아니라 모양이나 테두리로도 구별하세요. 장식보다 현재 상태와 다음 행동이 먼저 보여야 합니다.
5. 별도 색 선택이 없으면 밝은 바탕 또는 짙은 남색 바탕 하나를 고르고, 대표색 1개와 강조색 1개만 선명하게 사용하세요.`;

type DesignPreset = 'playful-tool' | 'creative-studio' | 'friendly-arcade';

const DESIGN_PRESET_BY_TYPE: Record<string, DesignPreset> = {
  quiz: 'playful-tool',
  card: 'playful-tool',
  calc: 'playful-tool',
  fortune: 'playful-tool',
  clock: 'playful-tool',
  paint: 'creative-studio',
  sound: 'creative-studio',
  aquarium: 'creative-studio',
  dressup: 'creative-studio',
  game: 'friendly-arcade',
  maze: 'friendly-arcade',
  roulette: 'friendly-arcade',
};

const DESIGN_PRESETS: Record<DesignPreset, string> = {
  'playful-tool': PLAYFUL_TOOL_DESIGN,
  'creative-studio': CREATIVE_STUDIO_DESIGN,
  'friendly-arcade': FRIENDLY_ARCADE_DESIGN,
};

export function getDesignPreset(programType?: string): string {
  if (!programType) return '';
  const preset = DESIGN_PRESET_BY_TYPE[programType];
  return preset ? DESIGN_SELECTION_CONTRACT + DESIGN_PRESETS[preset] : '';
}

const MAZE_GUIDE = `

**미로 제작 규칙 (반드시 지킬 것 — 이 규칙을 어기면 풀 수 없는 미로가 나옵니다)**:
1. 미로는 반드시 아래 \`generateMaze\` 함수(재귀 백트래킹, 완전 미로)로만 만드세요. 이 함수는 홀수 크기 격자에서 모든 길 칸이 서로 연결됨을 보장합니다. **아래 코드를 한 글자도 바꾸지 말고 그대로 넣으세요**(이름·변수·줄 하나라도 고치면 보장이 깨집니다). 칸마다 무작위로 벽을 세우는 방식은 절대 금지입니다.
\`\`\`
function generateMaze(w, h) {
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
3. (x,y) 기준 시작은 (1,1), 출구는 (w-2,h-2)로 고정하고 두 칸을 눈에 띄게 표시하세요. 문은 출구 칸 위의 표시이며, 중간 통로에 별도 문 장애물을 두지 마세요. 열쇠 유무나 문 상태를 이동 검사에 쓰지 마세요. 목표를 다 모으기 전에도 출구 칸으로 들어가거나 지나갈 수 있어야 하며, 그때는 남은 목표를 안내하고 승리만 보류하세요.
4. \`maze\`에는 벽=1·길=0만 저장하세요. 보물·별·열쇠를 선택했다면 요구한 수를 시작·출구와 겹치지 않는 서로 다른 길 칸에 배치하고 별도 상태로 관리하세요. 주인공이 닿으면 한 번만 수집해 화면 표시와 남은 수를 함께 갱신하세요. 수집 뒤 출구에 도착하면 승리를 보여주세요.
5. 선택한 함정만 구현하세요. 출발점으로 돌려보내는 고정 함정은 해당 도전에서 한 번 발동한 뒤 해제하세요. 귀신은 길을 막는 벽으로 처리하지 말고 6초 주기 중 처음 2초는 쉬는 모습으로 표시하고 충돌을 끄세요. 충돌 시 플레이어를 시작 칸으로 보낸 뒤 짧은 충돌 유예를 주고, 수집한 물건과 진행 중인 시간은 유지하세요. 함정을 시작·출구·수집물 칸 위에 처음부터 놓지 마세요.
6. \`generateMaze\`가 만든 미로는 항상 풀 수 있으므로 **길이 있는지 다시 검사하거나 검사 결과에 따라 다시 생성하는 루프(while·do-while)를 만들지 마세요.** 그런 검사 코드가 잘못 쓰이면 프로그램이 영원히 멈춥니다. 미로는 한 번만 생성해서 그대로 쓰세요.
7. 이동은 한 번에 한 칸, 벽(값 1)으로는 못 가게 하세요. 방향키와 44px 이상 화면 버튼(↑↓←→) 둘 다 같은 이동 함수를 부르게 하세요. 스와이프는 선택했을 때 같은 함수를 사용하세요. 얼음은 곧은 통로에 두고 갈림길을 건너뛰지 않게 하세요. 추가 이동도 한 칸씩 벽·경계와 수집·출구를 검사하세요.
8. 미로는 화면에 다 보이게 그리세요(칸 크기 = 화면 폭 ÷ 칸 수). 미니맵을 넣더라도 본 미로가 우선입니다.
9. 생성된 2차원 배열은 \`maze\` 변수에 보관하고 초기화 순서를 고정하세요: DOM 요소 찾기 → 상태 초기화 → \`maze = generateMaze(...)\` → 보물·출구 배치 → 본 미로 렌더링 → 플레이어 표시 → 입력 활성화 → 타이머 시작. 이 순서가 끝나기 전에는 이동 함수를 실행하지 마세요.
10. \`gameReady\` 같은 boolean을 두고, 이동 함수 첫 줄에서 준비되지 않았으면 즉시 return 하세요. \`maze[nextY]\`가 있고 \`maze[nextY][nextX]\`가 정의되어 있는지 확인한 뒤 벽을 검사하세요.
11. 좌표는 어디서나 \`maze[y][x]\`로만 읽고, DOM 칸에도 \`data-x\`와 \`data-y\`를 같은 뜻으로 넣으세요. x와 y의 순서를 섞지 마세요.
12. 본 미로 이동·선택한 목표·승리·다시 시작을 먼저 완성하세요. 부가 기능도 같은 코드 안에 정의하세요. 다시 시작할 때 타이머를 정리하고 플레이어·수집·승리/실패·시간을 초기화하세요. 이동 이벤트는 한 번만 등록해 다시 시작 후에도 키를 한 번 누르면 한 번만 이동하게 하세요. 새 미로를 만들 때만 해제한 함정을 복원하세요.
13. 벽은 테마 색과 질감으로 표시하고 벽마다 같은 이모지를 넣지 마세요. 칸 크기는 화면에 맞춘 보드 폭을 칸 수로 나누고 내용물과는 무관하게 유지하세요. 문·수집물·캐릭터·귀신은 위치를 겹쳐 그려 서로 밀지 않게 하세요. 문이 열려도 같은 크기에서 색과 잠금 표시만 바꾸세요. 창 크기 변경 때도 논리 좌표를 유지하세요.
14. 플레이 판정에 쓰는 화면 표시는 \`#maze-board\`에 \`data-maze-state="playing|won|lost"\` 중 현재 값 하나, 각 칸에 \`data-maze-cell="wall|path"\` 중 해당 값과 \`data-x\`/\`data-y\`를 넣으세요. 현재 위치에 \`data-maze-player\`, 출구에 \`data-maze-exit\`, 아직 남은 필수 수집물에 \`data-maze-goal\`을 같은 칸 요소에 붙이세요. 화면 방향 버튼의 \`data-maze-move\`는 \`ArrowUp\`/\`ArrowDown\`/\`ArrowLeft\`/\`ArrowRight\` 중 실제 값을 쓰세요. 승리 화면에는 \`id="maze-victory"\`를 붙이고 실제 승리 후에만 표시하세요. \`id="maze-restart"\`는 승리 후 실제로 보이고 눌리는 다시 시작 버튼 하나에만 붙이세요. 승리 화면이 팝업이면 그 팝업 안의 버튼에 붙이고 배경의 다시 시작 버튼에는 다른 ID를 쓰세요. 두 버튼이 있으면 같은 초기화 함수를 부르세요. 표시 값은 실제 렌더링과 같은 상태에서 갱신하세요.`;

// 꾸미기: 실행 성공작도 종류별 몸 비율, 부품 화풍, 조작부 밀도가 제각각이라 예제급 품질이 나오지 않았다.
// 사진이 아닌 캐릭터는 inline SVG와 레이어 계약으로 통일하고, 종류별 골격만 분리한다.
const DRESSUP_GUIDE = `

**꾸미기 SVG·부품 제작 규칙 (반드시 지킬 것)**:
1. 설문에서 선택한 캐릭터 종류가 최우선입니다. 마지막의 '소재'는 이름·색·무늬 같은 테마에만 쓰고 종류와 골격을 바꾸지 마세요(예: 동물 친구+로봇 소재는 로봇 무늬의 동물이지 로봇이 아닙니다). 사진 꾸미기가 아니면 캐릭터 전체를 하나의 inline SVG(\`id="dressup-character"\`, \`viewBox="0 0 400 400"\`)로 그리세요. SVG 안의 그룹 순서는 \`layer-base\` → \`layer-eyes\` → \`layer-mouth\` → \`layer-head\` → \`layer-accessories\` → \`layer-effects\`로 고정하세요.
2. 선택한 캐릭터 종류에 맞는 골격 하나만 쓰세요.
   - 얼굴: 얼굴 원 중심 (200,210), 반지름 130 / 눈 (150,190)·(250,190) / 입 중심 (200,270) / 머리 장식 중심 (200,75).
   - 로봇: 머리 사각형 (85,55,230,190) / 몸통 (110,255,180,125) / 눈 (150,140)·(250,140) / 입 중심 (200,205) / 안테나 중심 (200,35).
   - 눈사람: 머리 원 중심 (200,115), 반지름 72 / 몸통 원 중심 (200,285), 반지름 105 / 눈 (175,105)·(225,105) / 입 중심 (200,145) / 모자 중심 (200,45) / 목도리 중심 (200,190).
   - 동물 친구: 얼굴 중심 (200,210), 반지름 115 / 귀 중심 (120,95)·(280,95) / 눈 (155,190)·(245,190) / 주둥이·입 중심 (200,255) / 머리 장식 중심 (200,70).
   - 몬스터: 몸 중심 (200,225), 크기 약 250×245 / 눈은 몸 위쪽 y=175 부근에 좌우 균형 배치 / 입 중심 (200,265) / 뿔 중심 (135,85)·(265,85).
3. 같은 부품의 변형은 같은 기준점과 비슷한 크기를 유지하세요. 모든 부품은 동일한 4px 안팎 윤곽선, 둥근 선 끝, 바탕색 1·보조색 2·강조색 1·하이라이트 1의 한 팔레트로 그리세요.
4. 캐릭터 그림과 부품 미리보기에 이모지·문자 그림을 사용하지 마세요. 눈·입·모자·안경·목도리 모두 SVG 기본 도형과 path로 직접 그리세요.
5. 눈·입·머리 장식은 각각 최소 3개의 완성된 SVG 변형을 준비하세요. 보기판 방식의 직접 선택 버튼에는 \`data-dressup-layer="eyes|mouth|head|accessories"\`, \`data-dressup-option="옵션명"\`을 붙이고 작은 SVG 미리보기를 보여주세요. 이전·다음 방식은 부품별 묶음에 \`data-dressup-layer\`를, 두 화살표에 각각 \`data-dressup-action="previous|next"\`를 붙이고 현재 SVG 미리보기와 이름을 보여주세요.
6. 부품 버튼을 누르면 해당 \`layer-*\` 그룹 하나만 바꾸고 다른 레이어와 현재 색은 그대로 유지하세요. 직접 선택 방식은 선택된 버튼 하나만 \`aria-pressed="true"\`로 갱신하고, 이전·다음 방식은 현재 미리보기와 이름을 함께 갱신하세요.
7. 안경·볼터치는 얼굴, 목도리·배지는 몸통 기준점에 배치하고 동시에 표시하는 소품은 최대 2개로 제한하세요. 반짝이는 \`layer-effects\`에 넣어 캐릭터 부품과 겹치지 않게 하세요.
8. \`dressup-stage\`는 화면 가운데 너비 \`min(88vw, 420px)\`, 정사각형으로 두고 SVG는 그 안에서 전부 보여야 합니다. 어떤 부품도 viewBox 0~400 밖으로 나가거나 무대의 \`overflow: hidden\` 때문에 잘리면 안 됩니다.
9. 모바일은 캐릭터 무대 다음에 조작부를 한 열로 배치하세요. 캐릭터보다 조작부가 더 넓거나 높아 보이지 않게 하고, 각 부품 선택지는 한 줄당 3개 이하로 정리하세요.
10. 랜덤 버튼은 \`base\`, \`eyes\`, \`mouth\`, \`head\`, \`accessories\` 중 선택지가 2개 이상인 레이어만 후보로 삼으세요. 그중 변경 가능한 레이어는 최대 3개까지 고른 뒤 각 레이어에서 현재 값을 제외한 선택지 하나를 골라 바꾸세요. 후보가 3개 이상이면 3개를 모두 변경하세요. 캐릭터 종류·사진 원본·배경·효과는 유지하고, 실제 부품 레이어와 선택 표시를 함께 갱신하세요. 초기화 버튼은 최초 상태의 깊은 복사본을 새 상태로 할당한 뒤 모든 SVG 레이어를 다시 그리고, 특정 레이어만이 아니라 모든 직접 선택 버튼의 \`aria-pressed\`와 모든 이전·다음 방식의 현재 미리보기·이름을 순회해 복원하세요. 초기화 렌더링에서는 반짝임처럼 \`layer-effects\`를 변경하는 함수를 호출하지 마세요.
11. 캐릭터와 눈·입·머리 장식 선택을 먼저 완성한 뒤 소품·배경·반짝임·소리·완성 효과를 추가하세요. 핵심 꾸미기가 완성되지 않으면 부가 효과를 생략하세요.`;

const PHOTO_DRESSUP_GUIDE = `

**사진 꾸미기 배치 규칙 (반드시 지킬 것)**:
1. 고정된 얼굴 좌표를 강제하지 말고, 사진을 비율에 맞게 화면 가운데 보여주세요.
2. 모자·안경·리본·수염 같은 부품은 사진 위의 독립된 레이어로 두고, 아이가 드래그로 위치를 맞출 수 있게 하세요.
3. 사진을 바꿔도 부품이 화면 밖으로 나가지 않도록 사진 영역 안으로 이동을 제한하세요.`;

// 그림판 규칙은 실패를 직접 막는 핵심만 남긴다. 긴 체크리스트는 100건 재시험에서
// 응답 완결성을 개선하지 못했고, 모델이 필수 기능보다 부가 구현에 집중할 가능성이 있었다.
const PAINT_GUIDE = `

**그림판 안정성 규칙 (반드시 지킬 것)**:
1. 캔버스와 계획서에 필요한 도구만 먼저 완성하고, HTML에 실제로 만든 요소만 찾으세요. 함수 선언 → 캔버스·상태 준비 → 이벤트 연결 순서를 지키세요.
2. 저장을 선택했다면 캔버스의 \`toDataURL('image/png')\`으로 PNG를 만드세요. 격리 미리보기에서는 만든 PNG를 화면에 보여주고, 내려받은 작품 HTML을 브라우저에서 직접 연 경우에는 PNG를 파일로 저장할 수 있게 하세요. 계획서가 클립보드 복사·붙여넣기·메시지 보내기를 요구해도 PNG 결과로 바꾸세요. 저장하지 않기를 골랐다면 저장 버튼과 다운로드를 만들지 마세요. \`navigator.clipboard\`·\`ClipboardItem\`·\`localStorage\`·\`sessionStorage\`·\`btoa\`를 사용하지 마세요.
3. 캔버스 너비와 높이를 1 이상으로 정한 뒤 픽셀을 읽으세요. \`getImageData\`는 너비와 높이가 모두 0보다 클 때만 호출하세요.
4. Canvas의 색 속성과 \`addColorStop\`에는 유효한 색상 리터럴을 넣으세요. \`'var(--색상)'\` 문자열을 직접 넣지 마세요.
5. SVG 아이콘 버튼은 글자를 별도 \`<span class="button-label">\`에 넣고 그 span만 바꾸세요. 버튼 전체의 \`textContent\`를 바꾸지 마세요.`;

const QUIZ_GUIDE = `

**퀴즈 실행 기준**:
- CSS에 \`[hidden] { display: none !important; }\`를 반드시 넣으세요. 정답 안내·다음 버튼·종료 카드는 처음에 숨기고 필요한 단계에서만 \`hidden\`을 해제하세요. 카드의 flex/grid 스타일이 숨김 상태를 덮어쓰면 첫 화면에 종료 결과가 잘못 보입니다.
- 확인은 \`type="button"\`으로 만들고 form의 \`submit\` 이벤트를 사용하지 마세요. \`quiz-confirm\`은 빈 답일 때도 누를 수 있어야 합니다. 문제는 \`quiz-question\`, 입력은 \`quiz-answer\`, 보기 버튼은 \`data-quiz-option\`입니다.
- 선택 즉시 채점하지 마세요. 아래 채점 흐름 하나를 확인 버튼, 직접 입력 Enter, 시간 종료에서 공통으로 사용하세요. \`feedback\`, \`correction\`, \`explanation\`, \`nextButton\`은 각각 \`quiz-feedback\`, \`quiz-correction\`, \`quiz-explanation\`, \`quiz-next\` 요소입니다. \`readAnswer\`는 고른 보기 또는 입력값, \`currentQuestion\`은 현재 문항, \`recordAnswer\`는 점수·선택된 목숨 처리입니다. 필요한 함수와 변수를 같은 스크립트 안에 정의하세요.
\`\`\`
function normalizeQuizAnswer(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}
function submitQuiz(timedOut) {
  if (graded) return;
  const answer = normalizeQuizAnswer(readAnswer());
  feedback.hidden = false;
  if (!timedOut && !answer) {
    feedback.dataset.quizState = 'empty';
    correction.textContent = answerInput ? '답을 먼저 써 주세요.' : '답을 먼저 골라 주세요.';
    explanation.textContent = '';
    nextButton.hidden = true;
    return;
  }
  graded = true;
  clearInterval(timerId);
  const item = currentQuestion();
  const correct = !timedOut && answer === normalizeQuizAnswer(item.answer);
  feedback.dataset.quizState = timedOut ? 'timeout' : correct ? 'correct' : 'incorrect';
  const message = timedOut ? '시간이 다 됐어요.' : correct ? '맞았어요!' : '아쉬워요.';
  correction.textContent = message + ' 정답: ' + item.answer;
  explanation.textContent = item.explanation;
  nextButton.hidden = false;
  recordAnswer(correct);
}
confirmButton.addEventListener('click', () => submitQuiz(false));
answerInput?.addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing || event.repeat) return;
  event.preventDefault();
  submitQuiz(false);
});
\`\`\`
- 시간 종료는 \`submitQuiz(true)\`를 한 번 부릅니다. 다음 버튼을 눌러야 문제·차례가 바뀝니다. 마지막·목숨 소진 때는 정답을 읽은 뒤 ‘결과 보기’로 넘어갑니다. 결과는 \`quiz-finish\`, 다시하기는 \`quiz-restart\`. 다음·다시하기 때 이전 타이머를 지우고 \`graded=false\`와 빈 답으로 시작하세요.
- \`quiz-feedback\`에는 \`aria-live="polite"\`를 붙이세요. 문제마다 정답 하나와 검증 가능한 쉬운 설명 한 문장을 준비하세요. 보기는 중복 금지, 뺄셈은 음수 답 금지, 곱셈은 고른 범위 안의 한 자리 피연산자입니다. 동작 줄이기에서는 깜빡임 대신 강조색을 사용하세요.`;

// 소리 규칙도 반복 재생에서 실제로 필요한 수명주기만 남긴다.
const USER_GESTURE_AUDIO_GUIDE = `

**소리 안정성 규칙 (반드시 지킬 것)**:
1. \`ensureAudio()\` 한 함수 안에서 AudioContext와 masterGain을 함께 만들고 masterGain을 destination에 한 번만 연결한 뒤 성공 여부(boolean)를 반환하세요. 실패하면 false를 반환해 화면 기능은 계속 작동하게 하세요.
2. 소리를 만지는 모든 버튼·건반 함수는 첫 줄에서 \`if (!ensureAudio()) return;\`을 실행하세요. 그 뒤에만 \`currentTime\`·\`gain\`을 읽으세요. 페이지 로드 중에는 오디오 노드의 속성을 읽거나 재생하지 마세요.
3. OscillatorNode와 AudioBufferSourceNode는 재생할 때마다 새로 만들고 \`start()\`·\`stop()\`을 한 번씩만 호출하세요. 효과 연결 여부를 boolean으로 기억하고, 실제로 연결된 경우에만 \`disconnect()\`하세요.
4. 연결은 source → gain → destination처럼 단순하게 하고 시간은 초 단위의 유한한 숫자, exponentialRamp의 목표 gain은 0보다 큰 값을 쓰세요. 외부 오디오·저장소·무한 반복은 사용하지 마세요.`;

// 수족관은 오디오 공통 규칙을 통째로 합치지 않는다. 핵심 화면을 먼저 완성하게 하고
// 이번 시험에서 발생한 잘못된 색상과 정의 누락을 짧게 직접 막는다.
const AQUARIUM_GUIDE = `

**수족관 안정성 규칙 (반드시 지킬 것)**:
1. 생물 그리기·움직임·선택한 클릭 동작을 먼저 완성하고, 낮밤 전환과 소리는 선택에 맞춰 추가하세요. 모든 DOM 요소·함수·클래스는 사용 전에 같은 코드 안에 정의하세요.
2. 캔버스 너비와 높이를 1 이상으로 정한 뒤 그리세요. CanvasGradient·fillStyle·strokeStyle에는 계산하지 않은 유효한 색상 리터럴만 넣고, \`var(--색상)\`·NaN·잘못된 rgba 형식을 넣지 마세요.
3. 소리는 첫 사용자 입력 뒤에 AudioContext를 준비하고 재생마다 새 source를 만드세요. 소리가 실패해도 수족관은 계속 움직여야 합니다.
4. SVG 아이콘 버튼은 글자를 별도 span에 넣고 그 span만 바꾸세요. 버튼 전체의 \`textContent\`를 바꾸지 마세요.
5. 배경과 친구가 보이는 수조 \`#aquarium-stage\`를 제목·조작부와 나눠 정상 문서 흐름에 놓으세요. 넓은 화면에서는 4:3 비율을 사용할 수 있습니다. 360px와 390px에서는 너비를 먼저 맞추고 높이를 따로 정하세요. 모바일의 grid는 \`minmax(0, 1fr)\` 한 열로 놓고 버튼과 글은 줄바꿈하세요. 배경을 잘라 숨기기보다 카드·수조·조작부가 모두 가로 화면 안에 들어오게 하세요. 수조를 감싼 카드와 조작부에 각각 \`stage-card\`, \`control-panel\`을 사용하고 아래 규칙을 CSS 끝에 붙이세요.
\`\`\`css
@media (max-width: 600px) {
  .stage-card, .control-panel, #aquarium-stage {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
  }
  #aquarium-stage {
    width: 100%;
    aspect-ratio: auto;
    min-height: 0;
    height: clamp(280px, 75vw, 340px);
  }
}
\`\`\`
수조의 \`getBoundingClientRect()\`가 양수일 때 그리세요. \`ResizeObserver\`로 크기 변경 시 생물의 종류·수를 유지하고 생물과 남은 먹이의 상대 위치를 새 경계 안으로 보정하세요. Canvas는 실제 CSS 크기에 \`devicePixelRatio\`를 곱해 버퍼를 맞추고 \`ctx.setTransform\`으로 CSS 좌표에서 그리세요. 터치·마우스 좌표는 수조 rect의 left·top을 빼서 계산하고 DPR을 다시 곱하지 마세요. 먹이는 누른 지점의 수조 내부 좌표에 놓이게 하세요.
6. 처음에는 친구를 수조 전역의 다른 구역에 분산하세요. 몸 전체의 반경만큼 경계에서 띄우고 선택한 수와 종류를 유지하세요. 가까우면 같은 좌표계에서 서로 반대 방향으로 부드럽게 비켜가게 하고, 중심이 같으면 서로 다른 방향을 택해 0 나눗셈을 피하세요. 거품·빛·먹이는 회피 충돌체에서 제외하고, 일부 겹칠 수 있는 조밀한 조합은 위치를 무한히 다시 고르지 마세요.
7. 한 개의 애니메이션 루프에서 경과 초 \`dt\`(최대 0.05)를 적용하세요. 거북이의 기본·느린 유영은 초당 수조 너비의 0.8~1.8%를 기준으로 상하좌우에 분산하고, 명시한 속도는 우선하세요. 거북이의 등껍질·머리·발은 같은 팔레트의 선명한 윤곽과 작은 눈으로 구분하세요. 리사이즈나 버튼으로 루프를 중복 시작하지 마세요.
8. 먹이 주기라면 수조의 입력 위치에 먹이를 표시하세요. 거리 제한 없이 닿을 수 있는 가장 가까운 친구 한 마리가 먹이 쪽으로 방향을 바꾸고, 실제로 닿았을 때 먹이를 제거하고 선택한 후속 효과를 적용하세요. 느린 기본 유영과 달리 먹이 쪽으로 갈 때는 닿을 수 있는 부드러운 속도를 쓰세요. 바닥에 있는 게만 고른 수조에서는 먹이가 천천히 바닥에 닿도록 하고 게가 옆으로 다가가게 하세요. 먹이는 친구가 닿을 수 있는 위치에 머물고, 섭취 전에 시간만으로 사라지지 않게 하세요. 여러 친구가 같은 곳에 몰려들게 하지 마세요. 기본 입력 모드가 먹이 주기가 아니면 먹이를 추가하지 마세요.
9. 수조에 실제 렌더 상태와 같은 값으로 \`data-aquarium-mode\`(feed/spawn/flash/ripple/nametag/none), \`data-aquarium-tracks\`(화면에 그린 친구의 {id,x,y} 배열 JSON), \`data-aquarium-food\`(먹이의 {id,x,y} 배열 JSON), \`data-aquarium-eaten\`(누적 섭취 수)을 갱신하세요. x,y는 화면에 표시한 수조의 가로·세로에 대한 중심의 0~1 상대 좌표이며 id는 살아 있는 동안 안정된 고유 값입니다. 빈 배열은 []로 표시하세요. 검사에 쓰는 값은 실제로 친구와 먹이를 그린 위치·제거 처리와 일치해야 합니다.`;

// 룰렛 15건 모바일 재시험에서 원판 테두리·가상요소가 폭을 늘리거나, 음수 top의 포인터와 원판이
// 화면 위로 잘리는 문제가 확인됐다. 디자인은 제한하지 않고 박스 모델과 흐름 배치만 고정한다.
const ROULETTE_GUIDE = `

**룰렛 실행 기준**:
- \`box-sizing: border-box\`를 적용하고 제목→원판→조작→결과→범례를 문서 흐름에 배치하세요. 바깥 폭은 \`min(100%, 600px)\`, 모바일 좌우 여백은 최소 16px입니다. 원판을 감싼 요소는 \`width: min(72vw, 42vh, 320px)\`의 정사각형, \`position: relative\`, 위에 최소 32px 여백. 포인터는 12시에 고정하고 가상요소로 추가 원, 타원, 포인터를 만들지 마세요. 390px 화면에서도 잘림이나 가로 스크롤이 없어야 합니다.
- 그리는 순서와 결과 목록의 순서를 하나로 사용하세요. i번째 칸과 번호의 중심은 시계방향으로 \`i * (360 / 개수)\`도입니다. 0번 칸 중심을 12시에 두고 경계는 중심의 양쪽 반 칸씩 그리세요. 예를 들어 conic-gradient는 \`from -(180 / 개수)deg\`에서 시작합니다.
- 아래의 \`wheel\`은 \`roulette-wheel\`, \`result\`는 당첨 문구만 넣는 \`roulette-result\`입니다. 처음 원판의 \`data-spin-count\`는 0. 돌리기와 다시 돌리기는 같은 \`spinTo\`를 사용하고, 회전 중 새 입력·명단 변경을 막으세요.
\`\`\`
let rotation = 0;
let spinning = false;
function spinTo(index, items, durationMs) {
  if (spinning || !items.length || index < 0 || index >= items.length) return;
  spinning = true;
  const center = index * (360 / items.length);
  const advance = ((-center - rotation) % 360 + 360) % 360;
  rotation += 1080 + advance;
  const transform = 'rotate(' + rotation + 'deg)';
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs;
  wheel.style.transition = ms ? 'transform ' + ms + 'ms ease-out' : 'none';
  wheel.style.transform = transform;
  function finishSpin() {
    wheel.style.transition = 'none';
    wheel.style.transform = transform;
    result.textContent = '당첨 결과: ' + items[index];
    wheel.dataset.spinCount = String(Number(wheel.dataset.spinCount) + 1);
    spinning = false;
  }
  if (ms) setTimeout(finishSpin, ms);
  else finishSpin();
}
\`\`\`
- \`durationMs\`는 5초 이내, 결과 형식은 \`당첨 결과: 항목명\`입니다. 축하·확대·흔들림은 원판을 감싼 요소나 범례에서만 실행해 원판의 transform을 덮어쓰지 마세요. 회전음·당첨음은 각각 선택했을 때만 사용하세요.
- 제외나 목록 변경은 회전 전에 원판과 범례를 같은 목록으로 다시 그리세요. 인원 수 모드는 처음부터 그 목록을 1번부터 6번으로 시작하고 인원 변경 시 같은 규칙으로 다시 만드세요. 명단 추가는 \`type="button"\` 클릭 또는 입력칸 Enter에서 같은 함수를 호출하고 form 제출에 의존하지 마세요.`;

// 신규 게임 6종 90회 점검에서, 성공작은 핵심 동작보다 장식을 먼저 늘릴 이유가 없었고
// 블록 쌓기 3건은 빈 보드 상태에서 첫 draw/render를 호출해 같은 런타임 오류가 났다.
// 모든 장르의 긴 알고리즘을 한꺼번에 넣지 않고, 짧은 공통 규칙과 해당 장르 규칙만 붙인다.
const GAME_COMMON_GUIDE = `

**게임 공통 안정성 규칙 (반드시 지킬 것)**:
1. 선택한 핵심 게임 동작을 먼저 완성하고, 선택하지 않은 효과음·파티클·추가 화면·복잡한 SVG 장식은 만들지 마세요.
2. DOM 요소 찾기 → 게임 상태와 배열 초기화 → 첫 화면 그리기 → 입력 연결 → 게임 루프 시작 순서를 지키세요. 화면을 그리는 함수는 필요한 배열과 현재 객체가 모두 준비된 뒤에만 호출하세요.
3. 시작 전 화면도 빈 게임 상태를 오류 없이 그릴 수 있어야 합니다. 게임 루프는 하나만 만들고, 다시 시작할 때 이전 animation frame·interval·timeout을 취소한 뒤 상태를 한 번만 초기화하세요.
4. 핵심 게임과 선택한 기능에 필요한 HTML·CSS·JavaScript만 작성하고, 요청하지 않은 설명 패널·효과음·파티클·대형 SVG 데이터는 생략하세요.`;

const BLOCKSTACK_GAME_GUIDE = `

**블록 쌓기 필수 구현 규칙 (반드시 지킬 것)**:
1. 10×18 보드는 첫 render/draw 호출보다 먼저 \`Array.from({ length: 18 }, () => Array(10).fill(null))\`와 같은 완성된 2차원 배열로 만드세요. \`board = []\` 또는 \`grid = []\` 상태에서 화면을 그리지 마세요.
2. 시작 전 빈 보드를 보여줄 때도 이미 초기화된 보드를 사용하세요. 시작 버튼과 다시하기 버튼은 같은 초기화 함수를 호출하게 하세요.
3. 셀을 읽거나 쓰기 전에 x와 y 범위를 먼저 검사하세요. x < 0, x >= 10, y >= 18이면 충돌이고, y < 0이면 보드 행을 읽지 말고 건너뛰세요.
4. 충돌 확인에서는 경계 검사를 통과한 뒤에만 \`board[y][x]\` 또는 \`grid[y][x]\`를 읽으세요.
5. 줄을 지운 뒤에도 보드는 항상 정확히 18개 행이고 각 행은 10개 칸이어야 합니다.
6. javascript 맨 아래의 첫 실행 순서는 보드 초기화 → 첫 render/draw로 고정하세요.`;

/** 유형 id → 제작 규칙. 없는 유형은 빈 문자열(아무것도 덧붙이지 않음). */
const SURVEY_TYPE_GUIDES: Record<string, string> = {
  quiz: QUIZ_GUIDE,
  maze: MAZE_GUIDE,
  dressup: DRESSUP_GUIDE,
  paint: PAINT_GUIDE,
  aquarium: AQUARIUM_GUIDE,
  roulette: ROULETTE_GUIDE,
};

/** 선택지와 브라우저 핵심 동작 검사가 공유하는 유형별 제작 규칙. */
const CORE_GUIDES: Readonly<Record<string, string>> = {
  paint: `
**그림판 조작 확인**:
- 그림을 그리는 주 캔버스에 id="paint-canvas", 전체 지우기 버튼에 id="paint-clear", PNG를 골랐을 때만 저장 버튼에 id="paint-save", 결과 그림에 id="paint-png"를 붙이세요. Pointer Events 한 세트로 마우스와 터치를 처리하고, 캔버스의 표시 크기와 내부 해상도 비율로 좌표를 환산하세요. touch-action: none은 그리는 영역에만 적용하세요.
- 전체 지우기는 처음 종이·색칠 도안은 유지하고 사용자가 그린 선만 모두 지우세요. 360px와 390px에서도 그림과 지우기 버튼을 모두 쓸 수 있어야 합니다.`,
  game: `
**게임 시작·종료 확인**:
- 게임 영역 id="game-stage"에 실제 상태대로 data-game-state="ready|playing|ended" 중 하나를 표시하세요. 시작은 id="game-start", 종료 안내는 id="game-end", 그 안내에서 다시 시작하는 버튼은 id="game-restart"를 쓰세요.
- 시작·다시하기는 모두 점수, 장애물, 입력 상태를 초기화하고 종료 안내를 숨기세요. 프레임 게임에서는 초기화 도중 기존 requestAnimationFrame을 취소했다면, 초기화와 playing 전환이 끝난 뒤 새 루프 첫 프레임을 반드시 예약하세요. 키보드와 화면 버튼이 실제로 움직임이나 진행을 바꿔야 합니다. 게임 중 시작을 중복 처리하지 마세요. 가위바위보 선택 버튼에는 data-rps-move="rock|paper|scissors"를 붙이세요. 카드 뒤집기·퍼즐 같은 장르도 완료 뒤 다시 처음부터 시작할 수 있어야 합니다.`,
  card: `
**카드 내용과 조작 확인**:
- 첫 화면 id="card-preview" 안에 id="card-message"로 고른 용도에 맞는 읽을 수 있는 문장을 보여주세요. 이름 입력을 골랐으면 카드 안에 id="card-name" 입력, id="card-recipient" 이름 표시를 만들어 타이핑 즉시 반영하세요. 런타임에서 별도 개인정보나 파일 업로드를 요청하지 마세요.
- 자기소개는 학생이 고른 항목만 별도 제목과 내용으로 보여주세요. 예를 들어 좋아하는 것만 골랐다면 꿈 항목을 덧붙이지 마세요. 움직임은 고른 장식에만 주고 본문과 첨부 사진은 고정하세요. 클릭 효과가 없어도 별도로 고른 음악은 사용자의 재생 조작으로만 켜세요.`,
  calc: `
**숫자놀이 계산·학습 확인**:
- 계산기의 [적용 연산]에 나온 버튼과 연산만 제공하세요. 표시되지 않은 연산은 버튼·키보드 처리 모두에서 제외하고, 초기값이나 예시의 다른 연산도 가져오지 마세요. 화면은 id="calc-result", 숫자·연산·결과 버튼에는 data-calc-key(0~9, add, sub, mul, div, pct, equals)를 붙이세요. 퍼센트 버튼은 현재 입력값을 100으로 나눠 표시하세요. LED 모양을 골랐어도 현재 계산값은 #calc-result 안의 id="calc-result-value"에 완전한 숫자 텍스트로 매번 갱신하세요(예: 0.08, 16). 계산값은 스크린 리더가 알 수 있게 aria-live="polite" 안에 두고, 모양만 그리는 LED 도형은 aria-hidden="true"로 묶으세요. 숫자 텍스트를 화면에서 감추려면 1px 클리핑을 사용하세요. hidden, display:none 또는 aria-hidden으로 실제 값까지 감추지 마세요. eval 없이 계산하고 0으로 나누면 이해하기 쉬운 문구를 보여주세요.
- 연습 모드에서는 id="calc-problem", id="calc-entry", id="calc-check", id="calc-feedback"를 문제·답 입력칸·확인 버튼·피드백에 붙이세요. 피드백에는 data-answer-status="idle|incorrect|correct"로 현재 채점 상태를 표시하세요. 문제·정답을 같은 데이터에서 만들고 빈 입력을 채점하지 마세요. 오답 뒤에도 같은 문제에 다시 답할 수 있게 하세요. 숫자 맞히기는 고른 힌트 방식만 적용하고, 소리 끄기를 골랐으면 정답과 오답도 화면으로만 알려주세요.`,
  fortune: `
**메시지 뽑기 결과 확인**:
- id="fortune-draw" 버튼을 누르면 고른 개수(1·3·5개)의 서로 다른 결과를 id="fortune-results" 안에 표시하고, 각 결과에 data-fortune-message를 붙이세요. 여러 개면 실제로 하나를 선택할 수 있게 하세요. 수수께끼는 별도 버튼 data-fortune-answer로 해당 결과에 숨겨 둔 data-fortune-solution을 보여주세요.
- 결과는 애니메이션을 줄인 설정에서도 보여야 합니다. 한 번만 뽑기를 고르면 이후 첫 뽑기 버튼을 숨기거나 비활성화하세요. 크게 보기나 발표는 화면 안에서 동작시키세요. 메시지 이미지 만들기를 학생이 고른 경우에만 id="fortune-image-button"으로 PNG를 만들고 id="fortune-image"에 표시하세요. 현재 화면 확대나 발표를 골랐다면 확대나 발표 조작만 제공하세요. 별도 HTML을 브라우저에서 직접 열면 다운로드도 지원하세요. 시스템 클립보드나 공유 창은 호출하지 마세요.`,
  sound: `
**연주 동작 확인**:
- 실제 소리를 내는 각 건반·패드에 data-sound-pad와 곡에서 쓰는 음 이름 또는 악기 이름을 붙이세요. 사용자가 누를 때마다 공통 Web Audio 경로에서 짧고 낮은 볼륨의 음을 한 번 재생하고, 연속 입력도 빠뜨리지 마세요.
- 360px·390px에서는 건반 영역과 부모의 min-width를 0, 너비 상한을 100%로 하고 가로 스크롤을 만들지 마세요. 13·16건반은 모바일에서 한 줄에 최대 4개씩 필요한 행을 만들거나, 음역 전환으로 나눠서 같은 전체 음을 칠 수 있게 하세요. 한 건반의 실제 클릭 영역은 너비·높이 모두 최소 44px입니다. 예를 들어 모바일 그리드의 grid-template-columns를 repeat(4, minmax(44px, 1fr))로 두면 13·16개를 가로 스크롤 없이 배치할 수 있습니다. 고정 픽셀 최소 폭이나 overflow-x:auto로 넓은 건반을 숨기지 마세요.
- 따라치기 모드는 피아노에서 학생이 따라치기 또는 둘 다를 골랐을 때만 넣으세요. 드럼·실로폰 등 다른 악기나 피아노 자유 연주에는 따라치기 버튼·점수·정답 판정을 넣지 마세요. 따라치기에서는 모드를 켠 순간부터 선택한 곡 이름, 현재 칠 음, 진행을 보여주고 맞는 음을 누를 때만 전진하세요.`,
  dressup: `
**꾸미기 완성 확인**:
- 캐릭터 종류와 사진 원본은 선택한 상태로 유지하세요. 사진인 경우 원본 img에 id="dressup-photo"를 붙이세요. 랜덤과 초기화 버튼은 고른 경우에만 넣으세요. 완성 버튼을 선택한 경우 조작 뒤 id="dressup-result"를 보여주고 현재 부품·색·사진 배치가 유지된 상태에서 완성 카드, 이름 또는 전후 비교를 해당 선택에 맞게 제공하세요.`,
  clock: `
**시계·타이머 진행 확인**:
- id="clock-display"에 지금 시각 또는 남거나 지난 시간을 표시하고 data-clock-seconds에도 같은 시간의 초 단위 값을 넣으세요(현재 시각은 자정부터 지난 초). 타이머·스톱워치에서 시작/재개는 id="clock-start", 별도 멈춤 버튼은 id="clock-pause", 다시는 id="clock-reset"을 쓰세요. 버튼 하나로 시작과 멈춤을 겸하는 선택은 id="clock-start" 하나와 다시 버튼을 쓰세요.
- 시작·재개 시 deadline을 Date.now() + 남은 밀리초로 계산하고, 각 화면 갱신은 max(0, ceil((deadline - Date.now()) / 1000))로 하세요. 콜백마다 1초를 빼는 방식은 탭이 잠시 멈췄을 때 시간을 잃으므로 사용하지 마세요. 타이머는 0에서 멈추고 한 번만 알리세요. 멈춰 있는 동안 시간이 바뀌면 안 되고, 다시는 처음 상태와 시간을 함께 복원하세요. 디지털 시계에 타이머 버튼을 붙이지 마세요.`,
};

function getCoreTypeGuide(programType?: string): string {
  const guide = programType && Object.hasOwn(CORE_GUIDES, programType) ? CORE_GUIDES[programType] : '';
  return guide ? '\n' + guide : '';
}

function requestsAudio(prompt: string): boolean {
  const positiveAudioRequest = /Web Audio|AudioContext|소리가 나|소리를 내|소리를 넣|효과음|멜로디|음악을 넣|연주|악기|건반/i;
  return prompt
    .split(/[.!?\n]/)
    .filter((sentence) => !/소리 없이|조용하게|소리.*넣지 마|음악.*넣지 마|효과음.*넣지 마|멜로디.*넣지 마/.test(sentence))
    .some((sentence) => positiveAudioRequest.test(sentence));
}

function gameGuide(prompt: string): string {
  const blockStack = /10×18 고정 격자|블록 쌓기 게임/.test(prompt);
  return GAME_COMMON_GUIDE + (blockStack ? BLOCKSTACK_GAME_GUIDE : '');
}

export function getTypeGuide(programType?: string, prompt = '', hasPhoto = false): string {
  const designGuide = getDesignPreset(programType);
  const typeGuide = programType === 'dressup' && hasPhoto
    ? PHOTO_DRESSUP_GUIDE
    : programType === 'game'
    ? gameGuide(prompt)
    : (programType && SURVEY_TYPE_GUIDES[programType]) || '';
  const audioGuide = programType === 'sound' || requestsAudio(prompt) ? USER_GESTURE_AUDIO_GUIDE : '';
  return designGuide + typeGuide + getCoreTypeGuide(programType) + audioGuide;
}
