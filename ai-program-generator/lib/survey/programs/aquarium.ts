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
    };
    const place = a.place;
    return typeof place === 'string' && labels[place] ? labels[place] : '나의 디지털 수족관';
  },
  steps: [
    {
      id: 'place',
      question: '어디를 배경으로 만들까?',
      options: [
        { id: 'sea', label: '바닷속', icon: '🌊', promptFragment: '바닷속 배경으로 만들어. 물속 느낌을 줘.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '우주 배경으로 만들어. 별이 가득한 우주 느낌을 줘.' },
        { id: 'forest', label: '숲속 연못', icon: '🌿', promptFragment: '숲속 연못 배경으로 만들어. 초록색 자연 느낌을 줘.' },
      ],
    },
    {
      id: 'creatures',
      question: '무엇이 떠다닐까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'fish', label: '물고기', icon: '🐟', promptFragment: '색깔 물고기들이 유유히 헤엄쳐 다니게 해.' },
        { id: 'jellyfish', label: '해파리', icon: '🪼', promptFragment: '반투명 해파리가 둥둥 위아래로 떠다니게 해.' },
        { id: 'star', label: '별', icon: '⭐', promptFragment: '반짝이는 별들이 천천히 떠다니게 해.' },
        { id: 'bubble', label: '거품', icon: '🫧', promptFragment: '투명한 거품들이 아래에서 위로 올라가게 해.' },
      ],
    },
    {
      id: 'count',
      question: '얼마나 많이 떠다닐까?',
      options: [
        { id: 'few', label: '적게', icon: '1️⃣', promptFragment: '5마리·개 정도로 적게 떠다니게 해.' },
        { id: 'medium', label: '보통', icon: '5️⃣', promptFragment: '10마리·개 정도로 적당히 떠다니게 해.' },
        { id: 'many', label: '많이', icon: '🔢', promptFragment: '20마리·개 이상 가득 떠다니게 해.' },
      ],
    },
    {
      id: 'speed',
      question: '움직임 속도는 어떻게 할까?',
      options: [
        { id: 'slow', label: '천천히', icon: '🐢', promptFragment: '생물들이 느릿느릿 천천히 움직이게 해.' },
        { id: 'normal', label: '보통', icon: '🐠', promptFragment: '생물들이 자연스러운 속도로 움직이게 해.' },
        { id: 'fast', label: '신나게 빠르게', icon: '🐟', promptFragment: '생물들이 빠르게 신나게 움직이게 해.' },
      ],
    },
    {
      id: 'bgcolor',
      question: '배경 색은 어떻게 할까?',
      options: [
        { id: 'deep', label: '깊은 파란색', icon: '💙', promptFragment: '배경을 깊은 바다 같은 진한 파란색으로 해.' },
        { id: 'light', label: '연한 하늘색', icon: '🩵', promptFragment: '배경을 연한 하늘색으로 밝게 해.' },
        { id: 'dark', label: '어두운 밤색', icon: '🌑', promptFragment: '배경을 어두운 밤 색으로 해.' },
        { id: 'gradient', label: '그라데이션', icon: '🌅', promptFragment: '배경을 위아래가 색이 다른 그라데이션으로 해.' },
      ],
    },
    {
      id: 'click',
      question: '클릭하면 어떤 일이 일어날까?',
      options: [
        { id: 'feed', label: '먹이 주기', icon: '🍬', promptFragment: '화면을 클릭하면 그 자리에 먹이가 생기고 근처 생물이 다가오게 해.' },
        { id: 'spawn', label: '한 마리 늘기', icon: '➕', promptFragment: '화면을 클릭하면 그 자리에서 새 생물 하나가 생겨나게 해.' },
        { id: 'flash', label: '반짝 빛나기', icon: '✨', promptFragment: '화면을 클릭하면 그 자리에서 반짝이는 빛 효과가 나게 해.' },
      ],
    },
    {
      id: 'sound',
      question: '배경 소리를 넣을까?',
      options: [
        { id: 'wave', label: '물 소리', icon: '🌊', promptFragment: '배경에 Web Audio로 조용한 물 흐르는 소리를 넣어.' },
        { id: 'bubble', label: '거품 소리', icon: '🫧', promptFragment: '배경에 Web Audio로 거품 올라오는 소리를 넣어.' },
        { id: 'none', label: '조용하게', icon: '🔇', promptFragment: '' },
      ],
    },
    {
      id: 'meteor',
      question: '별똥별이 지나가게 할까?',
      showIf: (a) => a.place === 'space',
      options: [
        { id: 'yes', label: '응, 가끔씩!', icon: '🌠', promptFragment: '가끔씩 별똥별이 화면을 가로질러 빠르게 지나가는 효과를 넣어.' },
        { id: 'no', label: '아니, 별만', icon: '⭐', promptFragment: '' },
      ],
    },
  ],
};
