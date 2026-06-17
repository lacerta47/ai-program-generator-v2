import type { ProgramType } from '../types';
import { AI_PICK } from '../types';

export const quiz: ProgramType = {
  id: 'quiz',
  label: '퀴즈',
  icon: '❓',
  basePrompt:
    '문제를 하나씩 보여주고 보기 중에 답을 고르면 맞았는지 알려주는 퀴즈 게임 웹 프로그램을 만들어줘. ' +
    '점수를 세고 마지막에 결과를 보여줘. 문제는 예시로 충분히 채워 넣어. ' +
    '켜자마자 바로 시작할 수 있는 완성형으로 만들어.',
  buildName: (a) =>
    typeof a.topic === 'string' && a.topic !== AI_PICK ? `${a.topic} 퀴즈` : '나의 퀴즈',
  steps: [
    // STEP 1 — 주제
    {
      id: 'topic',
      question: '무엇에 대한 퀴즈일까?',
      options: [
        {
          id: '동물',
          label: '동물',
          icon: '🐶',
          promptFragment: '동물 이름·울음소리·사는 곳에 대한 쉬운 퀴즈 문제로 채워줘.',
        },
        {
          id: '음식',
          label: '음식',
          icon: '🍎',
          promptFragment: '음식 이름·재료·나라에 대한 쉬운 퀴즈 문제로 채워줘.',
        },
        {
          id: '숫자',
          label: '숫자·계산',
          icon: '🔢',
          promptFragment: '한 자리 수 더하기·빼기 같은 쉬운 수학 퀴즈로 채워줘.',
        },
        {
          id: '우주',
          label: '우주·별',
          icon: '🚀',
          promptFragment: '행성·달·별자리에 대한 쉬운 우주 퀴즈로 채워줘.',
        },
        {
          id: '공룡',
          label: '공룡',
          icon: '🦕',
          promptFragment: '공룡 이름·크기·먹이·시대에 대한 쉬운 퀴즈로 채워줘.',
        },
        {
          id: '이것저것',
          label: '이것저것',
          icon: '🎲',
          promptFragment: '동물·음식·생활 상식이 섞인 쉬운 상식 퀴즈로 채워줘.',
        },
      ],
    },
    // STEP 2 — 연산 종류 (topic=숫자일 때만) [Chain Level 1]
    {
      id: 'mathtype',
      question: '어떤 계산 문제를 낼까?',
      showIf: (a) => a.topic === '숫자',
      options: [
        {
          id: 'add',
          label: '더하기만',
          icon: '➕',
          promptFragment: '더하기 계산 문제만 출제해.',
        },
        {
          id: 'sub',
          label: '빼기만',
          icon: '➖',
          promptFragment: '빼기 계산 문제만 출제해.',
        },
        {
          id: 'mix',
          label: '더하기 + 빼기',
          icon: '🔀',
          promptFragment: '더하기와 빼기가 섞인 계산 문제를 출제해.',
        },
        {
          id: 'mul',
          label: '곱하기도!',
          icon: '✖️',
          promptFragment: '더하기·빼기·곱하기가 섞인 계산 문제를 출제해.',
        },
      ],
    },
    // STEP 3 — 숫자 범위 (mathtype이 선택된 후) [Chain Level 2]
    {
      id: 'numrange',
      question: '얼마나 큰 숫자로 계산할까?',
      showIf: (a) =>
        typeof a.mathtype === 'string' &&
        ['add', 'sub', 'mix', 'mul'].includes(a.mathtype as string),
      options: [
        {
          id: 'tiny',
          label: '1~5',
          icon: '🐣',
          promptFragment: '계산에 쓰는 숫자는 1~5 범위로 아주 쉽게 만들어.',
        },
        {
          id: 'small',
          label: '1~10',
          icon: '🐥',
          promptFragment: '계산에 쓰는 숫자는 1~10 범위로 만들어.',
        },
        {
          id: 'medium',
          label: '1~20',
          icon: '🐇',
          promptFragment: '계산에 쓰는 숫자는 1~20 범위로 만들어.',
        },
        {
          id: 'big',
          label: '1~100',
          icon: '🦁',
          promptFragment: '계산에 쓰는 숫자는 1~100 범위로 만들어.',
        },
      ],
    },
    // STEP 4 — 문제 수
    {
      id: 'count',
      question: '문제는 몇 개 풀까?',
      options: [
        {
          id: '3',
          label: '3개',
          icon: '3️⃣',
          promptFragment: '퀴즈 문제를 딱 3개 준비해.',
        },
        {
          id: '5',
          label: '5개',
          icon: '5️⃣',
          promptFragment: '퀴즈 문제를 5개 준비해.',
        },
        {
          id: '10',
          label: '10개',
          icon: '🔟',
          promptFragment: '퀴즈 문제를 10개 준비해.',
        },
        {
          id: '15',
          label: '15개',
          icon: '🎯',
          promptFragment: '퀴즈 문제를 15개 준비해.',
        },
      ],
    },
    // STEP 5 — 답 방식
    {
      id: 'answer',
      question: '답은 어떻게 고를까?',
      options: [
        {
          id: 'ox',
          label: 'O / X',
          icon: '⭕',
          promptFragment: '각 문제는 O와 X 두 개 버튼으로 답해.',
        },
        {
          id: 'choice4',
          label: '보기 4개 중 고르기',
          icon: '🔢',
          promptFragment: '각 문제는 보기 4개 버튼 중 하나를 골라 답해.',
        },
        {
          id: 'choice2',
          label: '보기 2개 중 고르기',
          icon: '2️⃣',
          promptFragment: '각 문제는 보기 2개 버튼 중 하나를 골라 답해.',
        },
        {
          id: 'type',
          label: '직접 입력',
          icon: '⌨️',
          promptFragment: '각 문제는 답을 직접 입력하고 확인 버튼을 눌러 제출해.',
        },
        {
          id: 'picture',
          label: '그림 보고 맞히기',
          icon: '🖼️',
          promptFragment: '각 문제는 이모지를 크게 보여주고 그게 무엇인지 보기 중에 골라 답해.',
        },
      ],
    },
    // STEP 6 — 정답 반응 (multi)
    {
      id: 'feedback',
      question: '정답이면 어떤 반응을 줄까? (여러 개 골라도 돼)',
      multi: true,
      options: [
        {
          id: 'sound',
          label: '소리',
          icon: '🔊',
          promptFragment: '정답이면 기분 좋은 소리를, 오답이면 부드러운 소리를 Web Audio로 내줘.',
        },
        {
          id: 'emoji',
          label: '큰 이모지',
          icon: '🎉',
          promptFragment: '정답이면 화면 가득 큰 이모지가 잠깐 뜨는 효과를 넣어.',
        },
        {
          id: 'confetti',
          label: '색종이 폭죽',
          icon: '🎊',
          promptFragment: '정답이면 색종이 조각이 쏟아지는 폭죽 효과를 넣어.',
        },
        {
          id: 'flash',
          label: '화면 번쩍',
          icon: '✨',
          promptFragment: '정답이면 화면이 잠깐 밝게 번쩍이게 해.',
        },
        {
          id: 'shake',
          label: '오답 시 흔들림',
          icon: '😬',
          promptFragment: '오답이면 화면이 잠깐 흔들리는 효과를 넣어.',
        },
      ],
    },
    // STEP 7 — 소리 종류 (feedback에 sound가 포함될 때) [Conditional]
    {
      id: 'soundtype',
      question: '어떤 소리가 날까?',
      showIf: (a) => {
        const f = a.feedback;
        if (Array.isArray(f)) return f.includes('sound');
        return false;
      },
      options: [
        {
          id: 'bell',
          label: '맑은 종소리',
          icon: '🔔',
          promptFragment: '정답 소리는 맑고 높은 종소리(bell) 톤으로 Web Audio로 만들어.',
        },
        {
          id: 'fanfare',
          label: '팡파르',
          icon: '🎺',
          promptFragment: '정답 소리는 짧고 신나는 팡파르 멜로디로 Web Audio로 만들어.',
        },
        {
          id: 'pop',
          label: '뽁뽁 팝',
          icon: '🫧',
          promptFragment: '정답 소리는 귀여운 뽁뽁 팝 소리로 Web Audio로 만들어.',
        },
        {
          id: 'chime',
          label: '차임 멜로디',
          icon: '🎵',
          promptFragment: '정답 소리는 계이름 차임(도레미) 3음 멜로디로 Web Audio로 만들어.',
        },
      ],
    },
    // STEP 8 — 시간 제한
    {
      id: 'timer',
      question: '시간 제한을 넣을까?',
      options: [
        {
          id: 'yes10',
          label: '응, 10초',
          icon: '⏱️',
          promptFragment: '각 문제에 10초 제한과 줄어드는 시간 막대를 넣어.',
        },
        {
          id: 'yes20',
          label: '응, 20초',
          icon: '⏰',
          promptFragment: '각 문제에 20초 제한과 줄어드는 시간 막대를 넣어.',
        },
        {
          id: 'yes30',
          label: '응, 30초',
          icon: '🕰️',
          promptFragment: '각 문제에 30초 제한과 줄어드는 시간 막대를 넣어.',
        },
        {
          id: 'no',
          label: '아니, 천천히',
          icon: '🐢',
          promptFragment: '시간 제한 없이 천천히 풀 수 있게 해.',
        },
      ],
    },
    // STEP 9 — 제한 시간 경고 (timer≠no일 때) [Conditional]
    {
      id: 'timer_warn',
      question: '시간이 얼마 남았을 때 경고를 줄까?',
      showIf: (a) => a.timer !== 'no',
      options: [
        {
          id: 'red',
          label: '빨간색으로 바뀌어요',
          icon: '🔴',
          promptFragment: '남은 시간이 5초 이하가 되면 시간 막대가 빨간색으로 바뀌게 해.',
        },
        {
          id: 'blink',
          label: '깜빡깜빡해요',
          icon: '⚡',
          promptFragment: '남은 시간이 5초 이하가 되면 시간 막대가 깜빡이게 해.',
        },
        {
          id: 'beep',
          label: '삐삐 소리가 나요',
          icon: '🔔',
          promptFragment: '남은 시간이 5초 이하가 되면 1초마다 삐 소리가 나게 Web Audio로 넣어.',
        },
        {
          id: 'none',
          label: '경고 없이 그냥',
          icon: '✅',
          promptFragment: '',
        },
      ],
    },
    // STEP 10 — 목숨 여부
    {
      id: 'lives',
      question: '틀리면 목숨이 줄어들게 할까?',
      options: [
        {
          id: 'yes',
          label: '응, 목숨 있어요',
          icon: '❤️',
          promptFragment: '오답을 내면 목숨이 하나 줄어들고, 목숨이 다 없어지면 퀴즈가 끝나.',
        },
        {
          id: 'no',
          label: '아니, 끝까지 풀어요',
          icon: '🙆',
          promptFragment: '틀려도 목숨 없이 끝까지 모든 문제를 풀 수 있게 해.',
        },
      ],
    },
    // STEP 11 — 목숨 개수 (lives=yes일 때만) [Conditional]
    {
      id: 'lives_count',
      question: '목숨은 몇 개일까?',
      showIf: (a) => a.lives === 'yes',
      options: [
        {
          id: '1',
          label: '1개 (매우 어렵게)',
          icon: '1️⃣',
          promptFragment: '목숨은 딱 1개야. 한 번 틀리면 바로 끝나.',
        },
        {
          id: '3',
          label: '3개 (보통)',
          icon: '3️⃣',
          promptFragment: '목숨은 3개야.',
        },
        {
          id: '5',
          label: '5개 (여유롭게)',
          icon: '5️⃣',
          promptFragment: '목숨은 5개야.',
        },
      ],
    },
    // STEP 12 — 혼자 또는 친구랑
    {
      id: 'playmode',
      question: '퀴즈를 혼자 풀까, 친구랑 번갈아 풀까?',
      options: [
        {
          id: 'solo',
          label: '혼자',
          icon: '🙋',
          promptFragment: '혼자 풀 수 있는 1인 퀴즈 모드로 만들어.',
        },
        {
          id: 'friend',
          label: '친구랑 번갈아',
          icon: '👫',
          promptFragment: '두 사람이 번갈아 문제를 푸는 2인 대전 모드를 추가해. 각자 점수를 따로 세어 마지막에 누가 이겼는지 보여줘.',
        },
      ],
    },
    // STEP 13 — 끝 보상
    {
      id: 'end',
      question: '다 풀면 무엇을 보여줄까?',
      options: [
        {
          id: 'score',
          label: '점수와 칭찬',
          icon: '🏆',
          promptFragment: '마지막에 맞힌 점수와 칭찬 메시지, 다시하기 버튼을 보여줘.',
        },
        {
          id: 'medal',
          label: '금·은·동 메달',
          icon: '🥇',
          promptFragment: '마지막에 점수에 따라 금·은·동 메달 이미지와 메시지, 다시하기 버튼을 보여줘.',
        },
        {
          id: 'star',
          label: '별 모으기',
          icon: '⭐',
          promptFragment: '맞힐 때마다 별을 하나씩 모아서 마지막에 모은 별 개수를 크게 보여줘.',
        },
        {
          id: 'growth',
          label: '식물 키우기',
          icon: '🌱',
          promptFragment: '맞힐 때마다 화면 귀퉁이 식물이 자라서 마지막에 꽃이 활짝 피는 애니메이션을 보여줘.',
        },
      ],
    },
  ],
};
