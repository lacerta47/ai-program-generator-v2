// 우리 앱의 피드백 사운드(선택·성공)만 담당. Web Audio 합성(외부 에셋 없음).
// 음소거 토글은 우리 사운드만 끈다 — 페이지/미리보기 프로그램(iframe) 소리는 무관.
// 모든 함수는 SSR·미지원·차단 환경에서 안전하게 no-op.

const KEY = 'app-sound-on';
/** 기본 소리 상태. 나중에 기본 끔으로 바꾸려면 이 한 줄만 false. */
const DEFAULT_SOUND_ON = true;

export function isSoundOn(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    if (v === '0') return false;
    if (v === '1') return true;
    return DEFAULT_SOUND_ON;
  } catch {
    return DEFAULT_SOUND_ON;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* localStorage 차단 — 무시 */
  }
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
