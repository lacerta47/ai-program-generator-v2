import type { ProgramType } from '../types';

export const quiz: ProgramType = {
  id: 'quiz',
  label: '퀴즈',
  icon: '❓',
  basePrompt:
    '문제를 하나씩 보여주고 보기 중에 답을 고르면 맞았는지 알려주는 퀴즈 게임 웹 프로그램을 만들어줘. ' +
    '점수를 세고 마지막에 결과를 보여줘. 문제는 예시로 충분히 채워 넣어. ' +
    '켜자마자 바로 시작할 수 있는 완성형으로 만들어.',
  buildName: (a) => (typeof a.topic === 'string' ? `${a.topic} 퀴즈` : '나의 퀴즈'),
  steps: [
    {
      id: 'topic',
      question: '무엇에 대한 퀴즈일까?',
      options: [
        {
          id: '동물',
          label: '동물',
          icon: '🐶',
          promptFragment: '동물 이름·울음소리·사는 곳에 대한 쉬운 퀴즈 문제로 채워줘.',
        },
        {
          id: '음식',
          label: '음식',
          icon: '🍎',
          promptFragment: '음식 이름·재료·나라에 대한 쉬운 퀴즈 문제로 채워줘.',
        },
        {
          id: '숫자',
          label: '숫자·더하기',
          icon: '➕',
          promptFragment: '한 자리 수 더하기·빼기 같은 쉬운 수학 퀴즈로 채워줘.',
        },
        {
          id: '우주',
          label: '우주·별',
          icon: '🚀',
          promptFragment: '행성·달·별자리에 대한 쉬운 우주 퀴즈로 채워줘.',
        },
        {
          id: '이것저것',
          label: '이것저것',
          icon: '🎲',
          promptFragment: '동물·음식·생활 상식이 섞인 쉬운 상식 퀴즈로 채워줘.',
        },
      ],
    },
    {
      id: 'count',
      question: '문제는 몇 개 풀까?',
      options: [
        {
          id: '3',
          label: '3개',
          icon: '3️⃣',
          promptFragment: '퀴즈 문제를 딱 3개 준비해.',
        },
        {
          id: '5',
          label: '5개',
          icon: '5️⃣',
          promptFragment: '퀴즈 문제를 5개 준비해.',
        },
        {
          id: '10',
          label: '10개',
          icon: '🔟',
          promptFragment: '퀴즈 문제를 10개 준비해.',
        },
      ],
    },
    {
      id: 'answer',
      question: '답은 어떻게 고를까?',
      options: [
        {
          id: 'ox',
          label: 'O / X',
          icon: '⭕',
          promptFragment: '각 문제는 O와 X 두 개 버튼으로 답해.',
        },
        {
          id: 'choice',
          label: '보기 중 고르기',
          icon: '🔢',
          promptFragment: '각 문제는 보기 4개 버튼 중 하나를 골라 답해.',
        },
        {
          id: 'type',
          label: '직접 입력',
          icon: '⌨️',
          promptFragment: '각 문제는 답을 직접 입력하고 확인 버튼을 눌러 제출해.',
        },
      ],
    },
    {
      id: 'feedback',
      question: '정답이면 어떤 반응을 줄까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'sound',
          label: '소리',
          icon: '🔊',
          promptFragment: '정답이면 기분 좋은 소리를, 오답이면 부드러운 소리를 Web Audio로 내줘.',
        },
        {
          id: 'emoji',
          label: '큰 이모지',
          icon: '🎉',
          promptFragment: '정답이면 화면 가득 큰 이모지가 잠깐 뜨는 효과를 넣어.',
        },
        {
          id: 'confetti',
          label: '색종이 폭죽',
          icon: '🎊',
          promptFragment: '정답이면 색종이 조각이 쏟아지는 폭죽 효과를 넣어.',
        },
        {
          id: 'flash',
          label: '화면 번쩍',
          icon: '✨',
          promptFragment: '정답이면 화면이 잠깐 밝게 번쩍이게 해.',
        },
      ],
    },
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        {
          id: '10s',
          label: '응, 10초',
          icon: '⏱️',
          promptFragment: '각 문제에 10초 제한과 줄어드는 시간 막대를 넣어.',
        },
        {
          id: '20s',
          label: '응, 20초',
          icon: '⏰',
          promptFragment: '각 문제에 20초 제한과 줄어드는 시간 막대를 넣어.',
        },
        {
          id: 'no',
          label: '아니, 천천히',
          icon: '🐢',
          promptFragment: '시간 제한 없이 천천히 풀 수 있게 해.',
        },
      ],
    },
    {
      id: 'hard',
      question: '문제를 뒤로 갈수록 어렵게 할까?',
      showIf: (a) => a.topic === '숫자',
      options: [
        {
          id: 'yes',
          label: '응, 점점 크게',
          icon: '📈',
          promptFragment: '뒤로 갈수록 숫자가 커지고 계산이 조금씩 어려워지게 난이도를 올려줘.',
        },
        {
          id: 'no',
          label: '아니, 비슷하게',
          icon: '➖',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'end',
      question: '다 풀면 무엇을 보여줄까?',
      options: [
        {
          id: 'score',
          label: '점수와 칭찬',
          icon: '🏆',
          promptFragment: '마지막에 맞힌 점수와 칭찬 메시지, 다시하기 버튼을 보여줘.',
        },
        {
          id: 'medal',
          label: '금·은·동 메달',
          icon: '🥇',
          promptFragment: '마지막에 점수에 따라 금·은·동 메달 이미지와 메시지, 다시하기 버튼을 보여줘.',
        },
        {
          id: 'star',
          label: '별 모으기',
          icon: '⭐',
          promptFragment: '맞힐 때마다 별을 하나씩 모아서 마지막에 모은 별 개수를 크게 보여줘.',
        },
      ],
    },
    {
      id: 'color',
      question: '퀴즈 화면 색은 어떻게 할까?',
      options: [
        {
          id: 'blue',
          label: '파랑',
          icon: '💙',
          promptFragment: '퀴즈 화면의 전체 분위기를 밝은 파란색 계열로 꾸며줘.',
        },
        {
          id: 'green',
          label: '초록',
          icon: '💚',
          promptFragment: '퀴즈 화면의 전체 분위기를 상쾌한 초록색 계열로 꾸며줘.',
        },
        {
          id: 'purple',
          label: '보라',
          icon: '💜',
          promptFragment: '퀴즈 화면의 전체 분위기를 신비로운 보라색 계열로 꾸며줘.',
        },
        {
          id: 'rainbow',
          label: '알록달록',
          icon: '🌈',
          promptFragment: '퀴즈 화면을 문제마다 배경색이 바뀌는 알록달록한 분위기로 꾸며줘.',
        },
      ],
    },
  ],
};
