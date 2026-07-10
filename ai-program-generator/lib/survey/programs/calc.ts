import type { ProgramType } from '../types';

export const calc: ProgramType = {
  id: 'calc',
  label: '숫자놀이·계산기',
  icon: '🔢',
  basePrompt:
    '버튼을 눌러 숫자를 다루는 웹 프로그램을 만들어줘. 아이들이 켜자마자 바로 쓸 수 있게 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      calc: '나의 계산기',
      guess: '숫자 맞히기 게임',
      times: '구구단 연습기',
      speed: '빠른 셈 게임',
      animal: '동물 세기 게임',
    };
    const mode = a.mode;
    return typeof mode === 'string' && labels[mode] ? labels[mode] : '나의 숫자놀이';
  },
  steps: [
    // Step 1 — 종류
    {
      id: 'mode',
      role: 'type',
      question: '어떤 숫자놀이를 만들까?',
      options: [
        { id: 'calc', label: '계산기', icon: '🧮', promptFragment: '더하기·빼기·곱하기·나누기를 할 수 있는 계산기를 만들어.' },
        { id: 'guess', label: '숫자 맞히기 게임', icon: '🎯', promptFragment: '컴퓨터가 숫자를 하나 정하면 내가 맞혀야 하는 숫자 맞히기 게임을 만들어. 더 큰지 작은지 힌트를 줘.' },
        { id: 'times', label: '구구단 연습', icon: '✖️', promptFragment: '구구단 문제를 하나씩 내고 답을 맞히면 점수가 올라가는 구구단 연습 프로그램을 만들어.' },
        { id: 'speed', label: '빠른 셈 게임', icon: '⚡', promptFragment: '제한 시간 안에 간단한 덧셈·뺄셈 문제를 최대한 많이 맞히는 빠른 셈 게임을 만들어.' },
        { id: 'animal', label: '동물 세기 게임', icon: '🐶', promptFragment: '화면에 동물이 나타나면 개수를 세어 맞히는 동물 세기 게임을 만들어.' },
      ],
    },

    // Step 2 — 범위 (mode==='guess', Chain A)
    {
      id: 'range',
      role: 'rule',
      question: '어떤 범위 숫자를 맞힐까?',
      showIf: (a) => a.mode === 'guess',
      options: [
        { id: 'r10', label: '1부터 10', icon: '🔟', promptFragment: '숫자 범위를 1~10으로 해.' },
        { id: 'r50', label: '1부터 50', icon: '5️⃣', promptFragment: '숫자 범위를 1~50으로 해.' },
        { id: 'r100', label: '1부터 100', icon: '💯', promptFragment: '숫자 범위를 1~100으로 해.' },
        { id: 'r1000', label: '1부터 1000', icon: '🔑', promptFragment: '숫자 범위를 1~1000으로 해.' },
      ],
    },

    // Step 3 — 힌트 방식 (Chain B: range 값이 있을 때) [2-level chain 완성]
    {
      id: 'hint',
      role: 'rule',
      question: '힌트를 어떻게 줄까?',
      showIf: (a) =>
        a.range === 'r50' || a.range === 'r100' || a.range === 'r1000',
      options: [
        { id: 'updown', label: '크다/작다만', icon: '⬆️', promptFragment: '정답보다 크면 "더 작아요", 작으면 "더 커요" 메시지를 줘.' },
        { id: 'warm', label: '뜨겁다/차갑다', icon: '🔥', promptFragment: '정답에 가까울수록 "뜨거워요!", 멀면 "차가워요!" 힌트를 줘.' },
        { id: 'steps', label: '몇 단계나 남았는지', icon: '🪜', promptFragment: '정답까지 10단위 혹은 5단위 등 범위로 힌트를 줘. (예: 50~60 사이에 있어요)' },
        { id: 'count', label: '시도 횟수만 알려줘', icon: '🔢', promptFragment: '힌트 없이 지금까지 몇 번 시도했는지만 보여줘.' },
        { id: 'emoji', label: '이모지로 알려줘', icon: '😱', promptFragment: '정답에서 멀면 😱, 가까울수록 😄 이모지로 힌트를 줘.' },
      ],
    },

    // Step 4 — 연습할 단 (mode==='times', multi)
    {
      id: 'timesdan',
      role: 'goal',
      question: '몇 단을 연습할까? (여러 개 골라도 돼)',
      multi: true,
      showIf: (a) => a.mode === 'times',
      options: [
        { id: 'd2', label: '2단', icon: '2️⃣', promptFragment: '2단 문제를 포함해.' },
        { id: 'd3', label: '3단', icon: '3️⃣', promptFragment: '3단 문제를 포함해.' },
        { id: 'd4', label: '4단', icon: '4️⃣', promptFragment: '4단 문제를 포함해.' },
        { id: 'd5', label: '5단', icon: '5️⃣', promptFragment: '5단 문제를 포함해.' },
        { id: 'd6', label: '6단', icon: '6️⃣', promptFragment: '6단 문제를 포함해.' },
        { id: 'd7', label: '7단', icon: '7️⃣', promptFragment: '7단 문제를 포함해.' },
        { id: 'd8', label: '8단', icon: '8️⃣', promptFragment: '8단 문제를 포함해.' },
        { id: 'd9', label: '9단', icon: '9️⃣', promptFragment: '9단 문제를 포함해.' },
      ],
    },

    // Step 5 — 계산기 연산 종류 (mode==='calc', multi)
    {
      id: 'ops',
      role: 'goal',
      question: '어떤 계산을 넣을까? (여러 개 OK)',
      multi: true,
      showIf: (a) => a.mode === 'calc',
      options: [
        { id: 'add', label: '더하기 ＋', icon: '➕', promptFragment: '더하기 기능을 넣어.' },
        { id: 'sub', label: '빼기 －', icon: '➖', promptFragment: '빼기 기능을 넣어.' },
        { id: 'mul', label: '곱하기 ×', icon: '✖️', promptFragment: '곱하기 기능을 넣어.' },
        { id: 'div', label: '나누기 ÷', icon: '➗', promptFragment: '나누기 기능을 넣어.' },
        { id: 'pct', label: '퍼센트 ％', icon: '💯', promptFragment: '퍼센트 기능을 넣어.' },
      ],
    },

    // Step 6 — 버튼 모양
    {
      id: 'btnshape',
      role: 'appearance',
      question: '버튼 모양은 어떻게 할까?',
      options: [
        { id: 'round', label: '둥근 버튼', icon: '🔵', promptFragment: '버튼을 동그랗게 만들어.' },
        { id: 'square', label: '네모 버튼', icon: '🟦', promptFragment: '버튼을 네모나게 만들어.' },
        { id: 'big', label: '아주 큰 버튼', icon: '🆙', promptFragment: '버튼을 손가락으로 누르기 쉽게 아주 크게 만들어.' },
        { id: 'pill', label: '길쭉 둥근', icon: '🟢', promptFragment: '버튼을 길쭉하고 양쪽이 둥근 모양으로 만들어.' },
        { id: 'pillold', label: '알약 모양', icon: '💊', promptFragment: '버튼을 알약처럼 양쪽이 둥근 모양으로 만들어.' },
      ],
    },

    // Step 7 — 버튼 색
    {
      id: 'btncolor',
      role: 'appearance',
      question: '버튼 색은 어떻게 할까?',
      options: [
        { id: 'blue', label: '파란색', icon: '💙', promptFragment: '버튼을 파란색 계열로 해.' },
        { id: 'green', label: '초록색', icon: '💚', promptFragment: '버튼을 초록색 계열로 해.' },
        { id: 'rainbow', label: '알록달록', icon: '🌈', promptFragment: '버튼마다 색을 다르게 알록달록하게 해.' },
        { id: 'pastel', label: '파스텔', icon: '🌸', promptFragment: '버튼을 파스텔 색으로 해.' },
        { id: 'dark', label: '어두운 색', icon: '🖤', promptFragment: '버튼을 어두운 계열 색으로 해.' },
      ],
    },

    // Step 8 — 소리
    {
      id: 'btnsound',
      role: 'sound',
      question: '버튼 누를 때 소리를 넣을까?',
      options: [
        { id: 'click', label: '딸깍 소리', icon: '🎵', promptFragment: '버튼을 누를 때마다 Web Audio로 딸깍 소리가 나게 해.' },
        { id: 'boop', label: '뿅 소리', icon: '💫', promptFragment: '버튼을 누를 때마다 Web Audio로 귀여운 뿅 소리가 나게 해.' },
        { id: 'piano', label: '피아노 소리', icon: '🎹', promptFragment: '버튼을 누를 때마다 Web Audio로 피아노 음이 나게 해.' },
        { id: 'none', label: '소리 없이', icon: '🔇', promptFragment: '' },
      ],
    },

    // Step 9 — 소리 종류 (btnsound !== 'none')
    {
      id: 'soundfx',
      role: 'sound',
      question: '정답 맞혔을 때 효과음을 어떻게 할까?',
      showIf: (a) => a.btnsound !== 'none',
      options: [
        { id: 'fanfare', label: '빠빠빠 팡파레', icon: '🎺', promptFragment: '정답을 맞히면 Web Audio로 짧은 팡파레 소리가 나게 해.' },
        { id: 'tada', label: '짠~ 소리', icon: '🎉', promptFragment: '정답을 맞히면 Web Audio로 "짠~" 하는 소리가 나게 해.' },
        { id: 'coin', label: '동전 소리', icon: '🪙', promptFragment: '정답을 맞히면 Web Audio로 동전 소리가 나게 해.' },
      ],
    },

    // Step 10 — 틀렸을 때 (게임 모드)
    {
      id: 'wrongfx',
      question: '틀렸을 때 어떻게 할까?',
      showIf: (a) => a.mode === 'guess' || a.mode === 'times' || a.mode === 'speed',
      options: [
        { id: 'funny', label: '웃긴 소리', icon: '🤣', promptFragment: '오답일 때 Web Audio로 웃긴 효과음이 나게 해.' },
        { id: 'cheer', label: '응원 메시지', icon: '💪', promptFragment: '오답일 때 "잘 할 수 있어!" 같은 응원 메시지를 보여줘.' },
        { id: 'retry', label: '다시 해봐!', icon: '🔁', promptFragment: '오답일 때 "다시 해봐!" 메시지와 함께 바로 재도전할 수 있게 해.' },
      ],
    },

    // Step 11 — 추가 기능 (mode !== 'times', multi)
    {
      id: 'extra',
      showIf: (a) => a.mode !== 'times',
      question: '추가 기능을 넣을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'clear', label: '지우기 버튼', icon: '🗑️', promptFragment: '입력한 숫자를 한 번에 지우는 C 버튼을 넣어.' },
        { id: 'back', label: '뒤로 지우기', icon: '⬅️', promptFragment: '마지막 숫자 하나만 지우는 ← 버튼을 넣어.' },
        { id: 'mute', label: '소리 끄기', icon: '🔕', promptFragment: '소리를 켜고 끌 수 있는 버튼을 넣어.' },
        { id: 'history', label: '계산 기록', icon: '📜', promptFragment: '이전에 계산한 내용을 아래에 목록으로 보여줘.' },
        { id: 'copy', label: '복사 버튼', icon: '📋', promptFragment: '결과값을 클립보드에 복사하는 버튼을 넣어.' },
      ],
    },

    // Step 12 — 화면 (mode !== 'times')
    {
      id: 'display',
      showIf: (a) => a.mode !== 'times',
      question: '숫자 화면을 어떻게 보여줄까?',
      options: [
        { id: 'bignum', label: '큰 숫자', icon: '🔠', promptFragment: '결과 숫자를 화면에 아주 크게 표시해.' },
        { id: 'cute', label: '귀여운 글씨', icon: '🖋️', promptFragment: '결과 숫자를 둥글둥글 귀여운 글씨체로 표시해.' },
        { id: 'led', label: '게임 점수판처럼', icon: '🕹️', promptFragment: '결과 숫자를 게임 점수판처럼 보여줘.' },
        { id: 'ledold', label: 'LED 숫자판', icon: '🔴', promptFragment: '결과 숫자를 LED 전광판처럼 보여줘.' },
        { id: 'bubble', label: '말풍선', icon: '💬', promptFragment: '결과 숫자를 말풍선 안에 보여줘.' },
      ],
    },

    // Step 13 — 배경
    {
      id: 'bg',
      question: '배경은 어떻게 할까?',
      options: [
        { id: 'white', label: '하얀 배경', icon: '🤍', promptFragment: '배경을 깔끔한 흰색으로 해.' },
        { id: 'dark', label: '어두운 배경', icon: '🖤', promptFragment: '배경을 어두운 색으로 해서 숫자가 밝게 보이게 해.' },
        { id: 'sky', label: '파란 하늘', icon: '🩵', promptFragment: '배경을 밝은 파란색으로 해.' },
        { id: 'yellow', label: '노란 배경', icon: '💛', promptFragment: '배경을 밝고 따뜻한 노란색으로 해.' },
        { id: 'space', label: '우주 배경', icon: '🚀', promptFragment: '배경을 별이 빛나는 우주 느낌으로 해.' },
      ],
    },
  ],
};
