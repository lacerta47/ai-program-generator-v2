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
      ],
    },
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
      ],
    },
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
      ],
    },
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
      ],
    },
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
      ],
    },
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
          id: 'none',
          label: '없어도 돼',
          icon: '✅',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        {
          id: 'yes_60',
          label: '응, 60초',
          icon: '⏱️',
          promptFragment: '60초 안에 클리어해야 하는 시간 제한을 넣어. 시간이 다 되면 게임 오버.',
        },
        {
          id: 'yes_120',
          label: '응, 2분',
          icon: '⏰',
          promptFragment: '120초 안에 클리어해야 하는 시간 제한을 넣어. 시간이 다 되면 게임 오버.',
        },
        {
          id: 'no',
          label: '아니, 여유롭게',
          icon: '🐢',
          promptFragment: '시간 제한 없이 천천히 탐험할 수 있게 해.',
        },
      ],
    },
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
      ],
    },
  ],
};
