import type { ProgramType } from '../types';

export const paint: ProgramType = {
  id: 'paint',
  label: '그림판',
  icon: '🎨',
  basePrompt:
    '마우스(또는 손가락)로 자유롭게 그림을 그릴 수 있는 그림판 웹 프로그램을 만들어줘. ' +
    '색 팔레트, 붓 선택, 지우개, 전체 지우기 버튼을 포함해. 켜자마자 바로 그릴 수 있게 완성형으로 만들어.',
  buildName: () => '나의 그림판',
  steps: [
    {
      id: 'bg',
      question: '어떤 종이에 그릴까?',
      options: [
        {
          id: 'white',
          label: '하얀 종이',
          icon: '🤍',
          promptFragment: '캔버스 배경은 깨끗한 하얀색.',
        },
        {
          id: 'board',
          label: '까만 칠판',
          icon: '🟩',
          promptFragment: '캔버스 배경은 어두운 칠판색이고, 기본 그림 색은 밝은 노란색.',
        },
        {
          id: 'sky',
          label: '하늘색',
          icon: '🩵',
          promptFragment: '캔버스 배경은 연한 하늘색.',
        },
        {
          id: 'yellow',
          label: '노란 도화지',
          icon: '🟡',
          promptFragment: '캔버스 배경은 따뜻한 연한 노란색.',
        },
        {
          id: 'dot',
          label: '점선 노트',
          icon: '📓',
          promptFragment: '캔버스 배경은 흰색이고 연한 점선 격자무늬가 깔려 있어.',
        },
      ],
    },
    {
      id: 'brush',
      question: '어떤 붓으로 그릴까?',
      options: [
        {
          id: 'pen',
          label: '얇은 펜',
          icon: '🖊️',
          promptFragment: '기본 붓은 얇고 부드러운 펜이야.',
        },
        {
          id: 'crayon',
          label: '굵은 크레용',
          icon: '🖍️',
          promptFragment: '기본 붓은 굵고 거친 크레용 질감이야.',
        },
        {
          id: 'spray',
          label: '스프레이',
          icon: '💨',
          promptFragment: '기본 붓은 랜덤 점이 퍼지는 스프레이 효과야.',
        },
        {
          id: 'marker',
          label: '굵은 마커',
          icon: '✏️',
          promptFragment: '기본 붓은 굵고 선명한 마커야.',
        },
      ],
    },
    {
      id: 'rainbow',
      question: '그릴 때 색이 무지개처럼 바뀌는 모드를 넣을까?',
      showIf: (a) => a.brush === 'crayon',
      options: [
        {
          id: 'yes',
          label: '응, 알록달록!',
          icon: '🌈',
          promptFragment: '크레용 모드에서 그릴 때 색이 무지개처럼 계속 바뀌는 무지개 모드 버튼을 추가해.',
        },
        {
          id: 'no',
          label: '아니, 한 색으로',
          icon: '🎯',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'palette',
      question: '어떤 색들을 쓸까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'basic',
          label: '기본 색',
          icon: '🔴',
          promptFragment: '빨강·파랑·노랑·초록·검정·흰색 기본 팔레트를 넣어.',
        },
        {
          id: 'pastel',
          label: '파스텔',
          icon: '🌸',
          promptFragment: '연한 파스텔 색 팔레트를 넣어.',
        },
        {
          id: 'neon',
          label: '형광',
          icon: '⚡',
          promptFragment: '쨍하고 형광스러운 색 팔레트를 넣어.',
        },
        {
          id: 'nature',
          label: '자연 색',
          icon: '🌿',
          promptFragment: '흙·나뭇잎·하늘처럼 자연에서 온 색 팔레트를 넣어.',
        },
        {
          id: 'custom',
          label: '색 직접 고르기',
          icon: '🎛️',
          promptFragment: '색상 피커(color input)를 추가해서 원하는 색을 자유롭게 고를 수 있게 해.',
        },
      ],
    },
    {
      id: 'size',
      question: '붓 굵기를 조절할 수 있게 할까?',
      options: [
        {
          id: 'slider',
          label: '응, 조절 막대',
          icon: '🎚️',
          promptFragment: '붓 굵기를 조절하는 슬라이더를 툴바에 넣어.',
        },
        {
          id: 'buttons',
          label: '작게·보통·크게 버튼',
          icon: '⚙️',
          promptFragment: '작게·보통·크게 세 가지 굵기 버튼을 넣어.',
        },
        {
          id: 'fixed',
          label: '아니, 그냥 그대로',
          icon: '✋',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'stamp',
      question: '도장 찍기도 넣을까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'star',
          label: '별 도장',
          icon: '⭐',
          promptFragment: '클릭하면 별 모양이 찍히는 도장 버튼을 추가해.',
        },
        {
          id: 'heart',
          label: '하트 도장',
          icon: '💗',
          promptFragment: '클릭하면 하트 모양이 찍히는 도장 버튼을 추가해.',
        },
        {
          id: 'flower',
          label: '꽃 도장',
          icon: '🌼',
          promptFragment: '클릭하면 꽃 모양이 찍히는 도장 버튼을 추가해.',
        },
        {
          id: 'none',
          label: '없어도 돼',
          icon: '🚫',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'music',
      question: '그림 그리는 동안 배경 음악을 넣을까?',
      options: [
        {
          id: 'yes',
          label: '응, 신나는 음악',
          icon: '🎵',
          promptFragment: '웹 오디오(Web Audio API)로 가볍고 밝은 배경 멜로디를 내보내고 음악 켜기·끄기 버튼을 넣어.',
        },
        {
          id: 'draw_sound',
          label: '그릴 때 소리',
          icon: '🖊️',
          promptFragment: '그림을 그릴 때마다 부드러운 소리가 나게 Web Audio로 효과음을 넣어.',
        },
        {
          id: 'no',
          label: '조용하게',
          icon: '🔇',
          promptFragment: '',
        },
      ],
    },
    {
      id: 'save',
      question: '내 그림을 저장하거나 공유하는 버튼을 넣을까?',
      options: [
        {
          id: 'download',
          label: '저장(다운로드)',
          icon: '💾',
          promptFragment: '그림을 PNG 이미지로 다운로드하는 저장 버튼을 넣어.',
        },
        {
          id: 'copy',
          label: '복사해서 붙여넣기',
          icon: '📋',
          promptFragment: '캔버스 이미지를 클립보드에 복사하는 버튼을 넣어.',
        },
        {
          id: 'no',
          label: '아니, 그냥 그리기만',
          icon: '🖼️',
          promptFragment: '',
        },
      ],
    },
  ],
};
