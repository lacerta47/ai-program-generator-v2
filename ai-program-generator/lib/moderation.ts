// 비속어 검사 — 닉네임·게시물 제목·작성자명처럼 게시판에 공개로 노출되는 텍스트용.
//
// 엔진: korcen(한국어 비속어 — 띄어쓰기/초성/숫자삽입 등 우회표기 탐지, 오탐 적음)
//   + 보강 목록: korcen이 놓치는 표기(예: '씨발' 계열)와 영어 비속어를 부분일치로 추가 차단.
//
// 이 검사는 클라이언트 1차 방어선이다(입력 시점 차단). 데이터 계층 write 함수에서 호출해
// 모든 작성 경로가 같은 관문을 지나게 한다. (악의적 우회까지 막으려면 추후 서버 강제 필요)

// korcen은 CommonJS라 dynamic import 시 named/ default 위치가 번들러에 따라 다를 수 있어 방어적으로 해석.
type KorcenApi = {
  check: (t: string) => boolean;
  sexual: (t: string) => boolean;
  belittle: (t: string) => boolean;
  race: (t: string) => boolean;
  parents: (t: string) => boolean;
  minor: (t: string) => boolean;
};
let apiPromise: Promise<KorcenApi> | null = null;
function loadKorcen(): Promise<KorcenApi> {
  if (!apiPromise) {
    apiPromise = import('korcen').then((m) => {
      const raw = m as unknown as Record<string, unknown>;
      return (typeof raw.check === 'function' ? raw : (raw.default ?? raw)) as KorcenApi;
    });
  }
  return apiPromise;
}

// korcen이 놓치는 한국어 비속어만 보강(나머지는 korcen이 잡음). 정규화본에 부분일치.
// '씨발' 한 항목이 씨발/씨발놈/씨발년/씨발새끼 등을 함께 커버.
// 제외: '시발'(korcen이 잡고 '시발점' 오탐), '등신'('1등 신나' 오탐), '걸레'('물걸레/걸레질' 오탐).
const KO_EXTRA = ['씨발', '찐따', '존나'];

// 영어 비속어. 글자별 +패턴이라 반복(fuuuck)도 잡고, 이중자음(asshole·nigger)도 정확히 매칭한다
// (단순 부분일치는 'ss'를 놓치고, 단순 축약은 'Nigeria'를 오탐함 — 이 방식이 둘 다 피함).
// 불명확한 짧은 단어(ass/dick/cock 등)는 오탐 우려로 제외.
const EN_PATTERNS = [
  'fuck', 'shit', 'bitch', 'asshole', 'pussy', 'cunt', 'nigger',
  'faggot', 'slut', 'whore', 'bastard', 'motherfuck', 'retard',
].map((w) => new RegExp(w.split('').map((c) => `${c}+`).join('')));

// 유니코드 혼동문자(confusables) 폴딩 — 호모글리프 사칭/우회를 막는다.
// NFKC가 전각(ａｄｍｉｎ→admin) 등 호환형을 접고, 아래 맵이 키릴/그리스 룩얼라이크(аdmin의 а=U+0430)를
// 라틴으로 접는다. 접지 않으면 normEn이 비-[a-z]인 키릴 글자를 지워 'аdmin'→'dmin'이 돼 예약어를 통과함.
const CONFUSABLES: Record<string, string> = {
  // 키릴 소문자 → 라틴
  а: 'a', ӓ: 'a', е: 'e', ё: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k',
  м: 'm', н: 'h', т: 't', в: 'b', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ո: 'n', ս: 'u', ց: 'g', ԛ: 'q', ԝ: 'w',
  // 그리스 소문자 → 라틴
  α: 'a', ο: 'o', ρ: 'p', ε: 'e', ι: 'i', κ: 'k', ν: 'v', τ: 't', χ: 'x', ς: 's', σ: 's', μ: 'm', υ: 'u',
};
function foldConfusables(s: string): string {
  let out = '';
  for (const ch of (s ?? '').normalize('NFKC')) out += CONFUSABLES[ch.toLowerCase()] ?? ch;
  return out;
}

// 공백·문장부호 모두 제거(한글·영문·숫자만), 반복 축약 — 보강 단어 부분일치용('씨 발'→'씨발'). NFKC로 전각도 접음.
function stripKo(s: string): string {
  return (s ?? '')
    .normalize('NFKC')
    .replace(/[^가-힣ㄱ-ㅣa-zA-Z0-9]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}
// 문장부호·기호만 제거(공백은 유지), 반복 축약 — korcen 보조 검사용('병,신'→'병신').
// 공백을 남기는 이유: korcen이 띄어쓰기를 문맥 판단에 쓰므로(화이트리스트), 임의로 지우면 판단이 흐트러진다.
function dePunctKo(s: string): string {
  return s
    .replace(/[^가-힣ㄱ-ㅣa-zA-Z0-9\s]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}
// 영어 정규화: 혼동문자 폴딩(NFKC+키릴/그리스→라틴) 후 소문자 영문자만 남김
// ('f.u.c.k'·'f u c k'·전각 'ａｄｍｉｎ'·키릴 'аdmin'·'fuсk' 우회 차단).
function normEn(s: string): string {
  return foldConfusables(s).toLowerCase().replace(/[^a-z]/g, '');
}

/** 텍스트에 비속어가 들어있으면 true. 빈 문자열은 안전 처리. */
export async function hasProfanity(text: string): Promise<boolean> {
  const t = (text ?? '').trim();
  if (!t) return false;

  const k = await loadKorcen();
  // 원문 + 문장부호 제거본(공백 유지) 양쪽에 korcen 적용 — '병,신' 같은 문장부호 우회까지 차단.
  // 카테고리: 욕설/성적/비하/인종/패드립/미성년 (정치·외국어는 오탐 우려로 제외).
  for (const s of [t, dePunctKo(t)]) {
    if (k.check(s) || k.sexual(s) || k.belittle(s) || k.race(s) || k.parents(s) || k.minor(s)) {
      return true;
    }
  }
  if (KO_EXTRA.some((w) => stripKo(t).includes(w))) return true;

  const en = normEn(t);
  if (en && EN_PATTERNS.some((re) => re.test(en))) return true;

  return false;
}

// 관리자/운영자 사칭 우려가 있는 예약어 — 닉네임 전용(제목·일반 텍스트엔 적용하지 않음).
// 정규화 부분일치: 한글은 stripKo(공백·기호 제거)에서, 영문은 normEn(혼동문자 폴딩+소문자·영문자만)에서 검사
// → '관 리 자', 'ADMIN9', 'ad-min', 전각 'ａｄｍｉｎ', 키릴 'аdmin' 모두 차단.
const RESERVED_NICK_KO = ['관리자', '운영자', '운영진', '운영팀', '관리팀', '매니저', '스태프'];
const RESERVED_NICK_EN = ['admin', 'administrator', 'manager', 'staff', 'moderator', 'official'];

/** 닉네임이 관리자/운영자 사칭 예약어를 포함하면 true(닉네임 전용 검사). */
export function isReservedNickname(name: string): boolean {
  const ko = stripKo(name ?? '');
  const en = normEn(name ?? '');
  if (ko && RESERVED_NICK_KO.some((w) => ko.includes(w))) return true;
  if (en && RESERVED_NICK_EN.some((w) => en.includes(w))) return true;
  return false;
}

/** 비속어 차단을 알리는 에러 — UI에서 instanceof로 잡아 친절한 안내로 바꾼다. */
export class ProfanityError extends Error {
  constructor(message = '쓸 수 없는 말이 들어 있어요.') {
    super(message);
    this.name = 'ProfanityError';
  }
}

/** 비속어가 있으면 ProfanityError를 던진다(데이터 계층 write 가드용). label을 주면 어느 칸인지 안내. */
export async function assertClean(text: string, label = ''): Promise<void> {
  if (await hasProfanity(text)) {
    throw new ProfanityError(
      label ? `${label}에 쓸 수 없는 말이 있어요. 고운 말로 바꿔 주세요.` : undefined,
    );
  }
}
