import type { ProgramType } from '../types';

export const fortune: ProgramType = {
  id: 'fortune',
  label: '칭찬·운세 뽑기',
  icon: '🔮',
  basePrompt:
    '버튼을 누르면 메시지가 나오는 뽑기 웹 프로그램을 만들어줘. 메시지 예시를 종류별로 충분히(최소 15개 이상) 채워 넣어서 켜자마자 바로 즐길 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      praise: '칭찬 뽑기',
      fortune: '오늘의 운세',
      cheer: '응원의 말 뽑기',
      fact: '재미있는 사실 뽑기',
    };
    const kind = a.kind;
    return typeof kind === 'string' && labels[kind] ? labels[kind] : '나의 뽑기';
  },
  steps: [
    {
      id: 'kind',
      question: '어떤 메시지를 뽑을까?',
      options: [
        {
          id: 'praise',
          label: '칭찬',
          icon: '🌟',
          promptFragment:
            '칭찬 메시지 뽑기야. 예시: "넌 정말 멋져!", "오늘도 최선을 다했어!", "네 미소가 세상을 밝혀!", "넌 할 수 있어!", "정말 대단해!", "항상 친절하구나!", "넌 특별한 사람이야!", "오늘 정말 잘 했어!", "네 노력이 빛나!", "넌 자랑스러워!", "기분 좋은 하루가 될 거야!", "네 아이디어 최고야!", "정말 열심히 했어!", "오늘도 최고야!", "넌 정말 소중해!" 등으로 채워줘.',
        },
        {
          id: 'fortune',
          label: '오늘의 운세',
          icon: '🌠',
          promptFragment:
            '오늘의 운세 뽑기야. 예시: "오늘은 행운이 가득한 날!", "뭔가 좋은 일이 생길 것 같아!", "오늘은 조심조심 걸어봐!", "친구에게 먼저 인사해보자!", "맛있는 걸 먹는 날!", "새로운 것에 도전하는 날!", "오늘은 쉬면서 충전하자!", "오늘 웃으면 행운이 따라와!", "좋아하는 것을 열심히 하면 빛날 거야!", "오늘은 색깔 있는 옷을 입어봐!" 등으로 채워줘.',
        },
        {
          id: 'cheer',
          label: '응원의 말',
          icon: '💪',
          promptFragment:
            '응원 메시지 뽑기야. 예시: "포기하지 마, 할 수 있어!", "지금 이 순간도 잘 하고 있어!", "힘들 때일수록 더 강해져!", "한 걸음씩 앞으로!", "넌 이미 충분히 잘 하고 있어!", "오늘도 최선을 다해!", "실수해도 괜찮아, 다시 하면 돼!", "네 꿈을 믿어봐!", "조금만 더 힘내!", "넌 분명히 해낼 거야!" 등으로 채워줘.',
        },
        {
          id: 'fact',
          label: '재미있는 사실',
          icon: '💡',
          promptFragment:
            '재미있는 사실 뽑기야. 예시: "문어는 심장이 세 개야!", "코끼리는 점프를 못 해!", "달팽이는 이가 25,000개야!", "하루에 눈을 15,000번쯤 깜빡여!", "새우의 심장은 머리에 있어!", "딸기는 사실 채소야!", "펭귄은 무릎이 있어!", "꿀은 절대 썩지 않아!", "기린은 잠을 30분만 자!", "개미는 자기 몸무게의 50배를 들 수 있어!" 등 신기한 사실을 채워줘.',
        },
      ],
    },
    {
      id: 'mood',
      question: '분위기는 어떻게 할까?',
      options: [
        { id: 'cute', label: '귀엽게', icon: '🧸', promptFragment: '귀엽고 따뜻한 파스텔 분위기로 만들어.' },
        { id: 'magic', label: '신비롭게', icon: '🔮', promptFragment: '보라·남색·금색 등 신비로운 마법 분위기로 만들어.' },
        { id: 'bright', label: '밝고 신나게', icon: '☀️', promptFragment: '밝고 쨍한 색감으로 신나는 분위기로 만들어.' },
      ],
    },
    {
      id: 'btnshape',
      question: '뽑기 버튼 모양은?',
      options: [
        { id: 'crystal', label: '수정 구슬', icon: '🔮', promptFragment: '뽑기 버튼을 수정 구슬 모양으로 만들어.' },
        { id: 'star', label: '별 모양', icon: '⭐', promptFragment: '뽑기 버튼을 별 모양으로 만들어.' },
        { id: 'big', label: '크고 둥근 버튼', icon: '🔵', promptFragment: '뽑기 버튼을 크고 둥글게 만들어.' },
        { id: 'gift', label: '선물 상자', icon: '🎁', promptFragment: '뽑기 버튼을 선물 상자처럼 만들어.' },
      ],
    },
    {
      id: 'fx',
      question: '메시지가 나올 때 어떤 효과를 줄까?',
      options: [
        { id: 'tada', label: '짠! 하고 나타나기', icon: '🎉', promptFragment: '메시지가 짠! 하고 크게 튀어나오는 애니메이션을 넣어.' },
        { id: 'roll', label: '또르르 굴러서', icon: '🎲', promptFragment: '메시지가 위에서 또르르 내려오는 애니메이션을 넣어.' },
        { id: 'sparkle', label: '반짝이며 나타나기', icon: '✨', promptFragment: '메시지가 반짝이면서 서서히 나타나는 애니메이션을 넣어.' },
      ],
    },
    {
      id: 'sound',
      question: '소리도 넣을까?',
      options: [
        { id: 'magic', label: '마법 소리', icon: '🎵', promptFragment: '뽑을 때 Web Audio로 마법 같은 반짝 소리를 넣어.' },
        { id: 'pop', label: '팡! 소리', icon: '🎊', promptFragment: '뽑을 때 Web Audio로 팡 하는 효과음을 넣어.' },
        { id: 'none', label: '소리 없이', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'count',
      question: '한 번에 몇 개 뽑을까?',
      options: [
        { id: 'one', label: '하나', icon: '1️⃣', promptFragment: '한 번에 메시지 하나를 뽑아 크게 보여줘.' },
        { id: 'three', label: '세 개 중 고르기', icon: '3️⃣', promptFragment: '한 번에 세 개의 메시지를 보여주고 마음에 드는 걸 고르게 해줘.' },
      ],
    },
    {
      id: 'luckdetail',
      question: '행운의 색과 숫자도 같이 보여줄까?',
      showIf: (a) => a.kind === 'fortune',
      options: [
        { id: 'yes', label: '응, 보여줘!', icon: '🍀', promptFragment: '운세 메시지와 함께 오늘의 행운의 색과 행운의 숫자도 랜덤으로 보여줘.' },
        { id: 'no', label: '아니, 메시지만', icon: '💬', promptFragment: '' },
      ],
    },
    {
      id: 'again',
      question: '다시 뽑기 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '메시지 아래에 다시 뽑기 버튼을 넣어.' },
        { id: 'no', label: '아니, 버튼 한 번만', icon: '👆', promptFragment: '' },
      ],
    },
  ],
};
