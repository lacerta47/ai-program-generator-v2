// 우리 앱의 피드백 사운드(선택·성공)만 담당. Web Audio 합성(외부 에셋 없음).
// 음소거 토글은 우리 사운드만 끈다 — 페이지/미리보기 프로그램(iframe) 소리는 무관.
// 모든 함수는 SSR·미지원·차단 환경에서 안전하게 no-op.

export const SOUND_KEY = 'app-sound-on';
/** 기본 소리 상태. 나중에 기본 끔으로 바꾸려면 이 한 줄만 false. */
const DEFAULT_SOUND_ON = true;

// 인메모리 '진실값'. 재생 판정(isSoundOn)은 이 값을 최우선으로 본다.
// 과거엔 localStorage만 진실값이라, setItem이 막힌 환경(사생활 보호·기관 관리 기기·
// 저장소 차단/용량 초과)에서 음소거가 '저장 실패 → 조용히 무시'되어 아이콘만 바뀌고
// 소리는 계속 나는 버그가 있었다(= '음소거 버튼이 간간히 안 됨'). 인메모리 값이면
// 저장 성공 여부와 무관하게 이번 세션 음소거가 즉시 반영된다.
let soundOn: boolean | null = null;

function readStored(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* 접근 불가 — 기본값 */
  }
  return DEFAULT_SOUND_ON;
}

export function isSoundOn(): boolean {
  if (soundOn === null) soundOn = readStored();
  return soundOn;
}

export function setSoundOn(on: boolean): void {
  soundOn = on; // 진실값 즉시 갱신(항상 성공) — 저장 실패와 무관하게 음소거가 먹힌다
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* localStorage 차단 — 인메모리 값만으로 이번 세션 동작 */
  }
}

// 다른 탭에서 소리 설정을 바꾸면 인메모리 진실값을 무효화(다음 읽기에서 저장값 재적재).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SOUND_KEY || e.key === null) soundOn = null;
  });
}

let ctx: AudioContext | null = null;

/** 지연 생성 + resume(첫 사용자 제스처에서 호출되므로 autoplay 정책 충족). 실패 시 null. */
function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 단음 톤 하나를 짧게 재생(클릭팝 방지 위해 게인 엔벨로프). */
function tone(c: AudioContext, freq: number, startAt: number, dur: number, peak: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/** 선택 탭: 짧게 살짝 상승하는 "톡". */
export function playSelect(): void {
  if (!isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.07);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.11);
  } catch {
    /* 재생 실패 무시 */
  }
}

/** 성공: 상승 차임 3음(도·미·솔). */
export function playSuccess(): void {
  if (!isSoundOn()) return;
  const c = getCtx();
  if (!c) return;
  try {
    const t = c.currentTime;
    tone(c, 523, t, 0.14, 0.13);
    tone(c, 659, t + 0.12, 0.14, 0.13);
    tone(c, 784, t + 0.24, 0.2, 0.13);
  } catch {
    /* 재생 실패 무시 */
  }
}
