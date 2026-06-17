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
      snack: '간식 뽑기 룰렛',
      game: '게임 정하기 룰렛',
      task: '오늘의 할 일 룰렛',
      penalty: '벌칙 룰렛',
      prize: '경품 룰렛',
    };
    const use = a.use;
    return typeof use === 'string' && labels[use] ? labels[use] : '나의 룰렛';
  },
  steps: [
    // Step 1 — 용도
    {
      id: 'use',
      question: '어떤 때 쓸 룰렛이야?',
      options: [
        { id: 'lunch', label: '점심 메뉴', icon: '🍱', promptFragment: '점심 메뉴 뽑기 룰렛이야. 칸에 김밥·라면·피자·치킨·볶음밥·떡볶이를 채워줘.' },
        { id: 'name', label: '이름 뽑기', icon: '👤', promptFragment: '이름 뽑기 룰렛이야. 칸에 다빈·수아·지호·민준·예린·태양을 채워줘.' },
        { id: 'snack', label: '간식 뽑기', icon: '🍭', promptFragment: '간식 뽑기 룰렛이야. 칸에 아이스크림·과자·젤리·초콜릿·팝콘·사탕을 채워줘.' },
        { id: 'game', label: '게임 정하기', icon: '🎮', promptFragment: '게임 정하기 룰렛이야. 칸에 보드게임·술래잡기·숨바꼭질·달리기·공기·고무줄을 채워줘.' },
        { id: 'task', label: '오늘의 할 일', icon: '📋', promptFragment: '오늘 할 일 뽑기 룰렛이야. 칸에 책 읽기·운동하기·그림 그리기·청소하기·일기 쓰기·악기 연습을 채워줘.' },
        { id: 'penalty', label: '벌칙 뽑기', icon: '😜', promptFragment: '재미있는 벌칙 뽑기 룰렛이야. 칸에 윗몸일으키기 10번·닭 흉내·눈 감고 노래·한 발로 서기·박수 20번·혀 내밀기를 채워줘.' },
        { id: 'prize', label: '경품·선물', icon: '🎁', promptFragment: '경품이나 선물 뽑기 룰렛이야. 칸에 책·과자·문구·스티커·게임·쿠폰을 채워줘.' },
      ],
    },

    // Step 2 — 이름 넣는 법 (use==='name', Chain A)
    {
      id: 'namemethod',
      question: '이름을 어떻게 넣을까?',
      showIf: (a) => a.use === 'name',
      options: [
        { id: 'preset', label: '미리 적혀있게', icon: '📝', promptFragment: '이름은 미리 적힌 예시 이름을 사용해.' },
        { id: 'type', label: '직접 타이핑', icon: '⌨️', promptFragment: '이름을 직접 타이핑해서 추가하고 삭제할 수 있는 입력 칸을 넣어줘.' },
        { id: 'count', label: '숫자로 인원 수', icon: '🔢', promptFragment: '인원 수를 숫자로 입력하면 번호가 자동으로 칸에 채워지게 해줘.' },
      ],
    },

    // Step 3 — 몇 명 (Chain B: namemethod==='type' 일 때) [2-level chain 완성]
    {
      id: 'namecount',
      question: '보통 몇 명을 뽑아?',
      showIf: (a) => a.namemethod === 'type',
      options: [
        { id: 'n5', label: '5명 이하', icon: '🖐️', promptFragment: '이름 칸은 최대 5개까지 입력할 수 있게 해줘.' },
        { id: 'n10', label: '6~10명', icon: '🔟', promptFragment: '이름 칸은 최대 10개까지 입력할 수 있게 해줘.' },
        { id: 'n20', label: '11~20명', icon: '2️⃣', promptFragment: '이름 칸은 최대 20개까지 입력할 수 있게 해줘.' },
        { id: 'n30', label: '20명 이상', icon: '🏫', promptFragment: '이름 칸은 최대 30개까지 입력할 수 있게 해줘.' },
      ],
    },

    // Step 4 — 칸 수
    {
      id: 'slots',
      question: '칸을 몇 개 만들까?',
      options: [
        { id: 's4', label: '4칸 (적게)', icon: '4️⃣', promptFragment: '룰렛 칸을 4개로 만들어.' },
        { id: 's6', label: '6칸 (보통)', icon: '6️⃣', promptFragment: '룰렛 칸을 6개로 만들어.' },
        { id: 's8', label: '8칸 (많이)', icon: '8️⃣', promptFragment: '룰렛 칸을 8개로 만들어.' },
        { id: 's10', label: '10칸 (아주 많이)', icon: '🔟', promptFragment: '룰렛 칸을 10개로 만들어.' },
      ],
    },

    // Step 5 — 색
    {
      id: 'color',
      question: '룰렛 색은 어떻게 할까?',
      options: [
        { id: 'rainbow', label: '알록달록', icon: '🌈', promptFragment: '각 칸을 빨강·주황·노랑·초록·파랑·보라 등 무지개 색으로 칠해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '각 칸을 연한 파스텔 색으로 칠해.' },
        { id: 'vivid', label: '쨍한 색', icon: '⚡', promptFragment: '각 칸을 쨍하고 밝은 색으로 칠해.' },
        { id: 'cool', label: '차가운 색', icon: '🩵', promptFragment: '각 칸을 파랑·보라·민트 등 시원한 색으로 칠해.' },
        { id: 'warm', label: '따뜻한 색', icon: '🧡', promptFragment: '각 칸을 빨강·주황·노랑 등 따뜻한 색으로 칠해.' },
      ],
    },

    // Step 6 — 돌리는 속도
    {
      id: 'speed',
      question: '얼마나 빨리 돌릴까?',
      options: [
        { id: 'slow', label: '천천히', icon: '🐢', promptFragment: '룰렛이 느리게 돌다가 멈추게 해.' },
        { id: 'normal', label: '보통', icon: '🚶', promptFragment: '룰렛이 보통 속도로 돌다가 멈추게 해.' },
        { id: 'fast', label: '빠르게', icon: '🚀', promptFragment: '룰렛이 아주 빠르게 돌다가 서서히 멈추게 해.' },
        { id: 'random', label: '매번 달라요', icon: '🎲', promptFragment: '룰렛 속도가 매번 랜덤하게 달라지게 해.' },
        { id: 'super', label: '슈퍼 빠르게', icon: '🌪️', promptFragment: '룰렛이 번개처럼 초고속으로 돌다가 멈추게 해.' },
      ],
    },

    // Step 7 — 돌릴 때 소리
    {
      id: 'spinsound',
      question: '돌릴 때 소리를 넣을까?',
      options: [
        { id: 'tick', label: '틱틱 소리', icon: '🎵', promptFragment: '룰렛이 돌아갈 때 Web Audio로 틱틱 소리가 나게 해.' },
        { id: 'whirl', label: '윙~ 소리', icon: '💨', promptFragment: '룰렛이 돌아갈 때 Web Audio로 윙윙 소리가 나게 해.' },
        { id: 'drum', label: '두구두구 소리', icon: '🥁', promptFragment: '룰렛이 돌아갈 때 Web Audio로 두구두구 드럼 소리가 나게 해.' },
        { id: 'none', label: '조용하게', icon: '🔇', promptFragment: '' },
      ],
    },

    // Step 8 — 소리 종류 (spinsound !== 'none') [조건부]
    {
      id: 'soundmood',
      question: '어떤 느낌 소리가 좋아?',
      showIf: (a) => a.spinsound !== 'none',
      options: [
        { id: 'fun', label: '신나게', icon: '🥳', promptFragment: 'Web Audio 효과음을 신나고 경쾌한 느낌으로 만들어.' },
        { id: 'tense', label: '긴장감 있게', icon: '😬', promptFragment: 'Web Audio 효과음을 긴장감 있고 스릴 있는 느낌으로 만들어.' },
        { id: 'cute', label: '귀엽게', icon: '🐥', promptFragment: 'Web Audio 효과음을 높고 귀여운 느낌으로 만들어.' },
      ],
    },

    // Step 9 — 멈춤 효과 (multi)
    {
      id: 'stopfx',
      question: '멈출 때 어떤 효과를 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'confetti', label: '색종이 팡!', icon: '🎊', promptFragment: '룰렛이 멈출 때 색종이가 화면에 쏟아지는 효과를 넣어.' },
        { id: 'flash', label: '반짝반짝', icon: '✨', promptFragment: '룰렛이 멈출 때 뽑힌 칸이 반짝이는 효과를 넣어.' },
        { id: 'cheer', label: '효과음', icon: '🔊', promptFragment: '룰렛이 멈출 때 Web Audio로 짧고 기분 좋은 효과음을 넣어.' },
        { id: 'shake', label: '화면 흔들기', icon: '📳', promptFragment: '룰렛이 멈출 때 화면이 살짝 흔들리는 효과를 넣어.' },
        { id: 'zoom', label: '뽑힌 칸 확대', icon: '🔍', promptFragment: '룰렛이 멈출 때 뽑힌 칸이 확 커지는 애니메이션을 넣어.' },
      ],
    },

    // Step 10 — 뽑힌 것 크게 보기 (use==='name', Chain A)
    {
      id: 'bigshow',
      question: '뽑힌 사람 이름을 크게 보여줄까?',
      showIf: (a) => a.use === 'name',
      options: [
        { id: 'yes', label: '응, 크게!', icon: '🎤', promptFragment: '뽑힌 이름을 화면 한가운데에 아주 크게 잠깐 보여줘.' },
        { id: 'no', label: '아니, 칸에만', icon: '🙂', promptFragment: '' },
      ],
    },

    // Step 11 — 축하 방식 (bigshow==='yes') [2-level chain: use→bigshow→celebrate]
    {
      id: 'celebrate',
      question: '축하를 어떻게 보여줄까?',
      showIf: (a) => a.bigshow === 'yes',
      options: [
        { id: 'overlay', label: '화면 전체에 크게', icon: '📺', promptFragment: '뽑힌 이름을 화면 전체를 가리는 팝업에 크게 보여줘.' },
        { id: 'banner', label: '위에서 배너로', icon: '🎏', promptFragment: '뽑힌 이름이 위에서 아래로 내려오는 배너 형태로 보여줘.' },
        { id: 'emoji', label: '이모지 폭탄', icon: '🎆', promptFragment: '뽑힌 이름 주위에 이모지와 별이 폭발하듯 터지는 효과를 넣어.' },
        { id: 'glow', label: '빛나는 글씨', icon: '💡', promptFragment: '뽑힌 이름이 빛나고 커졌다 작아지는 애니메이션으로 보여줘.' },
      ],
    },

    // Step 12 — 다시 돌리기
    {
      id: 'again',
      question: '다시 돌리기 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '결과 아래에 다시 돌리기 버튼을 넣어.' },
        { id: 'exclude', label: '뽑힌 건 빼고 다시', icon: '❌', promptFragment: '결과 아래에 "다시 돌리기" 버튼을 넣어. 뽑힌 항목은 자동으로 제외돼.' },
        { id: 'no', label: '룰렛 다시 누르면 돌아가요', icon: '👆', promptFragment: '' },
      ],
    },

    // Step 13 — 배경
    {
      id: 'bg',
      question: '배경 느낌은 어떻게 할까?',
      options: [
        { id: 'bright', label: '밝고 흰 배경', icon: '🤍', promptFragment: '배경은 밝고 깔끔한 흰색 계열로 해.' },
        { id: 'dark', label: '어두운 배경', icon: '🖤', promptFragment: '배경은 어두운 색으로 해서 룰렛이 돋보이게 해.' },
        { id: 'sky', label: '하늘색 배경', icon: '🩵', promptFragment: '배경은 연한 하늘색으로 해.' },
        { id: 'star', label: '별이 빛나는 밤', icon: '🌙', promptFragment: '배경은 별이 떠 있는 밤하늘 느낌으로 해.' },
        { id: 'gradient', label: '그러데이션', icon: '🌅', promptFragment: '배경을 두 색이 부드럽게 섞인 그러데이션으로 해.' },
      ],
    },
  ],
};
