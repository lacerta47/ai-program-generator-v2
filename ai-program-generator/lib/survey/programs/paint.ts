import type { ProgramType } from '../types';

export const paint: ProgramType = {
  id: 'paint',
  label: '그림판',
  icon: '🎨',
  basePrompt:
    '마우스(또는 손가락)로 자유롭게 그림을 그릴 수 있는 그림판 웹 프로그램을 만들어줘. 색을 고르는 팔레트와 지우개, 전체 지우기 버튼을 포함해.',
  buildName: () => '나의 그림판',
  steps: [
    {
      id: 'bg',
      question: '어떤 종이에 그릴까?',
      options: [
        { id: 'white', label: '하얀 종이', icon: '🤍', promptFragment: '캔버스 배경은 하얀색.' },
        { id: 'board', label: '까만 칠판', icon: '🟩', promptFragment: '캔버스 배경은 어두운 칠판색이고 기본 그림색은 밝게.' },
        { id: 'sky', label: '하늘색', icon: '🩵', promptFragment: '캔버스 배경은 연한 하늘색.' },
      ],
    },
    {
      id: 'brush',
      question: '어떤 붓으로 그릴까?',
      options: [
        { id: 'pen', label: '얇은 펜', icon: '🖊️', promptFragment: '기본 붓은 얇은 펜.' },
        { id: 'crayon', label: '굵은 크레용', icon: '🖍️', promptFragment: '기본 붓은 굵은 크레용 느낌.' },
        { id: 'spray', label: '스프레이', icon: '💨', promptFragment: '기본 붓은 점이 퍼지는 스프레이.' },
      ],
    },
    {
      id: 'rainbow',
      question: '무지개 색도 넣을까?',
      showIf: (a) => a.brush === 'crayon',
      options: [
        { id: 'yes', label: '응, 알록달록!', icon: '🌈', promptFragment: '그릴 때 색이 무지개처럼 점점 바뀌는 무지개 모드 버튼을 추가해.' },
        { id: 'no', label: '아니, 한 색', icon: '🎯', promptFragment: '' },
      ],
    },
    {
      id: 'palette',
      question: '어떤 색들을 쓸까?',
      options: [
        { id: 'basic', label: '기본 색', icon: '🔴', promptFragment: '빨강·파랑·노랑·검정·흰색 기본 팔레트.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '연한 파스텔 색 팔레트.' },
        { id: 'neon', label: '형광', icon: '⚡', promptFragment: '쨍한 형광색 팔레트.' },
      ],
    },
    {
      id: 'size',
      question: '붓 굵기를 바꿀 수 있게 할까?',
      options: [
        { id: 'slider', label: '응, 조절 막대', icon: '🎚️', promptFragment: '붓 굵기를 바꾸는 슬라이더를 넣어.' },
        { id: 'fixed', label: '아니, 그대로', icon: '✋', promptFragment: '' },
      ],
    },
    {
      id: 'stamp',
      question: '도장 찍기도 넣을까?',
      options: [
        { id: 'star', label: '별 도장', icon: '⭐', promptFragment: '클릭하면 별이 찍히는 도장 버튼을 추가해.' },
        { id: 'heart', label: '하트 도장', icon: '💗', promptFragment: '클릭하면 하트가 찍히는 도장 버튼을 추가해.' },
        { id: 'none', label: '없어도 돼', icon: '🚫', promptFragment: '' },
      ],
    },
    {
      id: 'save',
      question: '내 그림을 저장하는 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 저장 버튼', icon: '💾', promptFragment: '그림을 이미지로 저장(다운로드)하는 버튼을 넣어.' },
        { id: 'no', label: '아니', icon: '🚫', promptFragment: '' },
      ],
    },
  ],
};
