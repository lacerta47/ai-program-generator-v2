import type { ProgramType } from '../types';

export const fortune: ProgramType = {
  id: 'fortune',
  label: '칭찬·운세 뽑기',
  icon: '🔮',
  basePrompt:
    '버튼을 누르면 메시지가 나오는 뽑기 웹 프로그램을 만들어줘. 메시지 예시를 종류별로 충분히(최소 20개 이상) 채워 넣어서 켜자마자 바로 즐길 수 있게 완성형으로 만들어. 예시 메시지는 짧고 쉬운 한국어로, 초등 저학년도 읽을 수 있게 해줘.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      praise: '칭찬 뽑기',
      fortune: '오늘의 운세',
      cheer: '응원의 말 뽑기',
      fact: '재미있는 사실 뽑기',
      riddle: '수수께끼 뽑기',
      animalfriend: '오늘의 동물 친구 뽑기',
    };
    const kind = a.kind;
    return typeof kind === 'string' && labels[kind] ? labels[kind] : '나의 뽑기';
  },
  steps: [
    // Step 1 — kind (A in the A→B→C chain)
    {
      id: 'kind',
      question: '어떤 메시지를 뽑을까?',
      options: [
        {
          id: 'praise',
          label: '칭찬',
          icon: '🌟',
          promptFragment:
            '칭찬 메시지 뽑기야. 예시: "넌 정말 멋져!", "오늘도 최선을 다했어!", "네 미소가 세상을 밝혀!", "넌 할 수 있어!", "정말 대단해!", "항상 친절하구나!", "넌 특별한 사람이야!", "오늘 정말 잘 했어!", "네 노력이 빛나!", "넌 자랑스러워!", "기분 좋은 하루가 될 거야!", "네 아이디어 최고야!", "정말 열심히 했어!", "오늘도 최고야!", "넌 정말 소중해!", "네 웃음이 예뻐!", "친구들이 좋아할 거야!", "꼭 해낼 거야!", "빛나는 하루야!", "어디서든 최고야!" 등으로 채워줘.',
        },
        {
          id: 'fortune',
          label: '오늘의 운세',
          icon: '🌠',
          promptFragment:
            '오늘의 운세 뽑기야. 예시: "오늘은 행운이 가득한 날!", "뭔가 좋은 일이 생길 것 같아!", "오늘은 조심조심 걸어봐!", "친구에게 먼저 인사해보자!", "맛있는 걸 먹는 날!", "새로운 것에 도전하는 날!", "오늘은 쉬면서 충전하자!", "오늘 웃으면 행운이 따라와!", "좋아하는 것을 열심히 하면 빛날 거야!", "오늘은 색깔 있는 옷을 입어봐!", "오늘은 그림 그려봐!", "오늘 물을 많이 마셔봐!", "저녁에 좋은 일이 있을 거야!", "가족에게 사랑한다고 말해봐!", "오늘 일기를 써봐!", "오늘은 크게 웃어봐!", "별을 보는 날이야!", "꿈을 꿀 것 같아!", "오늘 친구에게 선물하고 싶어질 거야!", "동물과 친해지는 날!" 등으로 채워줘.',
        },
        {
          id: 'cheer',
          label: '응원의 말',
          icon: '💪',
          promptFragment:
            '응원 메시지 뽑기야. 짧고 구체적인 행동 응원 메시지를 20개 이상 채워줘. 예시: "오늘 하교 때 친구한테 먼저 인사해봐!", "선생님께 모르는 거 용감하게 물어봐!", "급식 맛있게 먹고 힘내!", "오늘 숙제 다 하면 스스로 칭찬해줘!", "친구가 힘들어 보이면 괜찮아? 한마디 건네봐!", "오늘 한 번만 더 해봐, 할 수 있어!", "쉬는 시간에 밖에 나가서 신선한 공기 마셔!", "집에 가면 가족한테 오늘 있었던 일 얘기해봐!", "연필 꽉 쥐고 글씨 예쁘게 써봐!", "실수해도 괜찮아, 지우개가 있잖아!" 등으로 채워줘.',
        },
        {
          id: 'fact',
          label: '재미있는 사실',
          icon: '💡',
          promptFragment:
            '재미있는 사실 뽑기야. 예시: "문어는 심장이 세 개야!", "코끼리는 점프를 못 해!", "달팽이는 이가 25,000개야!", "하루에 눈을 15,000번쯤 깜빡여!", "새우의 심장은 머리에 있어!", "딸기는 사실 채소야!", "펭귄은 무릎이 있어!", "꿀은 절대 썩지 않아!", "기린은 잠을 30분만 자!", "개미는 자기 몸무게의 50배를 들 수 있어!", "고양이는 단맛을 못 느껴!", "돌고래는 반만 자면서 헤엄쳐!", "사과는 85%가 물이야!", "지구에 개미가 사람보다 훨씬 많아!", "달에는 발자국이 그대로 남아!", "거미줄은 강철보다 강해!", "코끼리는 혼자 외로워하기도 해!", "오리너구리는 알을 낳아!", "상어는 뼈가 없어!", "문어는 색맹인데 색을 맞춰!" 등 신기한 사실을 채워줘.',
        },
        {
          id: 'riddle',
          label: '수수께끼',
          icon: '🤔',
          promptFragment:
            '수수께끼 뽑기야. 질문과 정답을 같이 보여줘. 예시: "몸은 하나인데 발이 열둘 — 뭘까? (답: 양말 세 켤레)", "입이 있지만 말 못 하는 것은? (답: 병)", "날아다니지만 새가 아닌 것은? (답: 비행기)", "항상 앞만 보는 것은? (답: 시계)", "색은 없는데 볼 수 있는 것은? (답: 공기)" 등 유머 수수께끼 20개 이상 채워줘. 버튼을 누르면 질문이 나오고, 다시 누르면 정답이 나오게 해줘.',
        },
        {
          id: 'animalfriend',
          label: '오늘의 동물 친구',
          icon: '🦁',
          promptFragment:
            '오늘의 동물 친구 칭찬 메시지 뽑기야. 동물 캐릭터로 칭찬하는 메시지를 보여줘. 예시: "오늘 너는 사자야! 용감하고 씩씩한 하루가 될 거야!", "오늘 너는 토끼야! 깡충깡충 신나게 뛰어다니는 하루가 될 거야!", "오늘 너는 강아지야! 친구들에게 사랑 가득한 하루가 될 거야!", "오늘 너는 고양이야! 자유롭고 멋진 하루가 될 거야!", "오늘 너는 펭귄이야! 뒤뚱뒤뚱 귀여운 하루가 될 거야!", "오늘 너는 코끼리야! 든든하고 힘 센 하루가 될 거야!", "오늘 너는 기린이야! 쑥쑥 크는 하루가 될 거야!", "오늘 너는 곰이야! 따뜻하고 포근한 하루가 될 거야!", "오늘 너는 여우야! 영리하고 재치 있는 하루가 될 거야!", "오늘 너는 판다야! 귀엽고 특별한 하루가 될 거야!" 식으로 동물마다 다른 칭찬을 채워줘. 동물 이모지를 크게 보여주고 밑에 칭찬 메시지가 나오게 해줘.',
        },
      ],
    },

    // Step 2 — 운세 추가 옵션 (B in A→B→C chain: shows when kind===fortune)
    {
      id: 'luckyextras',
      question: '운세에 행운 정보를 같이 보여줄까? (여러 개 OK)',
      multi: true,
      showIf: (a) => a.kind === 'fortune',
      options: [
        { id: 'color', label: '행운의 색', icon: '🎨', promptFragment: '운세와 함께 오늘의 행운의 색을 랜덤으로 보여줘.' },
        { id: 'number', label: '행운의 숫자', icon: '🔢', promptFragment: '운세와 함께 오늘의 행운의 숫자를 랜덤으로 보여줘.' },
        { id: 'animal', label: '행운의 동물', icon: '🐾', promptFragment: '운세와 함께 오늘의 행운의 동물을 랜덤으로 보여줘.' },
        { id: 'food', label: '행운의 음식', icon: '🍀', promptFragment: '운세와 함께 오늘의 행운의 음식을 랜덤으로 보여줘.' },
        { id: 'action', label: '행운의 행동', icon: '🎯', promptFragment: '운세와 함께 오늘의 행운의 행동을 랜덤으로 보여줘. 예시: "오늘은 빨간 것을 만져봐!", "친구한테 먼저 하이파이브 해봐!", "오늘 점심에 새 음식 한 가지 먹어봐!", "산책할 때 나뭇잎 하나 주워봐!", "오늘 좋아하는 노래 한 번 불러봐!", "친구에게 칭찬 한마디 해줘봐!", "오늘 물 열 모금 마셔봐!" 류의 간단한 행동 운세를 20개 이상 채워줘.' },
      ],
    },

    // Step 3 — 동물 보여주는 법 (C: 2-level chain — shows when luckyextras includes animal)
    {
      id: 'animalshow',
      question: '행운의 동물을 어떻게 보여줄까?',
      showIf: (a) => {
        const v = a.luckyextras;
        return Array.isArray(v) && v.includes('animal');
      },
      options: [
        { id: 'emoji', label: '이모지로 크게', icon: '🐾', promptFragment: '행운의 동물을 큰 이모지로 화면 가운데에 보여줘.' },
        { id: 'svg', label: 'SVG 그림으로', icon: '🎨', promptFragment: '행운의 동물을 SVG로 귀엽게 그려서 보여줘.' },
        { id: 'text', label: '이름만 텍스트로', icon: '🔤', promptFragment: '행운의 동물 이름만 텍스트로 표시해줘.' },
        { id: 'spin', label: '빙글 돌면서 등장', icon: '🌀', promptFragment: '행운의 동물이 빙글 돌면서 나타나는 애니메이션을 넣어줘.' },
      ],
    },

    // Step 4 — 분위기
    {
      id: 'mood',
      question: '분위기는 어떻게 할까?',
      options: [
        { id: 'cute', label: '귀엽게', icon: '🧸', promptFragment: '귀엽고 따뜻한 파스텔 분위기로 만들어.' },
        { id: 'magic', label: '신비롭게', icon: '🔮', promptFragment: '보라·남색·금색 등 신비로운 마법 분위기로 만들어.' },
        { id: 'bright', label: '밝고 신나게', icon: '☀️', promptFragment: '밝고 쨍한 색감으로 신나는 분위기로 만들어.' },
        { id: 'cozy', label: '따뜻하게', icon: '🍵', promptFragment: '따뜻한 주황·노랑 계열로 아늑한 분위기로 만들어.' },
        { id: 'cool', label: '시원하게', icon: '❄️', promptFragment: '파랑·민트 계열로 시원한 분위기로 만들어.' },
      ],
    },

    // Step 5 — 버튼 모양
    {
      id: 'btnshape',
      question: '뽑기 버튼 모양은?',
      options: [
        { id: 'crystal', label: '수정 구슬', icon: '🔮', promptFragment: '뽑기 버튼을 수정 구슬 모양으로 만들어.' },
        { id: 'star', label: '별 모양', icon: '⭐', promptFragment: '뽑기 버튼을 별 모양으로 만들어.' },
        { id: 'big', label: '크고 둥근 버튼', icon: '🔵', promptFragment: '뽑기 버튼을 크고 둥글게 만들어.' },
        { id: 'gift', label: '선물 상자', icon: '🎁', promptFragment: '뽑기 버튼을 선물 상자처럼 만들어.' },
        { id: 'card', label: '카드 뒤집기', icon: '🃏', promptFragment: '뽑기를 카드를 뒤집는 모양으로 만들어.' },
      ],
    },

    // Step 6 — 나타나는 효과 (fx — D in chain: fx→fxsound)
    {
      id: 'fx',
      question: '메시지가 나올 때 어떤 효과를 줄까?',
      options: [
        { id: 'tada', label: '짠! 하고 나타나기', icon: '🎉', promptFragment: '메시지가 짠! 하고 크게 튀어나오는 애니메이션을 넣어.' },
        { id: 'roll', label: '또르르 굴러서', icon: '🎲', promptFragment: '메시지가 위에서 또르르 내려오는 애니메이션을 넣어.' },
        { id: 'sparkle', label: '반짝이며 나타나기', icon: '✨', promptFragment: '메시지가 반짝이면서 서서히 나타나는 애니메이션을 넣어.' },
        { id: 'flip', label: '카드 뒤집기', icon: '🃏', promptFragment: '메시지가 카드가 뒤집히듯 나타나는 3D 애니메이션을 넣어.' },
        { id: 'confetti', label: '색종이 폭죽', icon: '🎊', promptFragment: '메시지가 나올 때 색종이 폭죽이 터지는 효과를 넣어.' },
      ],
    },

    // Step 7 — 효과 소리 (2nd conditional: shows when fx is NOT 'none' — any fx choice)
    {
      id: 'fxsound',
      question: '효과가 나올 때 소리도 같이 넣을까?',
      showIf: (a) => !!a.fx,
      options: [
        { id: 'magic', label: '마법 소리', icon: '🎵', promptFragment: '효과와 함께 Web Audio로 마법 같은 반짝 소리를 넣어.' },
        { id: 'pop', label: '팡! 소리', icon: '🎊', promptFragment: '효과와 함께 Web Audio로 팡 하는 효과음을 넣어.' },
        { id: 'chime', label: '차임벨 소리', icon: '🔔', promptFragment: '효과와 함께 Web Audio로 맑은 차임벨 소리를 넣어.' },
        { id: 'none', label: '소리 없이', icon: '🔇', promptFragment: '' },
      ],
    },

    // Step 8 — 한 번에 몇 개
    {
      id: 'count',
      question: '한 번에 몇 개 뽑을까?',
      options: [
        { id: 'one', label: '하나', icon: '1️⃣', promptFragment: '한 번에 메시지 하나를 뽑아 크게 보여줘.' },
        { id: 'three', label: '세 개 중 고르기', icon: '3️⃣', promptFragment: '한 번에 세 개의 메시지를 보여주고 마음에 드는 걸 고르게 해줘.' },
      ],
    },

    // Step 9 — 다시 뽑기
    {
      id: 'again',
      question: '다시 뽑기 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 넣어줘', icon: '🔄', promptFragment: '메시지 아래에 다시 뽑기 버튼을 넣어.' },
        { id: 'no', label: '아니, 한 번만', icon: '👆', promptFragment: '' },
      ],
    },

    // Step 10 — 공유/저장
    {
      id: 'share',
      question: '뽑은 메시지를 어떻게 할까?',
      options: [
        { id: 'show', label: '친구한테 크게 보여주기', icon: '📺', promptFragment: '뽑은 메시지를 화면에 크게 펼쳐 보여주는 버튼을 넣어.' },
        { id: 'nothing', label: '그냥 보기', icon: '🙂', promptFragment: '' },
      ],
    },

    // Step 11 — 배경
    {
      id: 'bg',
      question: '배경을 어떻게 꾸밀까?',
      options: [
        { id: 'stars', label: '별이 반짝이게', icon: '🌟', promptFragment: '배경에 반짝이는 별 효과를 CSS/JS로 넣어.' },
        { id: 'bubbles', label: '거품이 올라오게', icon: '🫧', promptFragment: '배경에 거품이 천천히 올라오는 효과를 CSS/JS로 넣어.' },
        { id: 'plain', label: '단색 깔끔하게', icon: '🟦', promptFragment: '배경을 단색으로 깔끔하게 해.' },
        { id: 'gradient', label: '그라데이션', icon: '🌈', promptFragment: '배경을 예쁜 그라데이션 색으로 해.' },
      ],
    },
  ],
};
