import type { ProgramType } from '../types';

export const quiz: ProgramType = {
  id: 'quiz',
  label: '퀴즈',
  icon: '❓',
  basePrompt:
    '문제를 하나씩 보여주고 보기 중에 답을 고르면 맞았는지 알려주는 퀴즈 게임 웹 프로그램을 만들어줘. 점수를 세고 마지막에 결과를 보여줘. 문제는 예시로 5개 정도 채워 넣어.',
  buildName: (a) => (typeof a.topic === 'string' ? `${a.topic} 퀴즈` : '나의 퀴즈'),
  steps: [
    {
      id: 'topic',
      question: '무엇에 대한 퀴즈일까?',
      options: [
        { id: 'animal', label: '동물', icon: '🐶', promptFragment: '동물에 대한 쉬운 퀴즈 문제로 채워줘.' },
        { id: 'food', label: '음식', icon: '🍎', promptFragment: '음식에 대한 쉬운 퀴즈 문제로 채워줘.' },
        { id: 'math', label: '숫자·더하기', icon: '➕', promptFragment: '한 자리 수 더하기·빼기 같은 쉬운 숫자 퀴즈로 채워줘.' },
        { id: 'mix', label: '이것저것', icon: '🎲', promptFragment: '동물·음식·생활 상식이 섞인 쉬운 퀴즈로 채워줘.' },
      ],
    },
    {
      id: 'answer',
      question: '답은 어떻게 고를까?',
      options: [
        { id: 'ox', label: 'O / X', icon: '⭕', promptFragment: '각 문제는 O/X 두 개 버튼으로 답해.' },
        { id: 'choice', label: '보기 중 고르기', icon: '🔢', promptFragment: '각 문제는 보기 3~4개 버튼 중에 답을 골라.' },
      ],
    },
    {
      id: 'feedback',
      question: '맞히면 어떤 반응을 줄까?',
      options: [
        { id: 'sound', label: '소리', icon: '🔊', promptFragment: '정답이면 기분 좋은 소리, 오답이면 부드러운 소리를 Web Audio로 내줘.' },
        { id: 'emoji', label: '큰 이모지', icon: '🎉', promptFragment: '정답이면 화면에 큰 축하 효과(이모지/색종이)를 잠깐 보여줘.' },
        { id: 'both', label: '둘 다!', icon: '✨', promptFragment: '정답이면 소리와 큰 축하 효과를 함께 보여줘.' },
      ],
    },
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        { id: 'yes', label: '응, 10초', icon: '⏱️', promptFragment: '각 문제에 10초 제한 시간과 줄어드는 시간 막대를 넣어.' },
        { id: 'no', label: '아니, 천천히', icon: '🐢', promptFragment: '시간 제한 없이 천천히 풀 수 있게 해.' },
      ],
    },
    {
      id: 'end',
      question: '다 풀면 무엇을 보여줄까?',
      options: [
        { id: 'score', label: '점수와 칭찬', icon: '🏆', promptFragment: '마지막에 점수와 칭찬 메시지, 다시하기 버튼을 보여줘.' },
        { id: 'medal', label: '메달', icon: '🥇', promptFragment: '마지막에 점수에 따라 금·은·동 메달과 다시하기 버튼을 보여줘.' },
      ],
    },
    {
      id: 'hard',
      question: '문제를 점점 어렵게 할까?',
      showIf: (a) => a.topic === 'math',
      options: [
        { id: 'yes', label: '응, 점점 크게', icon: '📈', promptFragment: '뒤로 갈수록 숫자가 조금씩 커지게 난이도를 올려줘.' },
        { id: 'no', label: '아니, 비슷하게', icon: '➖', promptFragment: '' },
      ],
    },
  ],
};
