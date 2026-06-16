import type { ProgramType } from '../types';

export const calc: ProgramType = {
  id: 'calc',
  label: '숫자놀이·계산기',
  icon: '🔢',
  basePrompt:
    '버튼을 눌러 숫자를 다루는 웹 프로그램을 만들어줘. 아이들이 켜자마자 바로 쓸 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      calc: '나의 계산기',
      guess: '숫자 맞히기 게임',
      times: '구구단 연습기',
    };
    const mode = a.mode;
    return typeof mode === 'string' && labels[mode] ? labels[mode] : '나의 숫자놀이';
  },
  steps: [
    {
      id: 'mode',
      question: '어떤 숫자놀이를 만들까?',
      options: [
        { id: 'calc', label: '계산기', icon: '🧮', promptFragment: '더하기·빼기·곱하기·나누기를 할 수 있는 계산기를 만들어.' },
        { id: 'guess', label: '숫자 맞히기 게임', icon: '🎯', promptFragment: '컴퓨터가 숫자를 하나 정하면 내가 맞혀야 하는 숫자 맞히기 게임을 만들어. 더 큰지 작은지 힌트를 줘.' },
        { id: 'times', label: '구구단 연습', icon: '✖️', promptFragment: '구구단 문제를 하나씩 내고 답을 맞히면 점수가 올라가는 구구단 연습 프로그램을 만들어.' },
      ],
    },
    {
      id: 'btnshape',
      question: '버튼 모양은 어떻게 할까?',
      options: [
        { id: 'round', label: '둥근 버튼', icon: '🔵', promptFragment: '버튼을 동그랗게 만들어.' },
        { id: 'square', label: '네모 버튼', icon: '🟦', promptFragment: '버튼을 네모나게 만들어.' },
        { id: 'big', label: '아주 큰 버튼', icon: '🆙', promptFragment: '버튼을 손가락으로 누르기 쉽게 아주 크게 만들어.' },
      ],
    },
    {
      id: 'color',
      question: '버튼 색은 어떻게 할까?',
      options: [
        { id: 'blue', label: '파란색', icon: '💙', promptFragment: '버튼을 파란색 계열로 해.' },
        { id: 'green', label: '초록색', icon: '💚', promptFragment: '버튼을 초록색 계열로 해.' },
        { id: 'rainbow', label: '알록달록', icon: '🌈', promptFragment: '버튼마다 색을 다르게 알록달록하게 해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '버튼을 파스텔 색으로 해.' },
      ],
    },
    {
      id: 'range',
      question: '어떤 범위 숫자를 맞힐까?',
      showIf: (a) => a.mode === 'guess',
      options: [
        { id: 'r10', label: '1부터 10', icon: '🔟', promptFragment: '숫자 범위를 1~10으로 해.' },
        { id: 'r50', label: '1부터 50', icon: '5️⃣', promptFragment: '숫자 범위를 1~50으로 해.' },
        { id: 'r100', label: '1부터 100', icon: '💯', promptFragment: '숫자 범위를 1~100으로 해.' },
      ],
    },
    {
      id: 'btnsound',
      question: '버튼 누를 때 소리를 넣을까?',
      options: [
        { id: 'click', label: '딸깍 소리', icon: '🎵', promptFragment: '버튼을 누를 때마다 Web Audio로 딸깍 소리가 나게 해.' },
        { id: 'boop', label: '뿅 소리', icon: '💫', promptFragment: '버튼을 누를 때마다 Web Audio로 귀여운 뿅 소리가 나게 해.' },
        { id: 'none', label: '소리 없이', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'extra',
      question: '추가 기능을 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'clear', label: '지우기 버튼', icon: '🗑️', promptFragment: '입력한 숫자를 한 번에 지우는 C 버튼을 넣어.' },
        { id: 'back', label: '뒤로 지우기', icon: '⬅️', promptFragment: '마지막 숫자 하나만 지우는 ← 버튼을 넣어.' },
        { id: 'mute', label: '소리 끄기', icon: '🔕', promptFragment: '소리를 켜고 끌 수 있는 버튼을 넣어.' },
      ],
    },
    {
      id: 'display',
      question: '숫자 화면을 어떻게 보여줄까?',
      options: [
        { id: 'bignum', label: '큰 숫자', icon: '🔠', promptFragment: '결과 숫자를 화면에 아주 크게 표시해.' },
        { id: 'cute', label: '귀여운 글씨', icon: '🖋️', promptFragment: '결과 숫자를 둥글둥글 귀여운 글씨체로 표시해.' },
      ],
    },
    {
      id: 'bg',
      question: '배경은 어떻게 할까?',
      options: [
        { id: 'white', label: '하얀 배경', icon: '🤍', promptFragment: '배경을 깔끔한 흰색으로 해.' },
        { id: 'dark', label: '어두운 배경', icon: '🖤', promptFragment: '배경을 어두운 색으로 해서 숫자가 밝게 보이게 해.' },
        { id: 'sky', label: '파란 하늘', icon: '🩵', promptFragment: '배경을 밝은 파란색으로 해.' },
        { id: 'yellow', label: '노란 배경', icon: '💛', promptFragment: '배경을 밝고 따뜻한 노란색으로 해.' },
      ],
    },
  ],
};
