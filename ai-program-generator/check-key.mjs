// Gemini API 키 연결 점검 스크립트
// - .env.local에서 GEMINI_API_KEY를 읽어 실제 Gemini 호출이 되는지 확인합니다.
// - 키 값은 화면에 절대 출력하지 않습니다. 의존성 없이 Node 내장 fetch만 사용합니다.
// 실행: node check-key.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODEL = 'gemini-2.5-flash';

function loadKey() {
  let raw;
  try {
    raw = readFileSync(join(__dirname, '.env.local'), 'utf8');
  } catch {
    console.error('❌ .env.local 파일을 찾을 수 없습니다.');
    process.exit(1);
  }
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('GEMINI_API_KEY='));
  if (!line) {
    console.error('❌ .env.local 안에 GEMINI_API_KEY 항목이 없습니다.');
    process.exit(1);
  }
  const key = line.slice('GEMINI_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
  if (!key || key.includes('여기에') || key.startsWith('PLAC')) {
    console.error('❌ 아직 실제 키가 입력되지 않았습니다.');
    console.error('   .env.local의 GEMINI_API_KEY= 뒤에 발급받은 키를 붙여넣고 다시 실행하세요.');
    process.exit(1);
  }
  return key;
}

async function main() {
  const key = loadKey();
  console.log(`🔍 ${MODEL} 모델로 연결을 점검합니다 (키 길이 ${key.length}, 값은 표시하지 않음)...`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '연결 테스트입니다. "성공"이라고만 답해주세요.' }] }],
      }),
    });
  } catch (e) {
    console.error('❌ 네트워크 오류:', e.message);
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`❌ 요청 실패 (HTTP ${res.status})`);
    if (res.status === 400 || res.status === 403) {
      console.error('   → 키가 잘못됐거나 권한/사용 설정 문제일 수 있습니다. AI Studio에서 키를 다시 확인하세요.');
    } else if (res.status === 429) {
      console.error('   → 무료 티어 한도 초과(분당/일일). 잠시 후 다시 시도하세요.');
    } else if (res.status === 404) {
      console.error('   → 모델명을 찾을 수 없습니다. (모델 가용성 변경 가능)');
    }
    console.error('   응답:', body.slice(0, 400));
    process.exit(1);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '(텍스트 없음)';
  console.log('✅ 연결 성공! Gemini 응답:', JSON.stringify(text.trim()));
  console.log('🎉 Gemini API 키가 정상 동작합니다 — 최대 블로커 해결.');
}

main();
