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
8. 미로는 화면에 다 보이게 그리세요(칸 크기 = 화면 폭 ÷ 칸 수). 미니맵을 넣더라도 본 미로가 우선입니다.
9. 생성된 2차원 배열은 \`maze\` 변수에 보관하고 초기화 순서를 고정하세요: DOM 요소 찾기 → 상태 초기화 → \`maze = generateMaze(...)\` → 보물·출구 배치 → 본 미로 렌더링 → 플레이어 표시 → 입력 활성화 → 타이머 시작. 이 순서가 끝나기 전에는 이동 함수를 실행하지 마세요.
10. \`gameReady\` 같은 boolean을 두고, 이동 함수 첫 줄에서 준비되지 않았으면 즉시 return 하세요. \`maze[nextY]\`가 있고 \`maze[nextY][nextX]\`가 정의되어 있는지 확인한 뒤 벽을 검사하세요.
11. 좌표는 어디서나 \`maze[y][x]\`로만 읽고, DOM 칸에도 \`data-x\`와 \`data-y\`를 같은 뜻으로 넣으세요. x와 y의 순서를 섞지 마세요.
12. 본 미로의 시작·이동·출구 도착·다시 시작이 완성된 뒤에만 미니맵·효과음·움직이는 적을 추가하세요. \`updateMiniMap\` 같은 부가 함수를 부르려면 반드시 같은 javascript 안에 먼저 정의하고, 완성할 수 없으면 그 기능을 빼세요.`;

// 꾸미기: 부품 종류가 바뀔 때 위치·비율이 흐트러지는 문제(실측: 현행 프롬프트 10건 중 3건 실패·비율 불일치).
// 그리는 방식(SVG·canvas·CSS)은 강제하지 않고 **좌표만** 고정한다 — 2026-09-10 방식 비교 후 현행 유지 결정.
const DRESSUP_GUIDE = `

**꾸미기 부품 배치 규칙 (반드시 지킬 것)**:
1. 캐릭터는 가로세로 400×400 좌표계 안에 그리고(그리는 방식은 자유), 화면 가운데에 크게(최소 폭 320px) 보이게 하세요.
2. 부품 자리의 기준점(중심)을 고정하세요: 바탕(얼굴·몸통) 중심 (200, 220) 반지름 약 130 / 왼눈 (150, 190) / 오른눈 (250, 190) / 코 (200, 225) / 입 (200, 275) / 머리 장식(모자·왕관·리본·뿔·꽃) 기준점 (200, 95) / 볼터치 (120, 240)·(280, 240) / 안경 (200, 190) / 목도리·배지 (200, 345).
3. 부품 종류(동그란 눈·별 눈·하트 눈 등)가 바뀌어도 **반드시 같은 기준점에, 비슷한 크기로** 그리세요. 부품마다 자리를 따로 정하거나 크기를 제각각으로 하면 얼굴이 어긋납니다.
4. 부품 자리마다 하나의 그룹(요소)을 두고, 바꿀 때는 그 그룹의 내용만 교체하세요. 부품 종류마다 그리는 함수를 하나씩 두면(예: eyesRound, eyesStar) 바꾸기가 쉽습니다.
5. 모든 부품은 같은 선 굵기·같은 윤곽선 색·같은 팔레트(바탕색 1, 중간색 2, 강조색 1, 하이라이트 1)로 그려 한 캐릭터처럼 보이게 하세요.`;

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
2. 저장은 캔버스의 \`toDataURL('image/png')\`을 이용한 PNG 다운로드 버튼 하나로 만드세요. 계획서가 클립보드 복사·붙여넣기·메시지 보내기를 요구해도 미리보기에서는 지원하지 않으므로 모두 PNG 다운로드로 바꾸세요. \`navigator.clipboard\`·\`ClipboardItem\`·\`localStorage\`·\`sessionStorage\`·\`btoa\`를 사용하지 마세요.
3. 캔버스 너비와 높이를 1 이상으로 정한 뒤 픽셀을 읽으세요. \`getImageData\`는 너비와 높이가 모두 0보다 클 때만 호출하세요.
4. Canvas의 색 속성과 \`addColorStop\`에는 유효한 색상 리터럴을 넣으세요. \`'var(--색상)'\` 문자열을 직접 넣지 마세요.
5. SVG 아이콘 버튼은 글자를 별도 \`<span class="button-label">\`에 넣고 그 span만 바꾸세요. 버튼 전체의 \`textContent\`를 바꾸지 마세요.`;

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
1. 생물 그리기·움직임·클릭·낮밤 전환을 먼저 완성하고, 소리는 마지막 선택 기능으로 추가하세요. 모든 DOM 요소·함수·클래스는 사용 전에 같은 코드 안에 정의하세요.
2. 캔버스 너비와 높이를 1 이상으로 정한 뒤 그리세요. CanvasGradient·fillStyle·strokeStyle에는 계산하지 않은 유효한 색상 리터럴만 넣고, \`var(--색상)\`·NaN·잘못된 rgba 형식을 넣지 마세요.
3. 소리는 첫 사용자 입력 뒤에 AudioContext를 준비하고 재생마다 새 source를 만드세요. 소리가 실패해도 수족관은 계속 움직여야 합니다.
4. SVG 아이콘 버튼은 글자를 별도 span에 넣고 그 span만 바꾸세요. 버튼 전체의 \`textContent\`를 바꾸지 마세요.`;

/** 유형 id → 제작 규칙. 없는 유형은 빈 문자열(아무것도 덧붙이지 않음). */
const SURVEY_TYPE_GUIDES: Record<string, string> = {
  maze: MAZE_GUIDE,
  dressup: DRESSUP_GUIDE,
  paint: PAINT_GUIDE,
  aquarium: AQUARIUM_GUIDE,
};

function requestsAudio(prompt: string): boolean {
  const positiveAudioRequest = /Web Audio|AudioContext|소리가 나|소리를 내|소리를 넣|효과음|멜로디|음악을 넣|연주|악기|건반/i;
  return prompt
    .split(/[.!?\n]/)
    .filter((sentence) => !/소리 없이|조용하게|소리.*넣지 마|음악.*넣지 마|효과음.*넣지 마|멜로디.*넣지 마/.test(sentence))
    .some((sentence) => positiveAudioRequest.test(sentence));
}

export function getTypeGuide(programType?: string, prompt = '', hasPhoto = false): string {
  const typeGuide = programType === 'dressup' && hasPhoto
    ? PHOTO_DRESSUP_GUIDE
    : (programType && SURVEY_TYPE_GUIDES[programType]) || '';
  const audioGuide = programType === 'sound' || requestsAudio(prompt) ? USER_GESTURE_AUDIO_GUIDE : '';
  return typeGuide + audioGuide;
}
