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
    if (a.genre === 'run') return '달리기 게임';
    return '나의 게임';
  },
  steps: [
    // STEP 1 — 장르
    {
      id: 'genre',
      question: '어떤 종류의 게임을 만들까?',
      options: [
        {
          id: 'dodge',
          label: '피하기',
          icon: '💨',
          promptFragment: '위에서 장애물이 떨어지고 주인공을 좌우로 움직여 피하는 게임.',
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
        {
          id: 'run',
          label: '달리기',
          icon: '🏃',
          promptFragment: '주인공이 자동으로 달리고 장애물을 점프해서 피하는 무한 달리기 게임.',
        },
      ],
    },
    // STEP 2 — 모을 것 (genre=collect일 때만) [Chain Level 1]
    {
      id: 'collectitem',
      question: '무엇을 모을까?',
      showIf: (a) => a.genre === 'collect',
      options: [
        {
          id: 'star',
          label: '별',
          icon: '⭐',
          promptFragment: '하늘에서 떨어지는 별을 모아.',
        },
        {
          id: 'fruit',
          label: '과일',
          icon: '🍎',
          promptFragment: '나무에서 떨어지는 과일을 바구니에 담아.',
        },
        {
          id: 'coin',
          label: '금화',
          icon: '🪙',
          promptFragment: '반짝이는 금화를 모아.',
        },
        {
          id: 'candy',
          label: '사탕',
          icon: '🍬',
          promptFragment: '달콤한 사탕을 모아.',
        },
      ],
    },
    // STEP 3 — 별 효과 (collectitem=star일 때만) [Chain Level 2]
    {
      id: 'star_effect',
      question: '별을 잡을 때 어떤 효과가 날까?',
      showIf: (a) => a.collectitem === 'star',
      options: [
        {
          id: 'sparkle',
          label: '반짝반짝',
          icon: '✨',
          promptFragment: '별을 잡을 때 주변에 반짝이 파티클이 퍼지는 효과를 넣어.',
        },
        {
          id: 'explode',
          label: '팡! 터지기',
          icon: '💥',
          promptFragment: '별을 잡을 때 별이 작은 폭발처럼 퍼지며 사라지는 효과를 넣어.',
        },
        {
          id: 'trail',
          label: '빛 꼬리',
          icon: '🌠',
          promptFragment: '별을 잡기 전까지 빛나는 꼬리가 남으며 떨어지는 효과를 넣어.',
        },
      ],
    },
    // STEP 4 — 주인공 (genre=mole 제외)
    {
      id: 'hero',
      showIf: (a) => a.genre !== 'mole',
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
          id: 'frog',
          label: '개구리',
          icon: '🐸',
          promptFragment: '주인공은 귀여운 초록 개구리야.',
        },
        {
          id: 'penguin',
          label: '펭귄',
          icon: '🐧',
          promptFragment: '주인공은 뒤뚱뒤뚱 귀여운 펭귄이야.',
        },
        {
          id: 'robot',
          label: '로봇',
          icon: '🤖',
          promptFragment: '주인공은 작은 로봇이야.',
        },
      ],
    },
    // STEP 5 — 조작 (genre=mole 제외)
    {
      id: 'control',
      showIf: (a) => a.genre !== 'mole',
      question: '어떻게 조작할까?',
      options: [
        {
          id: 'click',
          label: '마우스·터치',
          icon: '👆',
          promptFragment: '마우스를 클릭하거나 화면을 터치한 방향으로 주인공을 이동(또는 점프)시켜.',
        },
        {
          id: 'arrow',
          label: '방향키',
          icon: '⌨️',
          promptFragment: '키보드 방향키로 주인공을 이동(또는 점프)시켜.',
        },
        {
          id: 'both',
          label: '둘 다',
          icon: '🕹️',
          promptFragment: '방향키와 마우스 클릭·터치 모두 사용해 주인공을 이동(또는 점프)시켜.',
        },
        {
          id: 'tilt',
          label: '화면 기울이기',
          icon: '📱',
          promptFragment: '기기를 기울여서(DeviceOrientation API) 주인공을 좌우로 이동시켜.',
        },
      ],
    },
    // STEP 6 — 배경
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
        {
          id: 'city',
          label: '도시',
          icon: '🏙️',
          promptFragment: '배경은 빌딩이 늘어선 밤 도시야.',
        },
      ],
    },
    // STEP 7 — 점수 규칙
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
        {
          id: 'distance',
          label: '멀리 갈수록 점수',
          icon: '📏',
          promptFragment: '이동한 거리가 늘어날수록 점수가 올라가.',
        },
      ],
    },
    // STEP 8 — 속도
    {
      id: 'speed',
      question: '게임 속도는?',
      options: [
        {
          id: 'fixed',
          label: '처음부터 끝까지 같아요',
          icon: '🚗',
          promptFragment: '게임 속도는 처음부터 끝까지 일정하게 유지해.',
        },
        {
          id: 'fast',
          label: '점점 빨라져요',
          icon: '🚀',
          promptFragment: '점수가 쌓일수록 아이템·장애물이 점점 빠르게 떨어지게 해.',
        },
      ],
    },
    // STEP 9 — 빨라지는 정도 (speed=fast일 때만) [Conditional]
    {
      id: 'speedup',
      question: '얼마나 빨라질까?',
      showIf: (a) => a.speed === 'fast',
      options: [
        {
          id: 'gentle',
          label: '살살 빨라져요',
          icon: '🐌',
          promptFragment: '속도가 아주 조금씩 서서히 빨라지게 해.',
        },
        {
          id: 'moderate',
          label: '적당히 빨라져요',
          icon: '🐇',
          promptFragment: '속도가 적당히 빨라지게 해.',
        },
        {
          id: 'sudden',
          label: '갑자기 확 빨라져요',
          icon: '⚡',
          promptFragment: '특정 점수마다 속도가 확 빠르게 껑충 올라가게 해.',
        },
      ],
    },
    // STEP 10 — 파워업 (multi)
    {
      id: 'powerup',
      question: '파워업 아이템도 넣을까? (여러 개 골라도 돼)',
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
          id: 'slow',
          label: '느리게 버튼',
          icon: '🐢',
          promptFragment: '느리게 아이템을 잡으면 5초 동안 모든 것이 슬로모션으로 느려져.',
        },
        {
          id: 'none',
          label: '없어도 돼',
          icon: '🚫',
          promptFragment: '',
        },
      ],
    },
    // STEP 11 — 파워업 효과 강도 (powerup에 none이 없을 때) [Conditional]
    {
      id: 'powerup_effect',
      question: '파워업을 잡을 때 어떤 효과를 줄까?',
      showIf: (a) => {
        const p = a.powerup;
        if (Array.isArray(p)) return p.length > 0 && !p.includes('none');
        return false;
      },
      options: [
        {
          id: 'flash',
          label: '화면 번쩍',
          icon: '💥',
          promptFragment: '파워업을 잡으면 화면이 잠깐 밝게 번쩍이며 효과가 발동해.',
        },
        {
          id: 'sound',
          label: '신나는 소리',
          icon: '🎵',
          promptFragment: '파워업을 잡으면 신나는 효과음이 울리며 발동해.',
        },
        {
          id: 'both',
          label: '번쩍 + 소리',
          icon: '✨',
          promptFragment: '파워업을 잡으면 화면이 번쩍이고 효과음도 함께 울려.',
        },
      ],
    },
    // STEP 12 — 게임 오버
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
          id: 'praise',
          label: '점수 + 칭찬 메시지',
          icon: '🎉',
          promptFragment: '게임 오버 화면에 점수에 따라 다른 칭찬 메시지와 다시하기 버튼을 보여줘.',
        },
        {
          id: 'replay',
          label: '짧은 리플레이',
          icon: '🔁',
          promptFragment: '게임 오버 화면에 마지막 5초 동안의 플레이를 빠르게 되감아 보여줘.',
        },
      ],
    },
  ],
};
