import type { ProgramType } from '../types';

export const card: ProgramType = {
  id: 'card',
  label: '소개·인사 카드',
  icon: '💌',
  basePrompt:
    '나를 소개하거나 친구에게 인사를 전하는 예쁜 한 페이지 카드 웹 프로그램을 만들어줘. 화면 가운데에 카드가 보이고 꾸밈 요소가 어울리게 배치돼.',
  buildName: () => '나의 소개 카드',
  steps: [
    {
      id: 'kind',
      question: '어떤 카드를 만들까?',
      options: [
        { id: 'me', label: '내 소개', icon: '🙋', promptFragment: '내 이름·좋아하는 것을 소개하는 카드.' },
        { id: 'hello', label: '인사·축하', icon: '🎈', promptFragment: '친구에게 인사·축하를 전하는 카드.' },
      ],
    },
    {
      id: 'theme',
      question: '카드 분위기는?',
      options: [
        { id: 'cute', label: '귀엽게', icon: '🧸', promptFragment: '둥글둥글 귀여운 분위기와 파스텔 색.' },
        { id: 'cool', label: '멋있게', icon: '🦖', promptFragment: '쨍하고 멋있는 분위기와 진한 색.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '밤하늘·별·우주 분위기.' },
      ],
    },
    {
      id: 'deco',
      question: '무엇으로 꾸밀까?',
      multi: true,
      options: [
        { id: 'balloon', label: '풍선', icon: '🎈', promptFragment: '떠다니는 풍선 장식을 넣어.' },
        { id: 'star', label: '반짝이 별', icon: '✨', promptFragment: '반짝이는 별 장식을 넣어.' },
        { id: 'flower', label: '꽃', icon: '🌷', promptFragment: '꽃 장식을 넣어.' },
      ],
    },
    {
      id: 'motion',
      question: '움직임을 넣을까?',
      options: [
        { id: 'float', label: '둥둥 떠다니게', icon: '🫧', promptFragment: '장식이 천천히 둥둥 떠다니는 애니메이션을 넣어.' },
        { id: 'pop', label: '눌러서 효과', icon: '👆', promptFragment: '카드를 누르면 색종이가 터지는 효과를 넣어.' },
        { id: 'none', label: '조용하게', icon: '🤫', promptFragment: '' },
      ],
    },
    {
      id: 'music',
      question: '소리도 넣을까?',
      options: [
        { id: 'yes', label: '응, 짧은 멜로디', icon: '🎵', promptFragment: '카드를 열거나 누르면 Web Audio로 짧고 밝은 멜로디가 나게 해.' },
        { id: 'no', label: '아니', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'name',
      question: '카드에 이름을 적는 칸을 넣을까?',
      options: [
        { id: 'yes', label: '응, 적을래', icon: '✏️', promptFragment: '카드 위에서 직접 이름과 한 줄 메시지를 입력해 바꿀 수 있는 칸을 넣어.' },
        { id: 'no', label: '아니, 그림만', icon: '🖼️', promptFragment: '' },
      ],
    },
  ],
};
