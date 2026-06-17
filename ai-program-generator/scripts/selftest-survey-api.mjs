// 서버측 통합 점검(개발용): Admin SDK로 custom token을 발급해 ID token으로 교환한 뒤,
// 실행 중인 개발 서버의 /api/generate 를 직접 호출해 설문(survey) 생성/수정 경로와
// 인증·입력검증 동작을 확인한다. 비밀번호·실계정·브라우저 없이 동작한다.
//
// 사전조건: `npm run dev` 실행 중 + 루트에 serviceAccountKey.json, .env.local 존재.
// 사용법:   node scripts/selftest-survey-api.mjs [baseUrl]   (기본 http://localhost:3000)
//
// 주의: 생성/수정 점검은 실제 Gemini 호출이 일어난다(테스트 admin은 일일 한도 무제한).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const BASE = process.argv[2] || 'http://localhost:3000';

// --- 설정 로드 ---
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
} catch {
  console.error('❌ serviceAccountKey.json 을 프로젝트 루트에서 찾을 수 없습니다.');
  process.exit(1);
}

function readEnvLocal() {
  const out = {};
  try {
    for (const line of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* 없으면 빈 객체 */
  }
  return out;
}
const API_KEY = readEnvLocal().NEXT_PUBLIC_FIREBASE_API_KEY;
if (!API_KEY) {
  console.error('❌ .env.local 에서 NEXT_PUBLIC_FIREBASE_API_KEY 를 찾지 못했습니다.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

// custom token → ID token 교환(Identity Toolkit REST). 개발자 클레임(admin)이 ID 토큰에 실린다.
async function mintIdToken(admin) {
  const uid = admin ? 'dev-test-admin' : 'dev-test-user';
  const custom = await getAuth().createCustomToken(uid, { dev: true, ...(admin ? { admin: true } : {}) });
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error('ID token 교환 실패: ' + JSON.stringify(data));
  return data.idToken;
}

async function gen(idToken, body) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('  ✅', name);
  } else {
    fail++;
    console.log('  ❌', name, detail ? `— ${detail}` : '');
  }
}

console.log(`서버측 /api/generate 점검 @ ${BASE}\n`);

// 1) 인증 없음 → 401 (Gemini 호출 없음)
{
  const r = await gen(null, { prompt: 'x', mode: 'generate', variant: 'survey' });
  check('인증 없음 → 401', r.status === 401, `status=${r.status}`);
}

const idToken = await mintIdToken(true);

// 2) 잘못된 mode → 400 (한도 차감 전 입력검증)
{
  const r = await gen(idToken, { prompt: 'x', mode: 'bogus', variant: 'survey' });
  check('잘못된 mode → 400', r.status === 400, `status=${r.status}`);
}

// 3) 빈 prompt → 400
{
  const r = await gen(idToken, { prompt: '   ', mode: 'generate', variant: 'survey' });
  check('빈 prompt → 400', r.status === 400, `status=${r.status}`);
}

// 4) 설문 생성(survey, generate) → 200 + 코드 3종
let firstCode = null;
{
  const prompt = '간단한 그림판을 만들어줘. 배경은 하늘색, 큰 지우개 버튼.';
  const r = await gen(idToken, { prompt, mode: 'generate', variant: 'survey' });
  const ok =
    r.status === 200 &&
    r.data &&
    typeof r.data.html === 'string' &&
    r.data.html.length > 0 &&
    typeof r.data.css === 'string' &&
    typeof r.data.javascript === 'string';
  check('설문 생성(generate) → 200 + html/css/js', ok, `status=${r.status}`);
  if (ok) firstCode = r.data;
}

// 5) 설문 수정(survey, modify) → 200 + 코드 (생성 성공 시에만)
if (firstCode) {
  const modPrompt =
    `기존에 생성된 웹사이트 코드에 다음 요청사항을 반영하여 수정해주세요.\n` +
    `기존 코드:\n- HTML: ${JSON.stringify(firstCode.html)}\n` +
    `- CSS: ${JSON.stringify(firstCode.css)}\n` +
    `- JavaScript: ${JSON.stringify(firstCode.javascript)}\n\n` +
    `사용자 수정 요청사항: 배경을 분홍색으로 바꿔주세요.`;
  const r = await gen(idToken, { prompt: modPrompt, mode: 'modify', variant: 'survey' });
  const ok = r.status === 200 && r.data && typeof r.data.html === 'string' && r.data.html.length > 0;
  check('설문 수정(modify) → 200 + html', ok, `status=${r.status}`);
} else {
  console.log('  ⏭  수정 점검 건너뜀(생성이 실패해 비교 기준 코드 없음)');
}

console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
if (fail === 0) console.log('SELFTEST_SURVEY_API_OK');
process.exit(fail ? 1 : 0);
