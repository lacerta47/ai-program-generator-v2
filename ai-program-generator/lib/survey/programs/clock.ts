import type { ProgramType } from '../types';

export const clock: ProgramType = {
  id: 'clock',
  label: '시계·타이머',
  icon: '⏰',
  basePrompt:
    '시간을 보여주거나 세어 주는 시계 웹 프로그램을 만들어줘. 시간·숫자는 화면 가운데에 아주 크고 또렷하게 보여줘. ' +
    '시간이 흐르는 것은 setInterval이나 requestAnimationFrame으로 처리해(블로킹 무한 루프 금지). ' +
    '켜자마자 바로 쓸 수 있는 완성형으로 만들어.',
  buildName: (a) => {
    const labels: Record<string, string> = {
      clock: '나의 디지털 시계',
      timer: '나의 타이머',
      stopwatch: '나의 스톱워치',
      alarm: '나의 알람 시계',
    };
    const kind = a.kind;
    return typeof kind === 'string' && labels[kind] ? labels[kind] : '나의 시계';
  },
  steps: [
    // 1 — 종류 (이름 결정)
    {
      id: 'kind',
      role: 'type',
      question: '어떤 시계를 만들까?',
      options: [
        { id: 'clock', label: '디지털 시계', icon: '🕐', promptFragment: '지금 시각을 실시간으로 보여주는 디지털 시계를 만들어. 매초 시간이 갱신돼.' },
        { id: 'timer', label: '타이머(거꾸로 세기)', icon: '⏳', promptFragment: '정한 시간부터 0까지 거꾸로 세는 카운트다운 타이머를 만들어. 시작·멈춤·다시 버튼을 넣어.' },
        { id: 'stopwatch', label: '스톱워치', icon: '⏱️', promptFragment: '0부터 시간이 올라가는 스톱워치를 만들어. 시작·멈춤·다시(리셋) 버튼을 넣어.' },
        { id: 'alarm', label: '알람 시계', icon: '⏰', promptFragment: '지금 시각을 보여주고, 정한 시각이 되면 알려주는 알람 시계를 만들어. 알람 시각을 정하는 부분을 넣어.' },
      ],
    },
    // 2 — 타이머 용도 (showIf timer)
    {
      id: 'purpose',
      role: 'goal',
      question: '무엇에 쓸 타이머야?',
      showIf: (a) => a.kind === 'timer',
      options: [
        { id: 'brush', label: '양치 (2분)', icon: '🪥', promptFragment: '기본 시작 시간을 2분으로 맞춘 양치 타이머로 만들어.' },
        { id: 'cook', label: '요리 (3분)', icon: '🍜', promptFragment: '기본 시작 시간을 3분으로 맞춘 요리 타이머로 만들어.' },
        { id: 'study', label: '공부 (10분)', icon: '📚', promptFragment: '기본 시작 시간을 10분으로 맞춘 공부 집중 타이머로 만들어.' },
        { id: 'play', label: '놀이 시간 (30분)', icon: '🎮', promptFragment: '기본 시작 시간을 30분으로 맞춘 놀이 시간 타이머로 만들어.' },
        { id: 'free', label: '내가 정하기', icon: '✏️', promptFragment: '시작 시간을 직접 정할 수 있는 타이머로 만들어(1분·5분·10분 버튼이나 +/- 버튼으로 조절).' },
      ],
    },
    // 3 — 숫자 스타일
    {
      id: 'numstyle',
      role: 'appearance',
      question: '숫자는 어떤 모양이 좋아?',
      options: [
        { id: 'big', label: '크고 깔끔한 숫자', icon: '🔢', promptFragment: '숫자를 크고 깔끔한 글씨로 보여줘.' },
        { id: 'led', label: '옛날 전자시계(초록)', icon: '🟩', promptFragment: '검은 배경에 초록색으로 빛나는 옛날 전자시계(LED) 느낌으로 숫자를 보여줘.' },
        { id: 'pastel', label: '둥근 파스텔', icon: '🌸', promptFragment: '둥글둥글하고 연한 파스텔 색으로 숫자를 보여줘.' },
        { id: 'neon', label: '네온 불빛', icon: '💡', promptFragment: '어두운 배경에 형광 네온 불빛으로 숫자를 보여줘.' },
      ],
    },
    // 4 — 배경 테마
    {
      id: 'bg',
      role: 'decor',
      question: '배경은 어떻게 할까?',
      options: [
        { id: 'night', label: '밤하늘', icon: '🌙', promptFragment: '배경을 별이 있는 밤하늘로 해.' },
        { id: 'space', label: '우주', icon: '🚀', promptFragment: '배경을 우주로 해.' },
        { id: 'sea', label: '바닷속', icon: '🌊', promptFragment: '배경을 바닷속으로 해.' },
        { id: 'forest', label: '숲', icon: '🌳', promptFragment: '배경을 싱그러운 숲으로 해.' },
        { id: 'plain', label: '깔끔한 단색', icon: '⬜', promptFragment: '배경을 깔끔한 단색으로 해.' },
      ],
    },
    // 5 — 초 표시
    {
      id: 'seconds',
      role: 'output',
      question: '초까지 보여줄까?',
      options: [
        { id: 'yes', label: '시:분:초 다 보여줘', icon: '⏱️', promptFragment: '시간을 시:분:초까지 모두 보여줘.' },
        { id: 'no', label: '시:분만 크게', icon: '🕐', promptFragment: '시간을 시:분만 크게 보여줘(초는 생략).' },
      ],
    },
    // 6 — 끝났을 때 효과 (showIf timer/alarm, multi)
    {
      id: 'endfx',
      role: 'output',
      question: '시간이 다 되면 어떻게 알려줄까? (여러 개 OK)',
      multi: true,
      showIf: (a) => a.kind === 'timer' || a.kind === 'alarm',
      options: [
        { id: 'confetti', label: '색종이 팡', icon: '🎊', promptFragment: '시간이 다 되면 색종이가 팡 터지는 효과를 보여줘.' },
        { id: 'bigtext', label: '"끝!" 큰 글자', icon: '🔔', promptFragment: '시간이 다 되면 화면에 "끝!" 같은 큰 글자를 보여줘.' },
        { id: 'flash', label: '화면 반짝', icon: '✨', promptFragment: '시간이 다 되면 화면이 반짝반짝 깜빡이게 해.' },
        { id: 'shake', label: '흔들흔들', icon: '📳', promptFragment: '시간이 다 되면 시계가 흔들흔들 움직이게 해.' },
      ],
    },
    // 7 — 알림 소리
    {
      id: 'sound',
      role: 'sound',
      question: '알림 소리는 어떻게 할까?',
      options: [
        { id: 'dingdong', label: '딩동', icon: '🔔', promptFragment: '알릴 때 Web Audio API로 만든 "딩동" 소리를 내줘.' },
        { id: 'beep', label: '삐삐', icon: '📟', promptFragment: '알릴 때 Web Audio API로 만든 "삐삐" 알람 소리를 내줘.' },
        { id: 'melody', label: '짧은 멜로디', icon: '🎵', promptFragment: '알릴 때 Web Audio API로 만든 밝고 짧은 멜로디를 내줘.' },
        { id: 'quiet', label: '소리 없이', icon: '🔇', promptFragment: '소리는 넣지 말고 화면 효과로만 알려줘.' },
      ],
    },
    // 8 — 버튼 모양
    {
      id: 'controls',
      role: 'control',
      question: '버튼은 어떻게 할까?',
      options: [
        { id: 'three', label: '시작·멈춤·다시', icon: '🎛️', promptFragment: '시작·멈춤·다시 버튼을 또렷하게 각각 넣어.' },
        { id: 'onebig', label: '큰 버튼 하나로', icon: '🔘', promptFragment: '누를 때마다 시작↔멈춤이 바뀌는 큰 버튼 하나와, 다시(리셋) 버튼을 넣어.' },
      ],
    },
    // 9 — 추가 기능 (multi)
    {
      id: 'extra',
      role: 'output',
      question: '더 넣을 기능이 있을까? (여러 개 OK)',
      multi: true,
      options: [
        { id: 'bar', label: '진행 막대바', icon: '📊', promptFragment: '남은 시간이나 지난 시간을 보여주는 진행 막대바를 함께 넣어.' },
        { id: 'colorchange', label: '시간 따라 색 변하기', icon: '🌈', promptFragment: '시간이 줄거나 늘수록 화면 색이 점점 변하게 해.' },
        { id: 'cheer', label: '응원 문구', icon: '💬', promptFragment: '"조금만 더!" 같은 응원 문구를 가끔 보여줘.' },
        { id: 'lap', label: '기록 남기기', icon: '📝', promptFragment: '"기록" 버튼으로 그때의 시간을 목록에 남기게 해.' },
        { id: 'none', label: '없어도 돼', icon: '👍', promptFragment: '' },
      ],
    },
  ],
};
