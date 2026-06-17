import type { ProgramType } from '../types';

export const card: ProgramType = {
  id: 'card',
  label: '소개·인사 카드',
  icon: '💌',
  basePrompt:
    '나를 소개하거나 친구에게 인사를 전하는 예쁜 한 페이지 카드 웹 프로그램을 만들어줘. ' +
    '화면 가운데에 카드가 보이고 꾸밈 요소가 어울리게 배치돼. 켜자마자 완성된 카드를 바로 볼 수 있게 해.',
  buildName: () => '나의 소개 카드',
  steps: [
    // Step 1 — 카드 종류
    {
      id: 'kind',
      question: '어떤 카드를 만들까?',
      options: [
        {
          id: 'me',
          label: '내 소개',
          icon: '🙋',
          promptFragment: '내 이름·좋아하는 것·꿈을 소개하는 카드.',
        },
        {
          id: 'hello',
          label: '인사·생일 축하',
          icon: '🎈',
          promptFragment: '친구에게 생일 축하나 반가운 인사를 전하는 카드.',
        },
        {
          id: 'thanks',
          label: '고마워 카드',
          icon: '🙏',
          promptFragment: '고마운 마음을 전하는 감사 카드.',
        },
        {
          id: 'cheer',
          label: '응원 카드',
          icon: '📣',
          promptFragment: '힘내라는 응원 메시지를 전하는 카드.',
        },
        {
          id: 'season',
          label: '계절·명절 카드',
          icon: '🎄',
          promptFragment: '봄·여름·가을·겨울·명절 분위기가 나는 카드.',
        },
        {
          id: 'love',
          label: '사랑해 카드',
          icon: '❤️',
          promptFragment: '사랑하는 마음을 전하는 따뜻한 카드.',
        },
      ],
    },

    // Step 2 — 내 소개 항목 (kind==='me' 일 때만, multi)
    {
      id: 'meinfo',
      question: '소개하고 싶은 게 뭐야? (여러 개 골라도 돼)',
      multi: true,
      showIf: (a) => a.kind === 'me',
      options: [
        {
          id: 'name',
          label: '이름',
          icon: '🏷️',
          promptFragment: '카드에 내 이름을 크게 써줘.',
        },
        {
          id: 'fav',
          label: '좋아하는 것',
          icon: '💛',
          promptFragment: '카드에 내가 좋아하는 것을 표시해줘.',
        },
        {
          id: 'dream',
          label: '꿈',
          icon: '🌙',
          promptFragment: '카드에 내 꿈(장래희망)을 써줘.',
        },
        {
          id: 'age',
          label: '나이·학년',
          icon: '🎂',
          promptFragment: '카드에 내 나이나 학년을 표시해줘.',
        },
        {
          id: 'hobby',
          label: '좋아하는 놀이',
          icon: '🎨',
          promptFragment: '카드에 내가 좋아하는 놀이를 적어줘.',
        },
      ],
    },

    // Step 3 — 좋아하는 것 종류 (Chain A→B: meinfo includes 'fav') [2-level chain 시작]
    {
      id: 'favkind',
      question: '좋아하는 게 뭐야?',
      showIf: (a) => {
        const v = a.meinfo;
        return Array.isArray(v) && v.includes('fav');
      },
      options: [
        {
          id: 'food',
          label: '음식',
          icon: '🍕',
          promptFragment: '카드에 내가 좋아하는 음식을 넣어줘.',
        },
        {
          id: 'animal',
          label: '동물',
          icon: '🐶',
          promptFragment: '카드에 내가 좋아하는 동물을 넣어줘.',
        },
        {
          id: 'sport',
          label: '운동·놀이',
          icon: '⚽',
          promptFragment: '카드에 내가 좋아하는 운동이나 놀이를 넣어줘.',
        },
        {
          id: 'color',
          label: '색깔',
          icon: '🎨',
          promptFragment: '카드에 내가 좋아하는 색깔을 강조해서 넣어줘.',
        },
        {
          id: 'character',
          label: '캐릭터',
          icon: '🦸',
          promptFragment: '카드에 내가 좋아하는 캐릭터를 넣어줘.',
        },
      ],
    },

    // Step 4 — 좋아하는 동물 세부 (Chain B→C: favkind==='animal') [2-level chain 완성]
    {
      id: 'animaldetail',
      question: '어떤 동물을 좋아해?',
      showIf: (a) => a.favkind === 'animal',
      options: [
        {
          id: 'dog',
          label: '강아지',
          icon: '🐶',
          promptFragment: '카드에 귀여운 강아지 그림과 강아지 발자국 장식을 넣어줘.',
        },
        {
          id: 'cat',
          label: '고양이',
          icon: '🐱',
          promptFragment: '카드에 귀여운 고양이 그림과 고양이 발자국 장식을 넣어줘.',
        },
        {
          id: 'rabbit',
          label: '토끼',
          icon: '🐰',
          promptFragment: '카드에 귀여운 토끼 그림과 당근 장식을 넣어줘.',
        },
        {
          id: 'dino',
          label: '공룡',
          icon: '🦕',
          promptFragment: '카드에 귀여운 공룡 그림을 크게 그려 넣어줘.',
        },
        {
          id: 'panda',
          label: '판다',
          icon: '🐼',
          promptFragment: '카드에 귀여운 판다 그림과 대나무 장식을 넣어줘.',
        },
      ],
    },

    // Step 5 — 카드 분위기
    {
      id: 'theme',
      question: '카드 분위기는?',
      options: [
        {
          id: 'cute',
          label: '귀엽게',
          icon: '🧸',
          promptFragment: '둥글둥글 귀엽고 따뜻한 분위기, 파스텔 색으로 꾸며.',
        },
        {
          id: 'cool',
          label: '멋있게',
          icon: '🦖',
          promptFragment: '쨍하고 멋있는 분위기, 진하고 강렬한 색으로 꾸며.',
        },
        {
          id: 'space',
          label: '우주',
          icon: '🚀',
          promptFragment: '밤하늘·별·은하 우주 분위기로 꾸며.',
        },
        {
          id: 'nature',
          label: '자연·숲',
          icon: '🌿',
          promptFragment: '나무·꽃·풀이 있는 싱그러운 자연 분위기로 꾸며.',
        },
        {
          id: 'ocean',
          label: '바다',
          icon: '🌊',
          promptFragment: '파란 바다·파도·물고기 분위기로 꾸며.',
        },
      ],
    },

    // Step 6 — 우주 추가 효과 (theme==='space', Chain A)
    {
      id: 'shooting',
      question: '별똥별이 쏟아지는 효과를 넣을까?',
      showIf: (a) => a.theme === 'space',
      options: [
        {
          id: 'yes',
          label: '응, 별똥별!',
          icon: '🌠',
          promptFragment: '배경에 별똥별이 위에서 아래로 빠르게 떨어지는 CSS 애니메이션을 여러 개 넣어.',
        },
        {
          id: 'planet',
          label: '행성도 넣어줘',
          icon: '🪐',
          promptFragment: '배경에 행성과 위성이 천천히 돌아다니는 CSS 애니메이션을 넣어.',
        },
        {
          id: 'no',
          label: '아니, 별만',
          icon: '⭐',
          promptFragment: '',
        },
      ],
    },

    // Step 7 — 꾸미기 (multi)
    {
      id: 'deco',
      question: '무엇으로 꾸밀까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'balloon',
          label: '풍선',
          icon: '🎈',
          promptFragment: '알록달록 풍선이 떠다니는 장식을 넣어.',
        },
        {
          id: 'star',
          label: '반짝이 별',
          icon: '✨',
          promptFragment: '반짝이는 별 장식을 넣어.',
        },
        {
          id: 'flower',
          label: '꽃',
          icon: '🌷',
          promptFragment: '예쁜 꽃 장식을 넣어.',
        },
        {
          id: 'heart',
          label: '하트',
          icon: '💖',
          promptFragment: '하트 장식을 넣어.',
        },
        {
          id: 'rainbow',
          label: '무지개',
          icon: '🌈',
          promptFragment: '무지개 장식을 넣어.',
        },
        {
          id: 'cloud',
          label: '구름',
          icon: '☁️',
          promptFragment: '솜사탕 같은 구름 장식을 넣어.',
        },
      ],
    },

    // Step 8 — 꾸밈 움직임 (deco가 하나라도 선택됐을 때)
    {
      id: 'decomotion',
      question: '꾸밈 장식을 어떻게 움직일까?',
      showIf: (a) => {
        const v = a.deco;
        return Array.isArray(v) && v.length > 0;
      },
      options: [
        {
          id: 'float',
          label: '둥둥 떠다니게',
          icon: '🫧',
          promptFragment: '장식 요소들이 천천히 둥둥 떠다니는 CSS 애니메이션을 넣어.',
        },
        {
          id: 'spin',
          label: '빙글빙글',
          icon: '🌀',
          promptFragment: '장식 요소 일부가 천천히 빙글빙글 도는 애니메이션을 넣어.',
        },
        {
          id: 'bounce',
          label: '통통 튕기게',
          icon: '🏀',
          promptFragment: '장식 요소들이 통통 튕기는 CSS 애니메이션을 넣어.',
        },
        {
          id: 'still',
          label: '그냥 가만히',
          icon: '🤫',
          promptFragment: '',
        },
      ],
    },

    // Step 9 — 카드 클릭 효과
    {
      id: 'clickfx',
      question: '카드를 눌렀을 때 어떤 효과를 넣을까?',
      options: [
        {
          id: 'pop',
          label: '색종이 팡!',
          icon: '🎊',
          promptFragment: '카드를 클릭하면 색종이가 터지는 효과를 넣어.',
        },
        {
          id: 'heart',
          label: '하트가 뿅!',
          icon: '💗',
          promptFragment: '카드를 클릭하면 하트가 여러 개 튀어나오는 효과를 넣어.',
        },
        {
          id: 'shine',
          label: '반짝 빛나게',
          icon: '⚡',
          promptFragment: '카드를 클릭하면 카드 전체가 잠깐 빛나는 효과를 넣어.',
        },
        {
          id: 'firework',
          label: '폭죽 펑펑',
          icon: '🎇',
          promptFragment: '카드를 클릭하면 폭죽이 펑펑 터지는 효과를 넣어.',
        },
        {
          id: 'none',
          label: '효과 없이',
          icon: '🙅',
          promptFragment: '',
        },
      ],
    },

    // Step 10 — 소리
    {
      id: 'music',
      question: '소리도 넣을까?',
      options: [
        {
          id: 'yes',
          label: '응, 짧은 멜로디',
          icon: '🎵',
          promptFragment: '카드를 열면 Web Audio API로 밝고 짧은 멜로디가 자동으로 나게 해.',
        },
        {
          id: 'click',
          label: '누를 때 소리',
          icon: '🔔',
          promptFragment: '카드나 꾸밈 요소를 클릭할 때마다 귀여운 소리가 나게 해.',
        },
        {
          id: 'no',
          label: '조용하게',
          icon: '🔇',
          promptFragment: '',
        },
      ],
    },

    // Step 11 — 소리 분위기 (music==='yes' 일 때)
    {
      id: 'musicmood',
      question: '어떤 분위기 소리가 좋아?',
      showIf: (a) => a.music === 'yes',
      options: [
        {
          id: 'happy',
          label: '신나게',
          icon: '🥳',
          promptFragment: 'Web Audio로 신나고 빠른 느낌의 짧은 멜로디를 만들어.',
        },
        {
          id: 'soft',
          label: '잔잔하게',
          icon: '🌙',
          promptFragment: 'Web Audio로 잔잔하고 따뜻한 느낌의 짧은 멜로디를 만들어.',
        },
        {
          id: 'cute',
          label: '귀엽게',
          icon: '🐥',
          promptFragment: 'Web Audio로 높고 귀여운 느낌의 짧은 멜로디를 만들어.',
        },
        {
          id: 'grand',
          label: '웅장하게',
          icon: '🎺',
          promptFragment: 'Web Audio로 힘차고 웅장한 느낌의 짧은 멜로디를 만들어.',
        },
      ],
    },

    // Step 12 — 이름 칸
    {
      id: 'nameField',
      question: '카드에 이름을 적는 칸을 넣을까?',
      options: [
        {
          id: 'yes',
          label: '응, 내 이름 쓸래!✏️',
          icon: '✏️',
          promptFragment: '카드 안에서 이름과 한 줄 메시지를 직접 클릭해 입력하고 바꿀 수 있는 칸을 넣어.',
        },
        {
          id: 'no',
          label: '아니, 그림만',
          icon: '🖼️',
          promptFragment: '',
        },
      ],
    },

    // Step 13 — 글씨체 (nameField==='yes')
    {
      id: 'font',
      question: '글씨체는 어떤 게 좋아?',
      showIf: (a) => a.nameField === 'yes',
      options: [
        {
          id: 'round',
          label: '동글동글',
          icon: '🫧',
          promptFragment: '이름 글씨를 동글동글 귀여운 폰트로 해.',
        },
        {
          id: 'bold',
          label: '굵고 시원하게',
          icon: '🖊️',
          promptFragment: '이름 글씨를 굵고 시원한 폰트로 해.',
        },
        {
          id: 'fancy',
          label: '화려하게',
          icon: '🌟',
          promptFragment: '이름 글씨를 화려하고 예쁜 폰트로 해.',
        },
        {
          id: 'handwrite',
          label: '손글씨 느낌',
          icon: '✍️',
          promptFragment: '이름 글씨를 손글씨 느낌의 폰트로 해.',
        },
      ],
    },

    // Step 14 — 배경 (무늬+색 통합)
    {
      id: 'background',
      question: '배경은 어떻게 할까?',
      options: [
        {
          id: 'pink_polka',
          label: '분홍 물방울',
          icon: '🌸',
          promptFragment: '카드 배경을 따뜻한 분홍 계열에 귀여운 물방울 무늬(폴카닷)로 꾸며.',
        },
        {
          id: 'blue_stripe',
          label: '파란 줄무늬',
          icon: '💙',
          promptFragment: '카드 배경을 시원한 파랑 계열에 예쁜 줄무늬 패턴으로 꾸며.',
        },
        {
          id: 'yellow_gradient',
          label: '노란 그러데이션',
          icon: '☀️',
          promptFragment: '카드 배경을 밝은 노랑 계열의 부드러운 그러데이션으로 해.',
        },
        {
          id: 'plain',
          label: '단색 깔끔하게',
          icon: '⬜',
          promptFragment: '카드 배경은 깔끔한 단색으로 해.',
        },
        {
          id: 'star_bg',
          label: '별이 가득',
          icon: '🌟',
          promptFragment: '카드 배경에 반짝이는 별이 가득한 패턴을 넣어.',
        },
      ],
    },
  ],
};
