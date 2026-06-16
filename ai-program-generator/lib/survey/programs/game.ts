import type { ProgramType } from '../types';

export const game: ProgramType = {
  id: 'game',
  label: '게임',
  icon: '🎮',
  basePrompt:
    '실제로 플레이되는 완성형 캐주얼 게임 웹 프로그램을 만들어줘. ' +
    '시작 화면에서 시작 버튼을 누르면 바로 게임이 시작되고, 점수가 표시되며, 게임 오버 화면에서 다시하기를 할 수 있어야 해. ' +
    '모든 게임 로직은 완전히 작동하게 만들어.',
  buildName: (a) => {
    if (a.genre === 'dodge') return '피하기 게임';
    if (a.genre === 'collect') return '모으기 게임';
    if (a.genre === 'mole') return '두더지 잡기';
    return '나의 게임';
  },
  steps: [
    {
      id: 'genre',
      question: '어떤 종류의 게임을 만들까?',
      options: [
        {
          id: 'dodge',
          label: '피하기',
          icon: '💨',
          promptFragment: '위에서 아이템이 떨어지고 주인공을 좌우로 움직여 피하는 게임.',
        },
        {
          id: 'collect',
          label: '모으기',
          icon: '⭐',
          promptFragment: '위에서 아이템이 떨어지고 주인공을 움직여 아이템을 모으는 게임.',
        },
        {
          id: 'mole',
          label: '두더지 잡기',
          icon: '🐹',
          promptFragment: '격자 구멍에서 두더지가 랜덤하게 나타나면 클릭해서 잡는 게임.',
        },
      ],
    },
    {
      id: 'hero',
      showIf: (a) => a.genre !== 'mole', // 두더지 잡기는 움직이는 주인공이 없음
      question: '주인공 모습은?',
      options: [
        {
          id: 'cat',
          label: '고양이',
          icon: '🐱',
          promptFragment: '주인공은 귀여운 고양이 캐릭터야.',
        },
        {
          id: 'rocket',
          label: '로켓',
          icon: '🚀',
          promptFragment: '주인공은 작은 로켓이야.',
        },
        {
          id: 'star',
          label: '별',
          icon: '⭐',
          promptFragment: '주인공은 반짝이는 별 모양이야.',
        },
        {
          id: 'frog',
          label: '개구리',
          icon: '🐸',
          promptFragment: '주인공은 귀여운 초록 개구리야.',
        },
      ],
    },
    {
      id: 'control',
      showIf: (a) => a.genre !== 'mole', // 두더지 잡기는 클릭만 — 이동 조작 불필요
      question: '어떻게 조작할까?',
      options: [
        {
          id: 'click',
          label: '마우스 클릭·터치',
          icon: '👆',
          promptFragment: '주인공을 마우스를 클릭하거나 화면을 터치한 방향으로 이동시켜.',
        },
        {
          id: 'arrow',
          label: '방향키',
          icon: '⌨️',
          promptFragment: '키보드 방향키(←→)로 주인공을 좌우로 이동시켜.',
        },
        {
          id: 'both',
          label: '둘 다',
          icon: '🕹️',
          promptFragment: '방향키와 마우스 클릭·터치 모두 사용해 주인공을 이동시켜.',
        },
      ],
    },
    {
      id: 'background',
      question: '게임 배경은?',
      options: [
        {
          id: 'sky',
          label: '하늘',
          icon: '☁️',
          promptFragment: '배경은 밝고 파란 하늘이야.',
        },
        {
          id: 'space',
          label: '우주',
          icon: '🌌',
          promptFragment: '배경은 별이 가득한 어두운 우주야.',
        },
        {
          id: 'sea',
          label: '바닷속',
          icon: '🌊',
          promptFragment: '배경은 파랗고 맑은 바닷속이야.',
        },
        {
          id: 'forest',
          label: '숲',
          icon: '🌲',
          promptFragment: '배경은 초록 나무가 있는 숲이야.',
        },
      ],
    },
    {
      id: 'scoring',
      question: '점수 규칙은?',
      options: [
        {
          id: 'time',
          label: '오래 버티면 점수',
          icon: '⏱️',
          promptFragment: '살아남은 시간이 길수록 점수가 올라가.',
        },
        {
          id: 'count',
          label: '잡을 때마다 점수',
          icon: '🎯',
          promptFragment: '아이템을 잡거나 두더지를 칠 때마다 점수가 올라가.',
        },
        {
          id: 'combo',
          label: '연속으로 잡으면 보너스',
          icon: '🔥',
          promptFragment: '연속으로 잡을수록 콤보가 쌓이고 점수가 두 배·세 배로 올라가.',
        },
      ],
    },
    {
      id: 'speed',
      question: '게임 속도는?',
      options: [
        {
          id: 'fixed',
          label: '처음부터 끝까지 같은 속도',
          icon: '🚗',
          promptFragment: '게임 속도는 처음부터 끝까지 일정하게 유지해.',
        },
        {
          id: 'fast',
          label: '점점 빨라지게',
          icon: '🚀',
          promptFragment: '점수가 쌓일수록 아이템이 점점 빠르게 떨어지게 해.',
        },
      ],
    },
    {
      id: 'bonus',
      question: '특별 아이템도 넣을까? (여러 개 골라도 돼)',
      showIf: (a) => a.genre === 'collect',
      multi: true,
      options: [
        {
          id: 'shield',
          label: '방패',
          icon: '🛡️',
          promptFragment: '방패 아이템을 잡으면 3초 동안 무적이 돼.',
        },
        {
          id: 'magnet',
          label: '자석',
          icon: '🧲',
          promptFragment: '자석 아이템을 잡으면 5초 동안 주변 아이템이 저절로 빨려 들어와.',
        },
        {
          id: 'bomb',
          label: '폭탄(피해야 해)',
          icon: '💣',
          promptFragment: '폭탄 아이템을 잡으면 점수가 확 줄어드니까 피해야 해.',
        },
        {
          id: 'gold',
          label: '황금 아이템',
          icon: '✨',
          promptFragment: '황금 아이템은 일반 아이템보다 점수가 3배야.',
        },
      ],
    },
    {
      id: 'gameover',
      question: '게임 오버 화면은 어떻게 할까?',
      options: [
        {
          id: 'simple',
          label: '점수만 보여줘',
          icon: '📊',
          promptFragment: '게임 오버 화면에 최종 점수와 다시하기 버튼만 보여줘.',
        },
        {
          id: 'best',
          label: '최고 점수도 기록',
          icon: '🏆',
          promptFragment: '게임 오버 화면에 최종 점수, 역대 최고 점수(localStorage 저장), 다시하기 버튼을 보여줘.',
        },
        {
          id: 'share',
          label: '점수 + 칭찬 메시지',
          icon: '🎉',
          promptFragment: '게임 오버 화면에 점수에 따라 다른 칭찬 메시지와 다시하기 버튼을 보여줘.',
        },
      ],
    },
  ],
};
