import type { ProgramType } from '../types';

export const aquarium: ProgramType = {
  id: 'aquarium',
  label: '디지털 수족관',
  icon: '🐠',
  basePrompt:
    '생물이나 물체가 화면에서 둥둥 떠다니는 디지털 수족관 웹 프로그램을 만들어줘. 생물과 배경은 SVG나 canvas로 코드로 직접 그려서 만들어. 외부 이미지 파일 없이 켜자마자 바로 볼 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      sea: '나의 바닷속 수족관',
      space: '나의 우주 수족관',
      forest: '나의 숲속 수족관',
      candy: '나의 사탕 나라 수족관',
    };
    const place = a.place;
    return typeof place === 'string' && labels[place] ? labels[place] : '나의 디지털 수족관';
  },
  steps: [
    // Step 1 — 장소 (A: A→B chain)
    {
      id: 'place',
      role: 'decor',
      question: '어디를 배경으로 만들까?',
      options: [
        { id: 'sea', label: '바닷속', icon: '🌊', promptFragment: '바닷속 배경으로 만들어. 물속 느낌을 줘.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '우주 배경으로 만들어. 별이 가득한 우주 느낌을 줘.' },
        { id: 'forest', label: '숲속 연못', icon: '🌿', promptFragment: '숲속 연못 배경으로 만들어. 초록색 자연 느낌을 줘.' },
        { id: 'candy', label: '사탕 나라', icon: '🍬', promptFragment: '파스텔 핑크·보라 사탕 나라 배경으로 만들어. 달콤하고 귀여운 느낌을 줘.' },
      ],
    },

    // Step 2 — 우주 추가 효과 (B in A→B: shows when place===space)
    {
      id: 'spacefx',
      role: 'appearance',
      question: '우주에 특별 효과를 넣을까?',
      showIf: (a) => a.place === 'space',
      options: [
        { id: 'meteor', label: '별똥별', icon: '🌠', promptFragment: '가끔씩 별똥별이 화면을 가로질러 빠르게 지나가는 효과를 넣어.' },
        { id: 'nebula', label: '성운 구름', icon: '🌌', promptFragment: '배경에 형형색색의 성운 구름을 SVG로 그려 넣어.' },
        { id: 'both', label: '둘 다!', icon: '✨', promptFragment: '별똥별이 가끔 지나가고 배경에 성운 구름도 있게 해줘.' },
        { id: 'planet', label: '행성 떠다니기', icon: '🪐', promptFragment: '배경에 작은 행성들도 천천히 떠다니게 넣어줘.' },
      ],
    },

    // Step 3 — 떠다니는 것 (multi) — C in C→D 2-level chain
    {
      id: 'creatures',
      role: 'goal',
      question: '무엇이 떠다닐까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'fish', label: '물고기', icon: '🐟', promptFragment: '색깔 물고기들이 유유히 헤엄쳐 다니게 해.' },
        { id: 'jellyfish', label: '해파리', icon: '🪼', promptFragment: '반투명 해파리가 둥둥 위아래로 떠다니게 해.' },
        { id: 'star', label: '별', icon: '⭐', promptFragment: '반짝이는 별들이 천천히 떠다니게 해.' },
        { id: 'turtle', label: '거북이', icon: '🐢', promptFragment: '느릿느릿 헤엄치는 거북이가 떠다니게 해.' },
        { id: 'crab', label: '게', icon: '🦀', promptFragment: '바닥을 옆으로 기어다니는 게를 넣어줘.' },
        { id: 'shark', label: '상어', icon: '🦈', promptFragment: '크고 위풍당당한 상어가 천천히 헤엄쳐 다니게 해.' },
        { id: 'dolphin', label: '돌고래', icon: '🐬', promptFragment: '빠르고 귀여운 돌고래가 곡선을 그리며 헤엄치게 해.' },
        { id: 'bubble', label: '거품', icon: '🫧', promptFragment: '투명한 거품들이 아래에서 위로 올라가게 해.' },
      ],
    },

    // Step 4 — 물고기 색 (D: 2-level chain — shows when fish in creatures)
    {
      id: 'fishcolor',
      role: 'appearance',
      question: '물고기는 어떤 색으로 만들까? (여러 개 OK)',
      multi: true,
      showIf: (a) => {
        const v = a.creatures;
        return Array.isArray(v) && v.includes('fish');
      },
      options: [
        { id: 'rainbow', label: '무지개 색', icon: '🌈', promptFragment: '물고기들을 무지개 색 다양하게 만들어.' },
        { id: 'orange', label: '주황색', icon: '🟠', promptFragment: '물고기를 주황색으로 만들어.' },
        { id: 'blue', label: '파란색', icon: '🔵', promptFragment: '물고기를 파란색으로 만들어.' },
        { id: 'pink', label: '분홍색', icon: '🩷', promptFragment: '물고기를 분홍색으로 만들어.' },
        { id: 'gold', label: '금붕어 색', icon: '🟡', promptFragment: '물고기를 금붕어처럼 금색·빨강 계열로 만들어.' },
      ],
    },

    // Step 5 — 바닥 장식
    {
      id: 'decor',
      role: 'decor',
      question: '바닥에 산호와 해초 장식을 넣을까?',
      options: [
        { id: 'yes', label: '응, 예쁘게 넣어줘!', icon: '🪸', promptFragment: '수족관 바닥에 산호(🪸)와 해초를 SVG로 그려서 넣어.' },
        { id: 'no', label: '깔끔하게', icon: '🫧', promptFragment: '' },
      ],
    },

    // Step 6 — 마릿수
    {
      id: 'count',
      role: 'flow',
      question: '얼마나 많이 떠다닐까?',
      options: [
        { id: 'few', label: '조금 (5마리)', icon: '1️⃣', promptFragment: '5마리·개 정도로 조금 떠다니게 해.' },
        { id: 'medium', label: '보통 (10마리)', icon: '5️⃣', promptFragment: '10마리·개 정도로 적당히 떠다니게 해.' },
        { id: 'many', label: '많이 (20마리)', icon: '🔢', promptFragment: '20마리·개 이상 가득 떠다니게 해.' },
        { id: 'huge', label: '엄청 많이 (30+)', icon: '🌊', promptFragment: '30마리·개 이상 화면 가득 떠다니게 해.' },
      ],
    },

    // Step 6 — 움직임 속도
    {
      id: 'speed',
      role: 'flow',
      question: '움직임 속도는 어떻게 할까?',
      options: [
        { id: 'slow', label: '천천히', icon: '🐢', promptFragment: '생물들이 느릿느릿 천천히 움직이게 해.' },
        { id: 'normal', label: '보통', icon: '🐠', promptFragment: '생물들이 자연스러운 속도로 움직이게 해.' },
        { id: 'fast', label: '신나게 빠르게', icon: '🐟', promptFragment: '생물들이 빠르게 신나게 움직이게 해.' },
        { id: 'mixed', label: '각자 다르게', icon: '🎲', promptFragment: '생물마다 속도가 조금씩 다르게 해.' },
      ],
    },

    // Step 7 — 배경 색
    {
      id: 'bgcolor',
      role: 'decor',
      question: '배경 색은 어떻게 할까?',
      options: [
        { id: 'deep', label: '깊은 파란색', icon: '💙', promptFragment: '배경을 깊은 바다 같은 진한 파란색으로 해.' },
        { id: 'light', label: '연한 하늘색', icon: '🩵', promptFragment: '배경을 연한 하늘색으로 밝게 해.' },
        { id: 'dark', label: '어두운 밤색', icon: '🌑', promptFragment: '배경을 어두운 밤 색으로 해.' },
        { id: 'gradient', label: '그라데이션', icon: '🌅', promptFragment: '배경을 위아래가 색이 다른 그라데이션으로 해.' },
        { id: 'teal', label: '청록색', icon: '🟢', promptFragment: '배경을 청록색 계열로 해.' },
      ],
    },

    // Step 8 — 클릭 반응 (E: E→F 2-level chain)
    {
      id: 'click',
      role: 'control',
      question: '화면을 클릭하면 어떤 일이 일어날까?',
      options: [
        { id: 'feed', label: '먹이 주기', icon: '🍬', promptFragment: '화면을 클릭하면 그 자리에 먹이가 생기고 근처 생물이 다가오게 해.' },
        { id: 'spawn', label: '한 마리 늘기', icon: '➕', promptFragment: '화면을 클릭하면 그 자리에서 새 생물 하나가 생겨나게 해.' },
        { id: 'flash', label: '반짝 빛나기', icon: '✨', promptFragment: '화면을 클릭하면 그 자리에서 반짝이는 빛 효과가 나게 해.' },
        { id: 'ripple', label: '물결 퍼지기', icon: '🌊', promptFragment: '화면을 클릭하면 그 자리에서 물결이 퍼지는 효과가 나게 해.' },
        { id: 'nametag', label: '이름 붙이기', icon: '🏷️', promptFragment: '물고기를 클릭하면 이름을 입력할 수 있고, 정해진 이름표가 그 물고기 위에 따라다니게 해.' },
      ],
    },

    // Step 9 — 먹이 종류 (F: 2-level chain — shows when click===feed)
    {
      id: 'feedkind',
      role: 'appearance',
      question: '먹이는 어떤 모양으로 만들까?',
      showIf: (a) => a.click === 'feed',
      options: [
        { id: 'pellet', label: '동그란 알갱이', icon: '⚫', promptFragment: '먹이를 작은 동그란 알갱이 모양으로 만들어.' },
        { id: 'flake', label: '납작한 조각', icon: '🟤', promptFragment: '먹이를 납작한 조각 모양으로 만들어.' },
        { id: 'shrimp', label: '새우', icon: '🦐', promptFragment: '먹이를 작은 새우 모양으로 SVG로 그려서 만들어.' },
        { id: 'star', label: '별 모양', icon: '⭐', promptFragment: '먹이를 작은 별 모양으로 만들어.' },
      ],
    },

    // Step 10 — 소리 (G: G→H chain)
    {
      id: 'sound',
      role: 'sound',
      question: '소리를 넣을까?',
      options: [
        { id: 'yes', label: '응, 넣어줘!', icon: '🔊', promptFragment: '배경 소리를 Web Audio API로 넣어줘.' },
        { id: 'no', label: '조용하게', icon: '🔇', promptFragment: '' },
      ],
    },

    // Step 11 — 소리 종류 (H: 2-level chain — shows when sound===yes)
    {
      id: 'soundkind',
      role: 'sound',
      question: '어떤 소리를 넣을까?',
      showIf: (a) => a.sound === 'yes',
      options: [
        { id: 'wave', label: '물 흐르는 소리', icon: '🌊', promptFragment: '배경에 Web Audio로 조용한 물 흐르는 소리를 넣어.' },
        { id: 'bubble', label: '물고기 뽀글뽀글', icon: '🫧', promptFragment: '배경에 Web Audio로 물고기가 뽀글뽀글 거품 내는 소리를 합성해서 넣어.' },
        { id: 'soft', label: '조용한 음악', icon: '🎵', promptFragment: '배경에 Web Audio로 조용한 멜로디 음악을 넣어.' },
        { id: 'nature', label: '자연 소리', icon: '🌿', promptFragment: '배경에 Web Audio로 새소리·바람 소리 같은 자연 소리를 합성해서 넣어.' },
      ],
    },

    // Step 12 — 낮밤 바꾸기
    {
      id: 'daynight',
      role: 'control',
      question: '낮과 밤을 버튼으로 바꿀 수 있게 할까?',
      options: [
        {
          id: 'yes',
          label: '낮밤 자동으로 바뀜',
          icon: '🌙',
          promptFragment: '시간이 지나면 배경이 낮(밝음)에서 밤(어두움)으로 천천히 바뀌는 낮밤 전환 효과를 넣어.',
        },
        {
          id: 'button',
          label: '버튼으로 바꾸기',
          icon: '🌗',
          promptFragment: '🌗 버튼을 눌러 낮과 밤 배경을 직접 바꿀 수 있게 해.',
        },
        {
          id: 'no',
          label: '항상 같게',
          icon: '☀️',
          promptFragment: '',
        },
      ],
    },
  ],
};
