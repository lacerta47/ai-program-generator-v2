import type { ProgramType } from '../types';

export const roulette: ProgramType = {
  id: 'roulette',
  label: '룰렛·뽑기',
  icon: '🎡',
  basePrompt:
    '버튼을 누르면 빙글빙글 돌다가 멈추며 하나를 뽑아주는 룰렛 웹 프로그램을 만들어줘. 칸에는 예시 항목을 미리 채워 넣고, 아이들이 켜자마자 바로 돌릴 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      lunch: '점심 메뉴 룰렛',
      name: '이름 뽑기 룰렛',
      task: '오늘의 할 일 룰렛',
      penalty: '벌칙 룰렛',
    };
    const use = a.use;
    return typeof use === 'string' && labels[use] ? labels[use] : '나의 룰렛';
  },
  steps: [
    {
      id: 'use',
      question: '어떤 때 쓸 룰렛이야?',
      options: [
        { id: 'lunch', label: '점심 메뉴', icon: '🍱', promptFragment: '점심 메뉴 뽑기 룰렛이야. 칸에 김밥·라면·피자·치킨·볶음밥·떡볶이를 채워줘.' },
        { id: 'name', label: '이름 뽑기', icon: '👤', promptFragment: '이름 뽑기 룰렛이야. 칸에 다빈·수아·지호·민준·예린·태양을 채워줘.' },
        { id: 'task', label: '오늘의 할 일', icon: '📋', promptFragment: '오늘 할 일 뽑기 룰렛이야. 칸에 책 읽기·운동하기·그림 그리기·청소하기·일기 쓰기·악기 연습을 채워줘.' },
        { id: 'penalty', label: '벌칙 뽑기', icon: '😜', promptFragment: '재미있는 벌칙 뽑기 룰렛이야. 칸에 윗몸일으키기 10번·닭 흉내·눈 감고 노래·한 발로 서기·박수 20번·혀 내밀기를 채워줘.' },
      ],
    },
    {
      id: 'slots',
      question: '칸을 몇 개 만들까?',
      options: [
        { id: 's4', label: '4칸', icon: '4️⃣', promptFragment: '룰렛 칸을 4개로 만들어.' },
        { id: 's6', label: '6칸', icon: '6️⃣', promptFragment: '룰렛 칸을 6개로 만들어.' },
        { id: 's8', label: '8칸', icon: '8️⃣', promptFragment: '룰렛 칸을 8개로 만들어.' },
      ],
    },
    {
      id: 'color',
      question: '룰렛 색은 어떻게 할까?',
      options: [
        { id: 'rainbow', label: '알록달록', icon: '🌈', promptFragment: '각 칸을 빨강·주황·노랑·초록·파랑·보라 등 무지개 색으로 칠해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '각 칸을 연한 파스텔 색으로 칠해.' },
        { id: 'vivid', label: '쨍한 색', icon: '⚡', promptFragment: '각 칸을 쨍하고 밝은 색으로 칠해.' },
      ],
    },
    {
      id: 'spinsound',
      question: '돌릴 때 소리를 넣을까?',
      options: [
        { id: 'tick', label: '틱틱 소리', icon: '🎵', promptFragment: '룰렛이 돌아갈 때 Web Audio로 틱틱 소리가 나게 해.' },
        { id: 'whirl', label: '윙~ 소리', icon: '💨', promptFragment: '룰렛이 돌아갈 때 Web Audio로 윙윙 소리가 나게 해.' },
        { id: 'none', label: '조용하게', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'stopfx',
      question: '멈출 때 어떤 효과를 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'confetti', label: '색종이 팡!', icon: '🎊', promptFragment: '룰렛이 멈출 때 색종이가 화면에 쏟아지는 효과를 넣어.' },
        { id: 'flash', label: '반짝반짝', icon: '✨', promptFragment: '룰렛이 멈출 때 뽑힌 칸이 반짝이는 효과를 넣어.' },
        { id: 'cheer', label: '효과음', icon: '🔊', promptFragment: '룻렛이 멈출 때 Web Audio로 짧고 기분 좋은 효과음을 넣어.' },
      ],
    },
    {
      id: 'bigshow',
      question: '뽑힌 사람 이름을 크게 보여줄까?',
      showIf: (a) => a.use === 'name',
      options: [
        { id: 'yes', label: '응, 크게!', icon: '🎤', promptFragment: '뽑힌 이름을 화면 한가운데에 아주 크게 잠깐 보여줘.' },
        { id: 'no', label: '아니, 칸에만', icon: '🙂', promptFragment: '' },
      ],
    },
    {
      id: 'again',
      question: '다시 돌리기 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '결과 아래에 다시 돌리기 버튼을 넣어.' },
        { id: 'no', label: '아니, 그냥 눌러서', icon: '👆', promptFragment: '' },
      ],
    },
    {
      id: 'bg',
      question: '배경 느낌은 어떻게 할까?',
      options: [
        { id: 'bright', label: '밝고 흰 배경', icon: '🤍', promptFragment: '배경은 밝고 깔끔한 흰색 계열로 해.' },
        { id: 'dark', label: '어두운 배경', icon: '🖤', promptFragment: '배경은 어두운 색으로 해서 룰렛이 돋보이게 해.' },
        { id: 'sky', label: '하늘색 배경', icon: '🩵', promptFragment: '배경은 연한 하늘색으로 해.' },
        { id: 'star', label: '별이 빛나는 밤', icon: '🌙', promptFragment: '배경은 별이 떠 있는 밤하늘 느낌으로 해.' },
      ],
    },
  ],
};
