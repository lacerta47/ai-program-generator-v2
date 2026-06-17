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
      guitar: '나의 기타',
      bell: '나의 벨',
    };
    const instrument = a.instrument;
    return typeof instrument === 'string' && labels[instrument] ? labels[instrument] : '나의 소리놀이';
  },
  steps: [
    // Step 1 — 악기 선택 (A: A→B→C chain)
    {
      id: 'instrument',
      question: '어떤 악기를 만들까?',
      options: [
        {
          id: 'piano',
          label: '피아노',
          icon: '🎹',
          promptFragment:
            '건반을 누르면 피아노 소리가 나는 미니 피아노를 만들어. Web Audio API로 각 음계(도레미파솔라시도)의 정확한 주파수를 맞춰줘.',
        },
        {
          id: 'xylophone',
          label: '실로폰',
          icon: '🎶',
          promptFragment:
            '색깔 막대를 누르면 실로폰 소리가 나는 미니 실로폰을 만들어. Web Audio API로 각 음계 주파수를 맞춰줘.',
        },
        {
          id: 'drum',
          label: '드럼',
          icon: '🥁',
          promptFragment:
            '패드를 누르면 드럼 소리(큰북·스네어·하이햇·심벌)가 나는 미니 드럼 패드를 만들어. Web Audio API로 소리를 합성해줘.',
        },
        {
          id: 'guitar',
          label: '기타',
          icon: '🎸',
          promptFragment:
            '줄을 튕기면 기타 소리가 나는 미니 기타를 만들어. Web Audio API의 Karplus-Strong 알고리즘으로 줄 소리를 합성해줘.',
        },
        {
          id: 'bell',
          label: '마법 벨',
          icon: '🔔',
          promptFragment:
            '누를 때마다 맑은 벨 소리가 나는 마법 벨 버튼들을 만들어. Web Audio API로 맑은 사인파 벨 소리를 합성해줘.',
        },
        {
          id: 'animal',
          label: '동물 소리 버튼',
          icon: '🐸',
          promptFragment:
            '버튼마다 동물 소리가 나는 동물 소리판을 만들어. 🐄 소 울음·🐸 개구리·🦊 여우·🐧 펭귄 등 다양한 동물 버튼을 넣고, Web Audio API로 각 동물 특유의 음색을 합성해줘. 버튼에 동물 이모지를 크게 표시해.',
        },
      ],
    },

    // Step 2 — 피아노 연주 모드 (B in A→B→C chain: shows when instrument===piano)
    {
      id: 'playmode',
      question: '피아노를 어떻게 연주할까?',
      showIf: (a) => a.instrument === 'piano',
      options: [
        {
          id: 'free',
          label: '자유롭게',
          icon: '🎵',
          promptFragment: '마음대로 자유롭게 연주하는 자유 연주 모드로 만들어.',
        },
        {
          id: 'follow',
          label: '따라치기',
          icon: '📄',
          promptFragment: '화면에 음계 순서를 보여주고 그대로 따라치는 따라치기 모드로 만들어.',
        },
        {
          id: 'both',
          label: '둘 다',
          icon: '🎼',
          promptFragment: '자유 연주 모드와 따라치기 모드를 버튼으로 전환할 수 있게 만들어.',
        },
      ],
    },

    // Step 3 — 따라치기 연습곡 (C in 2-level chain: shows when playmode===follow or both)
    {
      id: 'songslist',
      question: '어떤 동요를 따라칠까?',
      showIf: (a) => a.playmode === 'follow' || a.playmode === 'both',
      options: [
        {
          id: 'twinkle',
          label: '반짝반짝 작은 별',
          icon: '⭐',
          promptFragment: '따라치기 곡으로 "반짝반짝 작은 별" 음계를 넣어줘.',
        },
        {
          id: 'nabiya',
          label: '나비야',
          icon: '🦋',
          promptFragment: '따라치기 곡으로 "나비야" 음계를 넣어줘.',
        },
        {
          id: 'threebears',
          label: '곰 세 마리',
          icon: '🐻',
          promptFragment: '따라치기 곡으로 "곰 세 마리" 음계를 넣어줘.',
        },
        {
          id: 'all',
          label: '여러 곡 고르게',
          icon: '🎵',
          promptFragment: '따라치기 곡을 여러 개(반짝반짝 작은 별·나비야·곰 세 마리) 넣고 선택해서 연습하게 해줘.',
        },
      ],
    },

    // Step 4 — 건반·버튼 수
    {
      id: 'keycount',
      question: '건반이나 버튼을 몇 개 만들까?',
      options: [
        { id: 'small', label: '적게 (5개)', icon: '👌', promptFragment: '건반·버튼을 5개로 적게 만들어.' },
        { id: 'medium', label: '보통 (8개)', icon: '✋', promptFragment: '건반·버튼을 8개로 만들어.' },
        { id: 'large', label: '많이 (13개)', icon: '🙌', promptFragment: '건반·버튼을 13개로 많이 만들어.' },
        { id: 'two_octaves', label: '두 옥타브 (16개)', icon: '🎹', promptFragment: '건반·버튼을 두 옥타브(16개)로 만들어.' },
      ],
    },

    // Step 5 — 색
    {
      id: 'color',
      question: '건반이나 버튼 색은?',
      options: [
        { id: 'rainbow', label: '무지개', icon: '🌈', promptFragment: '각 건반·버튼을 무지개처럼 다른 색으로 해.' },
        { id: 'mono', label: '흑백', icon: '⬜', promptFragment: '건반·버튼을 흑백으로 해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '건반·버튼을 연한 파스텔 색으로 해.' },
        { id: 'neon', label: '네온 색', icon: '💡', promptFragment: '건반·버튼을 형광 네온 색으로 해.' },
        { id: 'wood', label: '나무 느낌', icon: '🪵', promptFragment: '건반·버튼을 따뜻한 나무 느낌 색으로 해.' },
      ],
    },

    // Step 6 — 누를 때 효과 (multi)
    {
      id: 'pressfx',
      question: '누를 때 어떤 효과를 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'glow', label: '빛나게', icon: '✨', promptFragment: '건반·버튼을 누를 때 그 자리가 밝게 빛나는 효과를 넣어.' },
        { id: 'bounce', label: '통통 튀게', icon: '🏀', promptFragment: '건반·버튼을 누를 때 통통 튀는 애니메이션을 넣어.' },
        { id: 'ripple', label: '물결 퍼지게', icon: '🌊', promptFragment: '건반·버튼을 누를 때 물결이 퍼지는 효과를 넣어.' },
        { id: 'star', label: '별 튀어나오게', icon: '⭐', promptFragment: '건반·버튼을 누를 때 별이 튀어나오는 효과를 넣어.' },
        { id: 'animemoji', label: '동물 이모지 튀어나오기', icon: '🐸', promptFragment: '건반·버튼을 누를 때 🐸🐶🐱🐰 같은 동물 이모지가 팡 하고 튀어나왔다 사라지는 효과를 넣어.' },
      ],
    },

    // Step 7 — 소리 크기 조절
    {
      id: 'volume',
      question: '소리 크기를 조절하는 버튼을 넣을까?',
      options: [
        { id: 'buttons', label: '크게/작게 버튼', icon: '🔊', promptFragment: '🔊 크게·🔉 작게 버튼 두 개로 소리를 조절할 수 있게 넣어.' },
        { id: 'no', label: '그냥 크게', icon: '📢', promptFragment: '' },
      ],
    },

    // Step 8 — 배경
    {
      id: 'bg',
      question: '배경은 어떻게 할까?',
      options: [
        { id: 'wood', label: '나무 느낌', icon: '🪵', promptFragment: '배경을 따뜻한 나무 느낌의 갈색 계열로 해.' },
        { id: 'stage', label: '무대 느낌', icon: '🎤', promptFragment: '배경을 어두운 무대 느낌으로 해.' },
        { id: 'sky', label: '하늘색', icon: '🩵', promptFragment: '배경을 맑은 하늘색으로 해.' },
        { id: 'dark', label: '어두운 밤', icon: '🌙', promptFragment: '배경을 어두운 밤 하늘 색으로 해.' },
        { id: 'pastel', label: '파스텔 분홍', icon: '🌸', promptFragment: '배경을 연한 파스텔 분홍으로 해.' },
      ],
    },

    // Step 9 — 녹음 기능
    {
      id: 'record',
      question: '내 연주를 다시 들어볼까?',
      options: [
        { id: 'yes', label: '응, 다시 들려줘!', icon: '▶️', promptFragment: '내가 연주한 걸 녹음했다가 ▶️ 버튼 하나로 다시 들을 수 있는 기능을 넣어.' },
        { id: 'no', label: '괜찮아', icon: '🎵', promptFragment: '' },
      ],
    },

    // Step 11 — 점수·별 모으기
    {
      id: 'score',
      question: '연주를 잘 하면 별이나 점수를 줄까?',
      options: [
        { id: 'stars', label: '별 모으기', icon: '⭐', promptFragment: '올바른 음을 누를 때마다 별을 모아 화면에 보여주는 기능을 넣어.' },
        { id: 'points', label: '점수 올리기', icon: '🔢', promptFragment: '올바른 음을 누를 때마다 점수가 올라가는 기능을 넣어.' },
        { id: 'none', label: '점수 없이', icon: '🎵', promptFragment: '' },
      ],
    },

    // Step 11 (renumbered) — 추가 기능 (multi)
    {
      id: 'extra',
      question: '더 재미있는 기능을 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'echo', label: '메아리 효과', icon: '🌀', promptFragment: '소리에 메아리(딜레이) 효과를 넣는 버튼을 추가해.' },
        { id: 'clap', label: '박수 챌린지 — 빛나는 리듬 따라 두드리기', icon: '👏', promptFragment: '화면에 빛나는 리듬 패턴이 표시되고 박수(클릭/탭)로 따라 치는 박수 챌린지 모드를 넣어.' },
        { id: 'nothing', label: '없어도 돼', icon: '👍', promptFragment: '' },
      ],
    },
  ],
};
