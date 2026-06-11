// 시스템 프롬프트 회귀 점검: 금지사항을 유혹하는 계획서로 실제 생성을 돌려
// 출력 코드가 실행 환경 제약을 지키는지 자동 검사한다.
// 실행: node scripts/check-prompt.mjs   (Gemini 호출 — 회당 약 1~3원)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const key = readFileSync(join(root, '.env.local'), 'utf8')
  .split(/\r?\n/)
  .find((l) => l.startsWith('GEMINI_API_KEY='))
  .slice('GEMINI_API_KEY='.length)
  .trim();

// prompts.ts의 템플릿 리터럴에서 시스템 프롬프트 추출
const src = readFileSync(join(root, 'lib/ai/prompts.ts'), 'utf8');
const system = src
  .slice(src.indexOf('`') + 1, src.lastIndexOf('`'))
  .replaceAll('\\`', '`');

const PLANS = [
  {
    name: '인사말 기억 (alert·localStorage 유혹)',
    prompt: `프로그램 계획서:
- 프로그램 이름: 인사말 기억 프로그램
- 프로그램 모습 (배경, 아이콘 등): 밝은 배경에 큰 입력창과 버튼
- 사용법 및 조작 방법: 이름을 입력하고 버튼을 누르면 인사말을 보여준다
- 동작 방식: 새로고침해도 마지막에 입력한 이름을 기억해서 다시 인사한다
- 기타 사항: 버튼을 누르면 확인 메시지도 띄워줘`,
  },
  {
    name: '공 튀기기 (무한루프 유혹)',
    prompt: `프로그램 계획서:
- 프로그램 이름: 공 튀기기
- 프로그램 모습 (배경, 아이콘 등): 까만 배경에 알록달록한 공
- 사용법 및 조작 방법: 자동으로 공이 계속 움직인다
- 동작 방식: 공이 벽에 닿으면 튕기면서 영원히 멈추지 않고 움직인다
- 기타 사항: 부드럽게 움직이게 해줘`,
  },
];

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    html: { type: 'STRING' },
    css: { type: 'STRING' },
    javascript: { type: 'STRING' },
  },
  required: ['html', 'css', 'javascript'],
};

async function generate(prompt) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return JSON.parse(j.candidates[0].content.parts.map((p) => p.text).join(''));
}

function inspect(code) {
  const js = code.javascript ?? '';
  const checks = {};
  checks['alert/confirm/prompt 없음'] = !/\b(alert|confirm|prompt)\s*\(/.test(js);
  checks['블로킹 무한루프 없음'] = !/while\s*\(\s*(true|1)\s*\)/.test(js) && !/for\s*\(\s*;\s*;\s*\)/.test(js);
  const usesStorage = /localStorage|sessionStorage/.test(js);
  checks['storage 사용 시 try-catch'] = !usesStorage || /try\s*\{[\s\S]*?(localStorage|sessionStorage)/.test(js);
  checks['줄바꿈 있는 코드 (js)'] = js.split('\n').length > 5;
  checks['줄바꿈 있는 코드 (css)'] = (code.css ?? '').split('\n').length > 5;
  checks['한국어 UI 텍스트'] = /[가-힣]/.test(code.html ?? '');
  checks['rAF/setInterval 사용(움직임 있을 때)'] = !/requestAnimationFrame|setInterval/.test(js) || true;
  return { checks, sizes: { html: code.html?.length, css: code.css?.length, js: js.length }, usesStorage };
}

for (const plan of PLANS) {
  console.log(`\n=== ${plan.name} ===`);
  try {
    const code = await generate(plan.prompt);
    const { checks, sizes, usesStorage } = inspect(code);
    for (const [name, ok] of Object.entries(checks)) {
      console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    }
    console.log(`  크기: html=${sizes.html} css=${sizes.css} js=${sizes.js} | storage 사용: ${usesStorage}`);
  } catch (e) {
    console.log('  ⚠️ 생성 실패:', e.message);
  }
}
