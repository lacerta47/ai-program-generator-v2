import type { ProgramType } from '../types';

export const dressup: ProgramType = {
  id: 'dressup',
  label: '꾸미기 놀이',
  icon: '🎭',
  basePrompt:
    '부품(얼굴·눈·입·모자·소품 등)을 골라 나만의 캐릭터를 완성하는 꾸미기 놀이 웹 프로그램을 만들어줘. ' +
    '화면 가운데에 캐릭터가 크게 보이고, 그 아래나 옆의 버튼으로 각 부분을 바꿔 끼울 수 있어. ' +
    '부품은 전부 SVG나 CSS 도형으로 코드로 그려(외부 이미지 금지). 켜자마자 바로 꾸밀 수 있는 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      face: '웃는 얼굴 만들기',
      snowman: '나만의 눈사람',
      robot: '나만의 로봇',
      animal: '나만의 동물 친구',
      monster: '나만의 몬스터',
      photo: '내 사진 꾸미기',
    };
    const base = a.base;
    return typeof base === 'string' && labels[base] ? labels[base] : '나의 꾸미기 놀이';
  },
  steps: [
    // 1 — 무엇을 꾸밀까 (이름 결정)
    {
      id: 'base',
      role: 'type',
      question: '무엇을 꾸며 볼까?',
      options: [
        { id: 'face', label: '얼굴', icon: '🙂', promptFragment: '동그란 얼굴을 꾸미는 놀이로 만들어. 얼굴 바탕 위에 눈·입 등을 얹어.' },
        { id: 'snowman', label: '눈사람', icon: '⛄', promptFragment: '눈사람을 꾸미는 놀이로 만들어. 하얀 눈 몸통 위에 눈·코·모자 등을 얹어.' },
        { id: 'robot', label: '로봇', icon: '🤖', promptFragment: '네모난 로봇을 꾸미는 놀이로 만들어. 로봇 얼굴·몸에 눈·안테나·버튼 등을 얹어.' },
        { id: 'animal', label: '동물 친구', icon: '🐱', promptFragment: '귀여운 동물 친구를 꾸미는 놀이로 만들어. 동물 얼굴에 귀·눈·코 등을 얹어.' },
        { id: 'monster', label: '몬스터', icon: '👾', promptFragment: '귀엽고 장난스러운 몬스터를 꾸미는 놀이로 만들어. 몸에 눈·뿔·이빨 등을 얹어.' },
        {
          id: 'photo',
          label: '내 사진 꾸미기',
          icon: '📷',
          needsPhoto: true,
          promptFragment:
            '첨부한 사진을 화면 가운데 크게 놓고, 그 위에 부품(모자·안경·리본·수염 등)을 얹어 꾸미는 놀이로 만들어. 부품 위치는 사진 위에 어울리게 겹쳐.',
        },
      ],
    },
    // 2 — 바탕 색
    {
      id: 'basecolor',
      role: 'appearance',
      question: '바탕 색은 어떤 게 좋아?',
      options: [
        { id: 'pink', label: '분홍', icon: '🌸', promptFragment: '캐릭터 바탕 색을 분홍 계열로 해.' },
        { id: 'blue', label: '파랑', icon: '💙', promptFragment: '캐릭터 바탕 색을 파랑 계열로 해.' },
        { id: 'yellow', label: '노랑', icon: '💛', promptFragment: '캐릭터 바탕 색을 노랑 계열로 해.' },
        { id: 'green', label: '초록', icon: '💚', promptFragment: '캐릭터 바탕 색을 초록 계열로 해.' },
        { id: 'purple', label: '보라', icon: '💜', promptFragment: '캐릭터 바탕 색을 보라 계열로 해.' },
        { id: 'change', label: '색도 바꿀 수 있게', icon: '🎨', promptFragment: '바탕 색을 여러 색 중에서 골라 바꿀 수 있는 색 버튼을 넣어.' },
      ],
    },
    // 3 — 눈 모양
    {
      id: 'eyes',
      role: 'appearance',
      question: '눈은 어떻게 할까?',
      options: [
        { id: 'round', label: '동그란 눈', icon: '👀', promptFragment: '동그랗고 초롱초롱한 눈을 넣어.' },
        { id: 'sleepy', label: '졸린 눈', icon: '😴', promptFragment: '반쯤 감긴 졸린 눈을 넣어.' },
        { id: 'star', label: '별 눈', icon: '🤩', promptFragment: '별 모양으로 반짝이는 눈을 넣어.' },
        { id: 'heart', label: '하트 눈', icon: '😍', promptFragment: '하트 모양 눈을 넣어.' },
        { id: 'wink', label: '윙크', icon: '😉', promptFragment: '한쪽 눈을 찡긋하는 윙크 눈을 넣어.' },
        { id: 'many', label: '여러 개 바꿔가며', icon: '🔁', promptFragment: '눈 모양을 여러 가지(동그란·졸린·별·하트·윙크) 중에서 눌러 바꿀 수 있게 해.' },
      ],
    },
    // 4 — 입 모양
    {
      id: 'mouth',
      role: 'appearance',
      question: '입은 어떻게 할까?',
      options: [
        { id: 'smile', label: '활짝 웃는 입', icon: '😄', promptFragment: '활짝 웃는 입을 넣어.' },
        { id: 'small', label: '작은 미소', icon: '🙂', promptFragment: '살짝 웃는 작은 입을 넣어.' },
        { id: 'open', label: '놀란 입', icon: '😮', promptFragment: '동그랗게 벌린 놀란 입을 넣어.' },
        { id: 'tongue', label: '메롱', icon: '😛', promptFragment: '혀를 내민 장난스러운 입을 넣어.' },
        { id: 'many', label: '여러 개 바꿔가며', icon: '🔁', promptFragment: '입 모양을 여러 가지 중에서 눌러 바꿀 수 있게 해.' },
      ],
    },
    // 5 — 머리 위 꾸미기
    {
      id: 'head',
      role: 'decor',
      question: '머리 위에 무엇을 씌울까?',
      options: [
        { id: 'hat', label: '모자', icon: '🧢', promptFragment: '머리 위에 씌울 모자를 넣어.' },
        { id: 'crown', label: '왕관', icon: '👑', promptFragment: '머리 위에 씌울 왕관을 넣어.' },
        { id: 'ribbon', label: '리본', icon: '🎀', promptFragment: '머리 위에 달 리본을 넣어.' },
        { id: 'horn', label: '뿔', icon: '😈', promptFragment: '머리 위에 귀여운 뿔을 넣어.' },
        { id: 'flower', label: '꽃', icon: '🌷', promptFragment: '머리 위에 꽂을 꽃을 넣어.' },
        { id: 'many', label: '골라 씌우게', icon: '🔁', promptFragment: '머리 위 장식(모자·왕관·리본·뿔·꽃 등)을 골라 씌우고 벗길 수 있게 해.' },
      ],
    },
    // 6 — 소품 (multi)
    {
      id: 'accessory',
      role: 'decor',
      question: '어떤 소품으로 꾸밀까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'glasses', label: '안경', icon: '👓', promptFragment: '안경을 씌우고 벗길 수 있게 넣어.' },
        { id: 'scarf', label: '목도리', icon: '🧣', promptFragment: '목도리를 두르고 벗길 수 있게 넣어.' },
        { id: 'badge', label: '배지', icon: '🏅', promptFragment: '가슴에 다는 배지를 넣어.' },
        { id: 'blush', label: '볼터치', icon: '🌸', promptFragment: '발그레한 볼터치를 켜고 끌 수 있게 넣어.' },
        { id: 'sparkle', label: '반짝이', icon: '✨', promptFragment: '주변에 반짝이 장식을 넣어.' },
      ],
    },
    // 7 — 배경
    {
      id: 'bg',
      role: 'decor',
      question: '배경은 어디로 할까?',
      options: [
        { id: 'sky', label: '하늘', icon: '🌤️', promptFragment: '배경을 맑은 하늘로 해.' },
        { id: 'rainbow', label: '무지개', icon: '🌈', promptFragment: '배경에 무지개를 넣어.' },
        { id: 'room', label: '아기자기한 방', icon: '🛏️', promptFragment: '배경을 아기자기한 방으로 해.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '배경을 별이 있는 우주로 해.' },
        { id: 'plain', label: '깔끔한 단색', icon: '⬜', promptFragment: '배경을 깔끔한 단색으로 해.' },
      ],
    },
    // 8 — 바꾸는 방법
    {
      id: 'change',
      role: 'control',
      question: '부품을 어떻게 바꿀까?',
      options: [
        { id: 'buttons', label: '버튼으로 하나씩', icon: '👆', promptFragment: '각 부분마다 "다음/이전" 같은 버튼을 눌러 하나씩 바꾸게 해.' },
        { id: 'palette', label: '보기판에서 골라서', icon: '🎨', promptFragment: '고를 수 있는 부품들을 보기판에 늘어놓고 눌러서 골라 끼우게 해.' },
        { id: 'both', label: '둘 다', icon: '✨', promptFragment: '버튼으로 넘기기와 보기판에서 고르기를 둘 다 할 수 있게 해.' },
      ],
    },
    // 9 — 랜덤/되돌리기
    {
      id: 'random',
      role: 'rule',
      question: '"아무거나 꾸미기" 버튼을 넣을까?',
      options: [
        { id: 'yes', label: '응, 랜덤으로!', icon: '🎲', promptFragment: '누르면 부품이 무작위로 정해져 랜덤 캐릭터가 완성되는 "아무거나 꾸미기" 버튼을 넣어.' },
        { id: 'reset', label: '처음으로 되돌리기만', icon: '↩️', promptFragment: '처음 상태로 되돌리는 "처음부터" 버튼을 넣어.' },
        { id: 'both', label: '둘 다', icon: '✨', promptFragment: '"아무거나 꾸미기" 랜덤 버튼과 "처음부터" 되돌리기 버튼을 둘 다 넣어.' },
      ],
    },
    // 10 — 효과 (multi)
    {
      id: 'effect',
      role: 'output',
      question: '꾸밀 때·완성했을 때 효과를 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'sparkle', label: '반짝 효과', icon: '✨', promptFragment: '부품을 바꿀 때 반짝이는 효과를 넣어.' },
        { id: 'confetti', label: '색종이 팡', icon: '🎊', promptFragment: '"완성!" 버튼을 누르면 색종이가 팡 터지는 효과를 넣어.' },
        { id: 'sound', label: '귀여운 소리', icon: '🔔', promptFragment: '부품을 바꿀 때마다 Web Audio API로 만든 귀여운 소리가 나게 해.' },
        { id: 'pop', label: '통통 튀기', icon: '🏀', promptFragment: '부품이 바뀔 때 캐릭터가 살짝 통통 튀는 애니메이션을 넣어.' },
        { id: 'none', label: '효과 없이', icon: '👍', promptFragment: '' },
      ],
    },
  ],
};
