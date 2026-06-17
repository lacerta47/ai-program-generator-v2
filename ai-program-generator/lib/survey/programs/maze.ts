import type { ProgramType } from '../types';

export const maze: ProgramType = {
  id: 'maze',
  label: '미로 찾기',
  icon: '🌀',
  basePrompt:
    '방향키나 화면 버튼으로 캐릭터를 움직여 출구로 나가는 실제로 작동하는 미로 게임 웹 프로그램을 만들어줘. ' +
    '미로는 코드로 자동 생성하고, 시작하면 바로 플레이할 수 있는 완성형으로 만들어. ' +
    '화면 버튼(↑↓←→)도 반드시 표시해서 마우스나 터치로도 조작할 수 있게 해.',
  buildName: () => '나의 미로',
  steps: [
    // STEP 1 — 테마
    {
      id: 'theme',
      question: '미로 테마는?',
      options: [
        {
          id: 'classic',
          label: '클래식 미로',
          icon: '🧱',
          promptFragment: '회색 벽돌 느낌의 클래식한 미로.',
        },
        {
          id: 'jungle',
          label: '정글 미로',
          icon: '🌴',
          promptFragment: '빽빽한 정글 속 나무와 덩굴로 이루어진 초록 정글 미로.',
        },
        {
          id: 'forest',
          label: '숲 미로',
          icon: '🌲',
          promptFragment: '나무와 풀로 이루어진 초록 숲 미로.',
        },
        {
          id: 'space',
          label: '우주 미로',
          icon: '🚀',
          promptFragment: '어두운 우주 배경에 빛나는 벽으로 만든 우주 미로.',
        },
        {
          id: 'candy',
          label: '사탕 미로',
          icon: '🍬',
          promptFragment: '알록달록 사탕과 과자로 꾸며진 귀여운 미로.',
        },
        {
          id: 'dungeon',
          label: '던전 미로',
          icon: '🏰',
          promptFragment: '어두운 돌벽으로 이루어진 신비로운 던전 미로.',
        },
        {
          id: 'ice',
          label: '얼음 미로',
          icon: '❄️',
          promptFragment: '투명한 얼음벽과 눈으로 꾸며진 겨울 왕국 미로.',
        },
      ],
    },
    // STEP 2 — 크기
    {
      id: 'size',
      question: '미로 크기는?',
      options: [
        {
          id: 'small',
          label: '작게(쉬워요)',
          icon: '🐣',
          promptFragment: '미로를 10×10 칸 정도의 작고 쉬운 크기로 만들어.',
        },
        {
          id: 'medium',
          label: '보통',
          icon: '🐥',
          promptFragment: '미로를 15×15 칸 정도의 적당한 크기로 만들어.',
        },
        {
          id: 'large',
          label: '크게(어려워요)',
          icon: '🦉',
          promptFragment: '미로를 20×20 칸 정도의 크고 어려운 크기로 만들어.',
        },
        {
          id: 'huge',
          label: '아주 크게!',
          icon: '🦣',
          promptFragment: '미로를 30×30 칸 정도의 아주 크고 복잡한 크기로 만들어.',
        },
      ],
    },
    // STEP 3 — 미니맵 여부 (size=large 또는 huge일 때만) [Conditional]
    {
      id: 'minimap',
      question: '미로 구석에 작은 지도(미니맵)를 보여줄까?',
      showIf: (a) => a.size === 'large' || a.size === 'huge',
      options: [
        {
          id: 'yes',
          label: '응, 보여줘',
          icon: '🗺️',
          promptFragment: '화면 구석에 미로 전체를 작게 보여주는 미니맵을 넣어. 현재 위치도 표시해.',
        },
        {
          id: 'no',
          label: '아니, 직접 찾을게',
          icon: '🙈',
          promptFragment: '',
        },
      ],
    },
    // STEP 4 — 조작
    {
      id: 'control',
      question: '어떻게 조작할까?',
      options: [
        {
          id: 'arrow',
          label: '방향키',
          icon: '⌨️',
          promptFragment: '키보드 방향키(←↑→↓)로 캐릭터를 이동시켜.',
        },
        {
          id: 'button',
          label: '화면 버튼',
          icon: '🕹️',
          promptFragment: '화면 아래 방향 버튼(↑↓←→)을 눌러 캐릭터를 이동시켜.',
        },
        {
          id: 'both',
          label: '방향키 + 화면 버튼',
          icon: '🎮',
          promptFragment: '키보드 방향키와 화면 방향 버튼 두 가지 모두로 조작할 수 있게 해.',
        },
        {
          id: 'swipe',
          label: '손가락 스와이프',
          icon: '👆',
          promptFragment: '손가락으로 스와이프하거나 화면의 방향 버튼으로도 움직일 수 있게 해.',
        },
      ],
    },
    // STEP 5 — 주인공
    {
      id: 'hero',
      question: '미로를 탐험할 주인공은?',
      options: [
        {
          id: 'rabbit',
          label: '토끼',
          icon: '🐰',
          promptFragment: '주인공은 귀여운 토끼야.',
        },
        {
          id: 'explorer',
          label: '탐험가',
          icon: '🧑‍🚀',
          promptFragment: '주인공은 용감한 탐험가야.',
        },
        {
          id: 'robot',
          label: '로봇',
          icon: '🤖',
          promptFragment: '주인공은 작은 로봇이야.',
        },
        {
          id: 'cat',
          label: '고양이',
          icon: '🐱',
          promptFragment: '주인공은 날렵한 고양이야.',
        },
        {
          id: 'dino',
          label: '공룡',
          icon: '🦕',
          promptFragment: '주인공은 귀여운 공룡이야.',
        },
        {
          id: 'unicorn',
          label: '유니콘',
          icon: '🦄',
          promptFragment: '주인공은 반짝이는 유니콘이야.',
        },
      ],
    },
    // STEP 6 — 목표
    {
      id: 'goal',
      question: '미로의 목표는?',
      options: [
        {
          id: 'exit',
          label: '출구 찾기',
          icon: '🚪',
          promptFragment: '미로 끝에 있는 출구 문을 찾아 나가면 클리어.',
        },
        {
          id: 'treasure',
          label: '보물 찾기',
          icon: '💎',
          promptFragment: '미로 안 특정 위치에 있는 보물을 먼저 집은 다음 출구로 나가면 클리어.',
        },
        {
          id: 'star',
          label: '별 모두 모으기',
          icon: '⭐',
          promptFragment: '미로 곳곳에 흩어진 별을 전부 모은 다음 출구로 나가면 클리어.',
        },
        {
          id: 'key',
          label: '열쇠 찾고 문 열기',
          icon: '🗝️',
          promptFragment: '미로 중간에 숨겨진 열쇠를 먼저 찾고, 그 다음 잠긴 문을 열어 탈출하면 클리어.',
        },
      ],
    },
    // STEP 7 — 보물 개수 (goal=treasure일 때만) [Chain Level 1]
    {
      id: 'treasure_count',
      question: '보물이 몇 개 있을까?',
      showIf: (a) => a.goal === 'treasure',
      options: [
        {
          id: '1',
          label: '보물 1개',
          icon: '1️⃣',
          promptFragment: '미로 안에 보물이 딱 1개 있어. 그걸 먹고 출구로 가면 클리어.',
        },
        {
          id: '3',
          label: '보물 3개',
          icon: '3️⃣',
          promptFragment: '미로 안에 보물이 3개 흩어져 있어. 모두 집고 출구로 가면 클리어.',
        },
        {
          id: '5',
          label: '보물 5개',
          icon: '5️⃣',
          promptFragment: '미로 안에 보물이 5개 흩어져 있어. 모두 집고 출구로 가면 클리어.',
        },
      ],
    },
    // STEP 8 — 보물 힌트 (treasure_count가 3 또는 5일 때) [Chain Level 2]
    {
      id: 'treasure_hint',
      question: '보물이 어디 있는지 힌트를 줄까?',
      showIf: (a) => a.treasure_count === '3' || a.treasure_count === '5',
      options: [
        {
          id: 'glow',
          label: '가까울수록 화살표가 커져요',
          icon: '✨',
          promptFragment: '보물에 가까울수록 화면에 표시되는 방향 화살표가 커지고 밝아지는 힌트를 줘.',
        },
        {
          id: 'arrow',
          label: '작은 화살표',
          icon: '🧭',
          promptFragment: '주인공 옆에 가장 가까운 보물 방향을 가리키는 작은 화살표를 보여줘.',
        },
        {
          id: 'none',
          label: '힌트 없이 직접 찾아요',
          icon: '🔍',
          promptFragment: '',
        },
      ],
    },
    // STEP 9 — 보물 종류 (goal=treasure일 때만) [Conditional]
    {
      id: 'treasure_type',
      question: '어떤 보물을 찾을까?',
      showIf: (a) => a.goal === 'treasure',
      options: [
        {
          id: 'gem',
          label: '보석',
          icon: '💎',
          promptFragment: '찾아야 할 보물은 반짝이는 보석이야.',
        },
        {
          id: 'pizza',
          label: '피자',
          icon: '🍕',
          promptFragment: '찾아야 할 보물은 맛있어 보이는 피자야.',
        },
        {
          id: 'dino_egg',
          label: '공룡알',
          icon: '🥚',
          promptFragment: '찾아야 할 보물은 신비로운 공룡알이야.',
        },
        {
          id: 'star',
          label: '별',
          icon: '⭐',
          promptFragment: '찾아야 할 보물은 빛나는 별이야.',
        },
      ],
    },
    // STEP 10 — 함정 (multi)
    {
      id: 'trap',
      question: '함정을 넣을까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'hole',
          label: '구덩이',
          icon: '🕳️',
          promptFragment: '미로 안에 구덩이 함정을 넣어. 빠지면 처음부터 다시 시작해.',
        },
        {
          id: 'ice',
          label: '미끄러운 얼음',
          icon: '🧊',
          promptFragment: '미로 일부 구간이 얼음이어서 이동하면 한 칸 더 미끄러져.',
        },
        {
          id: 'ghost',
          label: '귀신',
          icon: '👻',
          promptFragment: '귀신이 미로를 돌아다녀. 닿으면 처음부터 다시 시작해.',
        },
        {
          id: 'arrow_trap',
          label: '화살 함정',
          icon: '🏹',
          promptFragment: '미로 벽에서 화살이 가끔 날아와. 맞으면 출발점으로 돌아가.',
        },
        {
          id: 'none',
          label: '없어도 돼',
          icon: '✅',
          promptFragment: '',
        },
      ],
    },
    // STEP 10 — 함정 종류 추가 세부 (trap에 none이 없을 때) [Conditional]
    {
      id: 'trap_hint',
      question: '함정이 어디 있는지 미리 알려줄까?',
      showIf: (a) => {
        const t = a.trap;
        if (Array.isArray(t)) return t.length > 0 && !t.includes('none');
        return false;
      },
      options: [
        {
          id: 'visible',
          label: '응, 보여줘',
          icon: '👀',
          promptFragment: '함정 위치를 처음부터 잘 보이게 표시해줘.',
        },
        {
          id: 'hidden',
          label: '아니, 숨겨줘',
          icon: '🙈',
          promptFragment: '함정을 미로 바닥에 숨겨서 가까이 가야만 보이게 해.',
        },
        {
          id: 'blink',
          label: '깜빡깜빡 힌트',
          icon: '💫',
          promptFragment: '함정 위치가 가끔 살짝 깜빡이며 힌트를 줘.',
        },
      ],
    },
    // STEP 11 — 시간 제한
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        {
          id: 'yes60',
          label: '짧게(60초)⏱️',
          icon: '⏱️',
          promptFragment: '60초 안에 클리어해야 하는 시간 제한을 넣어. 시간이 다 되면 게임 오버.',
        },
        {
          id: 'yes120',
          label: '보통(2분)⏰',
          icon: '⏰',
          promptFragment: '120초 안에 클리어해야 하는 시간 제한을 넣어. 시간이 다 되면 게임 오버.',
        },
        {
          id: 'yes180',
          label: '여유롭게(3분)🕰️',
          icon: '🕰️',
          promptFragment: '180초 안에 클리어해야 하는 시간 제한을 넣어. 시간이 다 되면 게임 오버.',
        },
        {
          id: 'no',
          label: '아니, 여유롭게',
          icon: '🐢',
          promptFragment: '시간 제한 없이 천천히 탐험할 수 있게 해.',
        },
      ],
    },
    // STEP 12 — 성공 효과
    {
      id: 'success',
      question: '클리어하면 어떤 효과를 줄까?',
      options: [
        {
          id: 'confetti',
          label: '색종이 폭죽',
          icon: '🎊',
          promptFragment: '클리어하면 화면에 색종이 폭죽 효과와 축하 메시지를 보여줘.',
        },
        {
          id: 'sound',
          label: '승리 멜로디',
          icon: '🎶',
          promptFragment: '클리어하면 Web Audio로 신나는 승리 멜로디를 재생하고 축하 화면을 보여줘.',
        },
        {
          id: 'trophy',
          label: '트로피 + 걸린 시간',
          icon: '🏆',
          promptFragment: '클리어하면 트로피와 함께 걸린 시간(초)을 보여주고 다시하기 버튼을 표시해.',
        },
        {
          id: 'all',
          label: '다 같이!',
          icon: '✨',
          promptFragment: '클리어하면 색종이 폭죽·승리 멜로디·걸린 시간 트로피를 모두 보여줘.',
        },
        {
          id: 'newmaze',
          label: '새 미로 또 만들기',
          icon: '🔄',
          promptFragment: '클리어 화면에 새 미로를 자동으로 다시 생성하는 "새 미로 도전!" 버튼을 넣어.',
        },
      ],
    },
  ],
};
