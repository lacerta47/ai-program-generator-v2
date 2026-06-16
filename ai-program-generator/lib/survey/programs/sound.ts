import type { ProgramType } from '../types';

export const sound: ProgramType = {
  id: 'sound',
  label: '소리놀이',
  icon: '🎵',
  basePrompt:
    '버튼을 누르면 소리가 나는 미니 악기 웹 프로그램을 만들어줘. 소리는 반드시 Web Audio API로만 생성하고 외부 오디오 파일은 쓰지 마. 켜자마자 바로 연주할 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      piano: '나의 피아노',
      xylophone: '나의 실로폰',
      drum: '나의 드럼',
    };
    const instrument = a.instrument;
    return typeof instrument === 'string' && labels[instrument] ? labels[instrument] : '나의 소리놀이';
  },
  steps: [
    {
      id: 'instrument',
      question: '어떤 악기를 만들까?',
      options: [
        { id: 'piano', label: '피아노', icon: '🎹', promptFragment: '건반을 누르면 피아노 소리가 나는 미니 피아노를 만들어. Web Audio로 각 음계 주파수를 맞춰줘.' },
        { id: 'xylophone', label: '실로폰', icon: '🎶', promptFragment: '색깔 막대를 누르면 실로폰 소리가 나는 미니 실로폰을 만들어. Web Audio로 각 음계 주파수를 맞춰줘.' },
        { id: 'drum', label: '드럼', icon: '🥁', promptFragment: '패드를 누르면 드럼 소리(큰북·스네어·하이햇·심벌)가 나는 미니 드럼 패드를 만들어. Web Audio로 소리를 합성해줘.' },
      ],
    },
    {
      id: 'keycount',
      question: '건반이나 버튼을 몇 개 만들까?',
      options: [
        { id: 'small', label: '적게(5개)', icon: '👌', promptFragment: '건반·버튼을 5개로 적게 만들어.' },
        { id: 'medium', label: '보통(8개)', icon: '✋', promptFragment: '건반·버튼을 8개로 만들어.' },
        { id: 'large', label: '많이(13개)', icon: '🙌', promptFragment: '건반·버튼을 13개로 많이 만들어.' },
      ],
    },
    {
      id: 'color',
      question: '건반이나 버튼 색은?',
      options: [
        { id: 'rainbow', label: '무지개', icon: '🌈', promptFragment: '각 건반·버튼을 무지개처럼 다른 색으로 해.' },
        { id: 'mono', label: '흑백', icon: '⬜', promptFragment: '건반·버튼을 흑백으로 해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '건반·버튼을 연한 파스텔 색으로 해.' },
      ],
    },
    {
      id: 'pressfx',
      question: '누를 때 반짝임 효과를 넣을까?',
      options: [
        { id: 'glow', label: '빛나게', icon: '✨', promptFragment: '건반·버튼을 누를 때 그 자리가 밝게 빛나는 효과를 넣어.' },
        { id: 'bounce', label: '통통 튀게', icon: '🏀', promptFragment: '건반·버튼을 누를 때 통통 튀는 애니메이션을 넣어.' },
        { id: 'none', label: '없어도 돼', icon: '🚫', promptFragment: '' },
      ],
    },
    {
      id: 'sheet',
      question: '악보 따라치기 모드를 넣을까?',
      showIf: (a) => a.instrument === 'piano',
      options: [
        { id: 'yes', label: '응, 넣어줘!', icon: '📄', promptFragment: '간단한 동요 악보를 순서대로 보여주고 맞는 건반을 누르면 다음으로 넘어가는 따라치기 모드를 추가해.' },
        { id: 'no', label: '아니, 자유롭게', icon: '🎵', promptFragment: '' },
      ],
    },
    {
      id: 'bg',
      question: '배경은 어떻게 할까?',
      options: [
        { id: 'wood', label: '나무 느낌', icon: '🪵', promptFragment: '배경을 따뜻한 나무 느낌의 갈색 계열로 해.' },
        { id: 'stage', label: '무대 느낌', icon: '🎤', promptFragment: '배경을 어두운 무대 느낌으로 해.' },
        { id: 'sky', label: '하늘색', icon: '🩵', promptFragment: '배경을 맑은 하늘색으로 해.' },
      ],
    },
    {
      id: 'volume',
      question: '소리 크기를 조절하는 버튼을 넣을까?',
      options: [
        { id: 'slider', label: '응, 막대로 조절', icon: '🎚️', promptFragment: '소리 크기를 조절할 수 있는 슬라이더를 넣어.' },
        { id: 'no', label: '아니, 그냥 크게', icon: '🔊', promptFragment: '' },
      ],
    },
    {
      id: 'extra',
      question: '더 재미있는 기능을 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'record', label: '녹음하기', icon: '⏺️', promptFragment: '내가 연주한 걸 녹음했다가 다시 들을 수 있는 버튼을 넣어.' },
        { id: 'echo', label: '메아리 효과', icon: '🌀', promptFragment: '소리에 메아리(딜레이) 효과를 넣는 버튼을 추가해.' },
        { id: 'keyboard', label: '키보드로도 연주', icon: '⌨️', promptFragment: '마우스뿐 아니라 키보드 자판으로도 연주할 수 있게 해.' },
      ],
    },
  ],
};
