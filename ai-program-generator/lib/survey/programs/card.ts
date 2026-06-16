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
      ],
    },
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
      ],
    },
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
      ],
    },
    {
      id: 'motion',
      question: '움직임을 넣을까?',
      options: [
        {
          id: 'float',
          label: '둥둥 떠다니게',
          icon: '🫧',
          promptFragment: '장식 요소들이 천천히 둥둥 떠다니는 CSS 애니메이션을 넣어.',
        },
        {
          id: 'pop',
          label: '눌러서 효과',
          icon: '👆',
          promptFragment: '카드를 클릭하면 색종이가 터지는 효과를 넣어.',
        },
        {
          id: 'spin',
          label: '빙글빙글',
          icon: '🌀',
          promptFragment: '장식 요소 일부가 천천히 빙글빙글 도는 애니메이션을 넣어.',
        },
        {
          id: 'none',
          label: '조용하게',
          icon: '🤫',
          promptFragment: '',
        },
      ],
    },
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
    {
      id: 'name',
      question: '카드에 이름을 적는 칸을 넣을까?',
      options: [
        {
          id: 'yes',
          label: '응, 직접 쓸게',
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
    {
      id: 'pattern',
      question: '카드 배경 무늬는?',
      options: [
        {
          id: 'polka',
          label: '물방울 무늬',
          icon: '🔵',
          promptFragment: '카드 배경에 귀여운 물방울 무늬(폴카닷)를 넣어.',
        },
        {
          id: 'stripe',
          label: '줄무늬',
          icon: '🟧',
          promptFragment: '카드 배경에 예쁜 줄무늬 패턴을 넣어.',
        },
        {
          id: 'gradient',
          label: '그러데이션',
          icon: '🌅',
          promptFragment: '카드 배경을 두 가지 색이 부드럽게 섞인 그러데이션으로 해.',
        },
        {
          id: 'plain',
          label: '무늬 없이 단색',
          icon: '⬜',
          promptFragment: '카드 배경은 깔끔한 단색으로 해.',
        },
      ],
    },
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
          id: 'no',
          label: '아니, 별만',
          icon: '⭐',
          promptFragment: '',
        },
      ],
    },
  ],
};
