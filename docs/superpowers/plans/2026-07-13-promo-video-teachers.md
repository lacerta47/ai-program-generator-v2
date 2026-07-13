# 교사 대상 홍보 영상 제작 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사 연수·설명회 상영용 105초 소개 영상 `promo-teachers-v1.mp4` (1080p/30fps, 내레이션+자막+BGM) 제작.

**Architecture:** 모션 그래픽(씬1·2·6)은 `render(t)` 계약의 HTML을 puppeteer-core로 프레임 단위 캡처 → ffmpeg 30fps 조립. 데모(씬3·4·5)는 puppeteer `page.screencast()`로 로컬 dev 앱을 자동 조작하며 녹화. 내레이션은 edge-tts로 장면별 mp3 생성 후 장면 길이를 내레이션에 맞춤. 최종은 ffmpeg concat + 오디오 믹스(BGM 사이드체인 덕킹) + ASS 자막 번인.

**Tech Stack:** puppeteer-core 25.3(기설치) + 로컬 Chrome, ffmpeg 8.1.2(기설치), edge-tts(pip 설치 필요), Node 스크립트(.mjs), firebase-admin(기설치, 데모 시드용).

**Spec:** `docs/superpowers/specs/2026-07-13-promo-video-teachers-design.md`

## Global Constraints

- 해상도 1920×1080, 30fps, H.264(yuv420p), 최종 길이 약 105초(±10초 허용).
- 내레이션 음성: `ko-KR-SunHiNeural`. 내레이션 문체는 "~합니다" 체.
- 모든 명령은 `ai-program-generator/`에서 실행 (puppeteer-core가 그 node_modules에 있음).
- Chrome 경로: `C:\Users\amh47\AppData\Local\Google\Chrome\Application\chrome.exe` (`scripts/make-pdf.mjs`와 동일, env `CHROME_PATH`로 오버라이드 가능).
- 산출물(프레임 png·mp3·webm·mp4)은 커밋 금지 — `promo/.gitignore`로 차단. 도구 스크립트·씬 HTML·대본은 커밋.
- dev 서버 실행 중 `npm run build` 금지 (CLAUDE.md). 데모 캡처는 dev 서버(3000)로.
- 데모 시드 데이터는 기존 selftest 패턴(Admin SDK, 종료 시 정리)을 따르고, 실사용자 데이터는 화면에 담지 않는다.
- 씬 목표 길이: ①8s ②12s ③35s ④20s ⑤20s ⑥10s. 각 씬은 해당 내레이션 길이 +0.5s 이상이어야 하며, 내레이션이 길면 씬을 늘리고 영상 총량으로 흡수.

## 파일 구조

```
ai-program-generator/promo/
  .gitignore              # out/ audio/ frames/ captures/ *.mp4 *.webm *.png *.mp3
  config.json             # { "siteUrl": "<아웃트로용 배포 URL>" }
  script.md               # 대본(내레이션 전문·자막·씬별 타깃 길이)
  timing.json             # 씬별 내레이션 실측 길이·확정 씬 길이 (Task 2가 생성)
  scenes/scene1-intro.html
  scenes/scene2-concept.html
  scenes/scene6-outro.html
  scenes/_tokens.css      # globals.css에서 복사한 색·폰트 토큰
  tools/capture-frames.mjs    # render(t) 씬 → 프레임 png
  tools/make-clip.mjs         # 프레임 → mp4 (ffmpeg 래퍼)
  tools/tts.ps1               # 대본 → 장면별 mp3 + timing.json
  tools/capture-demo.mjs      # 씬3·4·5 라이브 캡처 (screencast)
  tools/build-audio.mjs       # timing.json → 내레이션 풀트랙 + BGM 덕킹 믹스 명령 생성·실행
  tools/gen-ass.mjs           # script.md + timing.json → subs/promo.ass
  seed-promo-demo.mjs         # 데모 교사·학생·보드 시드 (--cleanup 지원)
  subs/promo.ass
  assets/bgm.mp3              # 사용자 제공 (없으면 내레이션만으로 시사본)
  captures/  frames/  audio/  out/   # 산출물 (gitignore)
```

---

### Task 1: 스캐폴드 + edge-tts 설치 확인

**Files:**
- Create: `ai-program-generator/promo/.gitignore`, `promo/config.json`, 폴더 일체

**Interfaces:**
- Produces: 이후 모든 태스크가 쓰는 폴더 구조, 동작 확인된 `edge-tts` CLI.

- [ ] **Step 1: 폴더·gitignore 생성**

`promo/.gitignore`:
```
out/
audio/
frames/
captures/
assets/
*.mp4
*.webm
*.png
*.mp3
timing.json
```

```powershell
cd ai-program-generator
mkdir promo\scenes, promo\tools, promo\subs, promo\assets, promo\captures, promo\frames, promo\audio, promo\out
```

- [ ] **Step 2: config.json — 사용자에게 배포 URL 질문**

사용자에게 아웃트로에 넣을 사이트 주소를 물어 `promo/config.json`에 기록:
```json
{ "siteUrl": "https://…" }
```
(대답을 아직 못 받으면 빈 문자열로 두고 Task 8 전까지 재확인. 씬6은 빈 값이면 URL 줄을 생략하고 렌더.)

- [ ] **Step 3: edge-tts 설치**

```powershell
pip install edge-tts
```
Python 3.8이라 최신 7.x가 거부되면: `pip install "edge-tts<7"`.

- [ ] **Step 4: 음성 스모크 테스트**

```powershell
edge-tts --voice ko-KR-SunHiNeural --text "안녕하세요. 마이크 테스트입니다." --write-media promo\audio\smoke.mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 promo\audio\smoke.mp3
```
Expected: 2~4초 duration 출력. mp3를 사용자에게 전송해 목소리 컨펌.

- [ ] **Step 5: Commit** (`promo/.gitignore`, `promo/config.json`)

```bash
git add promo/.gitignore promo/config.json
git commit -m "chore(promo): 홍보 영상 작업 스캐폴드"
```

---

### Task 2: 대본 확정 + 내레이션 생성 + timing.json

**Files:**
- Create: `promo/script.md`, `promo/tools/tts.ps1`
- 산출: `promo/audio/nar-1.mp3`…`nar-6.mp3`, `promo/timing.json`

**Interfaces:**
- Produces: `timing.json` — `{ "scenes": [{ "id": 1, "narSec": <실측>, "clipSec": <확정 씬 길이>, "startSec": <누적 시작점> }, …] }`. Task 5~9가 소비.
- 대본 원문(자막 소스). `script.md`의 각 씬 섹션 `## 씬N` 아래 `> 내레이션:` 블록이 정본.

- [ ] **Step 1: script.md 작성 (아래 대본 그대로 — 사용자 수정 요청 반영 가능)**

```markdown
# 홍보 영상 대본 v1 (교사 대상, ~105초)

## 씬1 인트로 (타깃 8s)
> 내레이션: 아이의 계획서가 프로그램이 되는 곳. AI 프로그램 생성기입니다.
화면 타이틀: "계획서를 쓰면, 프로그램이 됩니다"

## 씬2 컨셉 (타깃 12s)
> 내레이션: 코딩을 몰라도 괜찮습니다. 아이는 만들고 싶은 프로그램을, 자기 말로 계획서에 적기만 하면 됩니다.
화면: 계획서 폼 스크린샷 + 키워드 카드 "코딩 몰라도 OK"

## 씬3 라이브 데모 (타깃 35s)
> 내레이션: 이름, 모습, 사용법. 아이가 계획서를 완성하면, AI가 진짜로 움직이는 프로그램을 만들어 줍니다. 완성된 프로그램은 그 자리에서 바로 가지고 놀 수 있고, 마음에 안 드는 부분은 말로 고칠 수 있습니다. 어른의 도움 없이, 아이 혼자서 해내는 경험입니다.
키워드 카드(자막 강조): "아이가 혼자 해냅니다"

## 씬4 교육적 설계 (타깃 20s)
> 내레이션: 만들고 끝나는 장난감이 아닙니다. 내 프로그램에 들어 있는 역할 카드로, 아이는 버튼과 변수와 함수가 무슨 일을 하는지 자연스럽게 만납니다.
키워드 카드: "수업을 위해 설계했습니다"

## 씬5 교실 도입 (타깃 20s)
> 내레이션: 수업 준비는 간단합니다. 선생님이 학번 계정을 발급하면, 아이들은 학교와 학번, 비밀번호 네 자리로 로그인합니다. 완성된 작품은 우리 반 보드에 모이고, 사용량 제한과 신고 기능이 교실을 지켜 줍니다.
키워드 카드: "오늘 바로, 우리 반에서"

## 씬6 아웃트로 (타깃 10s)
> 내레이션: AI 프로그램 생성기. 우리 반의 첫 프로그램을, 오늘 만들어 보세요.
화면: 로고 타이틀 + siteUrl
```

- [ ] **Step 2: 대본 사용자 컨펌** — script.md 내용을 보여주고 수정 반영 후 다음 단계.

- [ ] **Step 3: tts.ps1 작성·실행**

```powershell
# promo/tools/tts.ps1 — script.md의 내레이션을 장면별 mp3로, 길이를 timing.json으로
$lines = @(
  "아이의 계획서가 프로그램이 되는 곳. AI 프로그램 생성기입니다.",
  "코딩을 몰라도 괜찮습니다. 아이는 만들고 싶은 프로그램을, 자기 말로 계획서에 적기만 하면 됩니다.",
  "이름, 모습, 사용법. 아이가 계획서를 완성하면, AI가 진짜로 움직이는 프로그램을 만들어 줍니다. 완성된 프로그램은 그 자리에서 바로 가지고 놀 수 있고, 마음에 안 드는 부분은 말로 고칠 수 있습니다. 어른의 도움 없이, 아이 혼자서 해내는 경험입니다.",
  "만들고 끝나는 장난감이 아닙니다. 내 프로그램에 들어 있는 역할 카드로, 아이는 버튼과 변수와 함수가 무슨 일을 하는지 자연스럽게 만납니다.",
  "수업 준비는 간단합니다. 선생님이 학번 계정을 발급하면, 아이들은 학교와 학번, 비밀번호 네 자리로 로그인합니다. 완성된 작품은 우리 반 보드에 모이고, 사용량 제한과 신고 기능이 교실을 지켜 줍니다.",
  "AI 프로그램 생성기. 우리 반의 첫 프로그램을, 오늘 만들어 보세요."
)
# script.md를 수정했다면 이 배열도 동기화할 것 (자막·TTS의 단일 소스는 script.md)
$targets = 8,12,35,20,20,10
$scenes = @()
$start = 0.0
for ($i=0; $i -lt 6; $i++) {
  $n = $i+1
  edge-tts --voice ko-KR-SunHiNeural --rate=-4% --text $lines[$i] --write-media "promo\audio\nar-$n.mp3"
  $d = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 "promo\audio\nar-$n.mp3")
  $clip = [math]::Max($targets[$i], [math]::Ceiling(($d + 0.8) * 10) / 10)
  $scenes += [pscustomobject]@{ id=$n; narSec=[math]::Round($d,2); clipSec=$clip; startSec=[math]::Round($start,2) }
  $start += $clip
}
@{ scenes = $scenes; totalSec = [math]::Round($start,2) } | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 promo\timing.json
Get-Content promo\timing.json
```
Expected: totalSec 100~115. 각 mp3 재생 확인(사용자에게 nar-3.mp3 전송, 발음 어색한 곳 교정 라운드 1회 — 수정 시 script.md와 배열 동기화 후 재실행).

- [ ] **Step 4: Commit** (`promo/script.md`, `promo/tools/tts.ps1`)

---

### Task 3: 모션 그래픽 하네스 (capture-frames + make-clip)

**Files:**
- Create: `promo/tools/capture-frames.mjs`, `promo/tools/make-clip.mjs`, `promo/scenes/_tokens.css`

**Interfaces:**
- Consumes: 씬 HTML의 전역 함수 계약 — `window.render(t)` (t: 초 단위 float, 멱등, CSS 애니메이션 사용 금지·모든 모션은 t의 함수).
- Produces: `node promo/tools/capture-frames.mjs <scene.html> <durationSec> <framesDir>` 및 `node promo/tools/make-clip.mjs <framesDir> <out.mp4>`. Task 4·5·8이 소비.

- [ ] **Step 1: _tokens.css 작성** — `app/globals.css`에서 `:root`의 OKLCH 색 변수 블록과 폰트 지정을 복사. 폰트는 Google Fonts 링크(Jua·Gowun Dodum)를 씬 HTML `<head>`에서 로드.

- [ ] **Step 2: capture-frames.mjs 작성**

```js
// 사용: node promo/tools/capture-frames.mjs promo/scenes/scene1-intro.html 8 promo/frames/scene1
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:\\Users\\amh47\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const [,, htmlPath, durArg, outDir] = process.argv;
const FPS = 30, frames = Math.round(parseFloat(durArg) * FPS);
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
const config = JSON.parse(readFileSync('promo/config.json', 'utf8'));
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate((cfg) => window.setup && window.setup(cfg), config);
for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({ path: `${outDir}/f${String(i).padStart(5, '0')}.png` });
  if (i % 30 === 0) console.log(`frame ${i}/${frames}`);
}
await browser.close();
console.log('done', frames, 'frames →', outDir);
```

- [ ] **Step 3: make-clip.mjs 작성**

```js
// 사용: node promo/tools/make-clip.mjs promo/frames/scene1 promo/out/scene1.mp4
import { execFileSync } from 'node:child_process';
const [,, framesDir, outFile] = process.argv;
execFileSync('ffmpeg', ['-y', '-framerate', '30', '-i', `${framesDir}/f%05d.png`,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', '30', outFile], { stdio: 'inherit' });
```

- [ ] **Step 4: 하네스 검증 — 테스트 씬**

`promo/scenes/_test.html` (검증 후 삭제):
```html
<link rel="stylesheet" href="_tokens.css">
<div id="box" style="position:absolute;top:500px;width:200px;height:80px;background:oklch(70% 0.15 250)"></div>
<script>window.render = t => { document.getElementById('box').style.left = (t * 200) + 'px'; };</script>
```
```powershell
node promo/tools/capture-frames.mjs promo/scenes/_test.html 2 promo/frames/_test
node promo/tools/make-clip.mjs promo/frames/_test promo/out/_test.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 promo/out/_test.mp4
```
Expected: duration 2.0, 박스가 왼→오로 등속 이동하는 2초 클립. 프레임 f00000/f00030/f00059 세 장으로 이동 확인.

- [ ] **Step 5: Commit** (tools 2종 + _tokens.css, _test 파일은 삭제)

---

### Task 4: 씬1 인트로 + 씬6 아웃트로 제작

**Files:**
- Create: `promo/scenes/scene1-intro.html`, `promo/scenes/scene6-outro.html`
- 산출: `promo/out/scene1.mp4`, `promo/out/scene6.mp4`

**Interfaces:**
- Consumes: Task 3 하네스, `timing.json`의 씬1·6 `clipSec`, `config.json` `siteUrl`(씬6, `window.setup(cfg)`로 수신).
- Produces: 최종 concat에 들어갈 scene1.mp4, scene6.mp4.

- [ ] **Step 1: scene1-intro.html 작성.** 디자인 방향(DESIGN.md·PRODUCT.md 준수): 배경은 앱 배경색, FloatingShapes 느낌의 부드러운 도형이 t에 따라 떠오르고, Jua체 타이틀 "계획서를 쓰면," → "프로그램이 됩니다" 가 순차 pop-in(스케일 0.9→1 + 페이드). 마지막 1초에 서브타이틀 "AI 프로그램 생성기". 모든 easing은 JS 함수(easeOutBack 등)로 t 기반 계산. 텍스트·타이밍은 script.md 씬1과 일치.
- [ ] **Step 2: 렌더·확인** — `capture-frames.mjs` + `make-clip.mjs`로 timing.json의 씬1 clipSec 길이만큼 렌더. 대표 프레임 3장(0.5s/중간/끝)을 사용자에게 전송해 룩 컨펌. 수정 반영.
- [ ] **Step 3: scene6-outro.html 작성.** 씬1과 같은 세계관: 타이틀 "AI 프로그램 생성기" + `siteUrl`(비어 있으면 생략) + 한 줄 카피 "우리 반의 첫 프로그램을, 오늘". 잔잔한 페이드 인, 마지막 2초는 정지 상태 유지(상영장에서 끝나며 멈추는 화면).
- [ ] **Step 4: 렌더·확인** — 동일 절차.
- [ ] **Step 5: Commit** (씬 HTML 2종)

---

### Task 5: 데모 시드 (교사·학생·보드)

**Files:**
- Create: `promo/seed-promo-demo.mjs`

**Interfaces:**
- Produces: 데모 교사 계정(loginId `demo-t`, 학교명 "데모초등학교"), 데모 학생 1명(학번 10203, PIN 1234), 학급 카테고리 + 예시 작품 2건. 콘솔에 로그인 정보 출력. `--cleanup` 플래그로 전부 삭제. Task 6·7이 소비.

- [ ] **Step 1: 기존 패턴 조사.** `scripts/selftest-accounts.mjs`·`scripts/seed-fork-samples.mjs`·`scripts/set-admin.mjs`를 읽고 다음을 그대로 복사: Admin SDK 초기화 블록(serviceAccountKey.json), 교사/학생 생성 시 쓰는 `createUser` 이메일 규칙(`{loginId}@class.kr`, `{schoolCode}-{hakbun}@class.kr`), `setCustomUserClaims`의 정확한 claim 모양(직접 짐작하지 말고 `grep -n "setCustomUserClaims" scripts/*.mjs`로 확인), `schools/{schoolCode}`·`students/{uid}`·`teachers/{uid}` 문서 스키마, 카테고리·게시물 문서 스키마.
- [ ] **Step 2: seed-promo-demo.mjs 작성.** 위 패턴대로 생성 + `--cleanup`시 역순 삭제. 게시물 2건의 제목·코드 예시는 `scripts/seed-fork-samples.mjs`의 것을 재사용.
- [ ] **Step 3: 실행·검증**

```powershell
node promo/seed-promo-demo.mjs
```
Expected: 교사·학생 uid와 로그인 정보 출력. dev 서버 띄우고 브라우저로 학생 로그인(데모초등학교/10203/1234) 성공 확인.

- [ ] **Step 4: Commit** (`promo/seed-promo-demo.mjs`)

---

### Task 6: 라이브 캡처 — 씬3 (아이 시점: 계획서→생성→놀기→수정)

**Files:**
- Create: `promo/tools/capture-demo.mjs`
- 산출: `promo/captures/scene3-raw.webm`, `promo/captures/planform-still.png`(씬2용 스틸)

**Interfaces:**
- Consumes: dev 서버(3000), Task 5 데모 학생 계정.
- Produces: scene3-raw.webm(배속 전 원본), planform-still.png. `capture-demo.mjs`는 `node promo/tools/capture-demo.mjs scene3|scene4|scene5` 형태로 씬별 서브커맨드.

- [ ] **Step 1: 화면 정찰.** dev 서버 실행 후 브라우저 도구로 `/create`(또는 `/easy` — 저학년 흐름이 더 예쁜 쪽 선택)를 열어 실제 폼 구조·라벨을 확인하고 selector 목록을 잡는다. LoginDialog 학생 탭 selector도 확인.
- [ ] **Step 2: capture-demo.mjs 골격 작성**

```js
import puppeteer from 'puppeteer-core';
const CHROME = process.env.CHROME_PATH || 'C:\\Users\\amh47\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const scene = process.argv[2];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--window-size=1920,1080', '--hide-scrollbars'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

async function humanType(sel, text) {           // 사람 속도 타이핑
  await page.click(sel);
  for (const ch of text) { await page.keyboard.type(ch); await sleep(60 + Math.random() * 90); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

if (scene === 'scene3') {
  await page.goto('http://localhost:3000/…', { waitUntil: 'networkidle0' });
  // (정찰 결과로 채움) 학생 로그인 → 계획서 폼 이동
  const rec = await page.screencast({ path: 'promo/captures/scene3-raw.webm' });
  // 계획서 타이핑: 이름 "칭찬 뽑기", 모습/사용법/동작 짧은 문장 — 저학년이 쓸 법한 문구
  // 생성 버튼 → BuilderBot 로딩 화면이 보이는 상태로 대기(실제 Gemini 생성, 배속 편집 예정)
  // 완성 미리보기에서 2~3회 클릭 조작 → 수정 요청 입력("버튼을 더 크게 해 줘") → 재생성 완료까지
  await rec.stop();
}
await browser.close();
```
정찰에서 확정한 selector·URL로 주석 부분을 실제 코드화한다. 계획서 문구는 script.md 씬3 내레이션과 어울리는 예시("칭찬 뽑기" 룰렛)로.

- [ ] **Step 3: 씬2용 스틸 캡처 추가** — scene3 시작 직후 계획서 빈 폼 상태에서 `page.screenshot({ path: 'promo/captures/planform-still.png' })` 한 장.
- [ ] **Step 4: 실행** — `node promo/tools/capture-demo.mjs scene3`. Expected: webm 90~180초(실제 생성 대기 포함), 로딩·미리보기·수정이 모두 담김. 실패(생성 에러) 시 1회 재시도.
- [ ] **Step 5: Commit** (`promo/tools/capture-demo.mjs`)

---

### Task 7: 라이브 캡처 — 씬4 (역할 카드) + 씬5 (교사 플로우)

**Files:**
- Modify: `promo/tools/capture-demo.mjs` (scene4·scene5 분기 추가)
- 산출: `promo/captures/scene4-raw.webm`, `promo/captures/scene5-raw.webm`

**Interfaces:**
- Consumes: Task 5 데모 계정(교사·학생), Task 6 하네스.
- Produces: 씬4·5 원본 webm.

- [ ] **Step 1: scene4 — 학생 계정으로 완성작(또는 시드 작품)의 역할 카드·개념 칩 UI를 천천히 스크롤·호버. 역할 카드가 있는 화면 위치는 정찰로 확인(최근 커밋 기준 easy 플로우의 결과 화면).**
- [ ] **Step 2: scene5 — 교사 계정으로 `/teacher` 학번 발급 화면(발급 폼 → 생성된 학번 목록) → 로그아웃 → LoginDialog 학생 탭(학교 선택·학번·PIN 입력, humanType) → `/board` 학급 보드에 작품이 모인 화면 스크롤.**
- [ ] **Step 3: 실행·확인 — 각 webm에서 대표 프레임 뽑아 사용자 컨펌. Commit.**

---

### Task 8: 클립 편집 (배속·트리밍) + 씬2 합성

**Files:**
- 산출: `promo/out/scene2.mp4`~`scene5.mp4`

**Interfaces:**
- Consumes: `timing.json`의 씬별 `clipSec`, captures/*.webm, planform-still.png.
- Produces: 씬2~5 확정 길이 mp4 (1920×1080/30fps/H.264, 씬N.mp4 무음).

- [ ] **Step 1: 씬3 편집.** 원본 webm에서 구간별 타임스탬프를 확인(생성 대기 시작/끝). 타이핑 구간 1.5~2배속, 생성 대기 구간 12~16배속, 조작·수정 구간 1배속으로 나눠 setpts 후 concat, 최종 길이 = timing.json 씬3 clipSec에 ±1s로 맞춤:
```powershell
# 구간 자르기 예 (t1~t2는 실측으로 치환)
ffmpeg -y -i promo/captures/scene3-raw.webm -ss <t0> -to <t1> -vf "setpts=PTS/1.8,scale=1920:1080" -r 30 -an promo/out/s3a.mp4
ffmpeg -y -i promo/captures/scene3-raw.webm -ss <t1> -to <t2> -vf "setpts=PTS/14,scale=1920:1080" -r 30 -an promo/out/s3b.mp4
# … 구간별 반복 후:
ffmpeg -y -f concat -safe 0 -i promo/out/s3list.txt -c copy promo/out/scene3.mp4
```
- [ ] **Step 2: 씬4·5 편집.** 동일 방식(대부분 1배속, 지루한 구간만 2배속). 각 clipSec에 맞춤.
- [ ] **Step 3: 씬2 제작.** scene2-concept.html 작성 — planform-still.png를 카드 형태로 띄우고(그림자+살짝 기울기), 키워드 카드 "코딩 몰라도 OK"가 pop-in. Task 3 하네스로 렌더 → scene2.mp4.
- [ ] **Step 4: 길이 검증**

```powershell
foreach ($n in 1..6) { ffprobe -v error -show_entries format=duration -of csv=p=0 "promo/out/scene$n.mp4" }
```
Expected: 각 씬이 timing.json clipSec ±1s. 어긋나면 트림 보정.

- [ ] **Step 5: Commit** (scene2-concept.html)

---

### Task 9: 자막(ASS) 생성

**Files:**
- Create: `promo/tools/gen-ass.mjs`, 산출 `promo/subs/promo.ass`

**Interfaces:**
- Consumes: script.md 내레이션 문장, timing.json의 `startSec`·`narSec`.
- Produces: promo.ass — 하단 자막(내레이션을 문장 단위 분할, 씬 구간 내 균등 배분) + 씬3~5 키워드 카드(중앙 상단, 씬 마지막 3초).

- [ ] **Step 1: gen-ass.mjs 작성.** timing.json을 읽어 각 씬의 문장별 Dialogue 라인 생성. 스타일 2종:
```
Style: Sub,Gowun Dodum,52,&H00FFFFFF,&H00000000,&H96000000,&H96000000,0,0,0,0,100,100,0,0,3,4,2,2,80,80,60,1
Style: Key,Jua,72,&H00FFFFFF,&H00000000,&H00000000,&H78000000,0,0,0,0,100,100,0,0,1,5,0,8,80,80,80,1
```
문장 분할 규칙: 마침표·물음표 기준. 각 문장의 표시 구간 = 씬 내레이션 구간을 문장 글자수 비례로 배분.
- [ ] **Step 2: 실행·검증** — `node promo/tools/gen-ass.mjs` 후 promo.ass의 Dialogue 수 = 전체 문장 수 확인. 씬1 클립에 자막 얹은 5초 샘플 렌더로 폰트·크기 확인 (Windows에 Jua·Gowun Dodum 미설치면 폰트 파일을 promo/assets에 받고 `fontsdir` 지정: `-vf "ass=promo/subs/promo.ass:fontsdir=promo/assets"`).
- [ ] **Step 3: Commit** (`promo/tools/gen-ass.mjs`)

---

### Task 10: 오디오 트랙 + 최종 합성

**Files:**
- Create: `promo/tools/build-audio.mjs`
- 산출: `promo/out/narration.m4a`, `promo/out/promo-teachers-v1.mp4`

**Interfaces:**
- Consumes: nar-N.mp3, timing.json, scene1~6.mp4, promo.ass, (있으면) assets/bgm.mp3.
- Produces: 최종 mp4.

- [ ] **Step 1: build-audio.mjs 작성** — timing.json의 startSec대로 adelay 배치해 내레이션 풀트랙 생성:

```js
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const t = JSON.parse(readFileSync('promo/timing.json', 'utf8'));
const inputs = [], delays = [];
t.scenes.forEach((s, i) => {
  inputs.push('-i', `promo/audio/nar-${s.id}.mp3`);
  delays.push(`[${i}:a]adelay=${Math.round(s.startSec * 1000)}:all=1[n${i}]`);
});
const mix = t.scenes.map((_, i) => `[n${i}]`).join('') + `amix=inputs=${t.scenes.length}:normalize=0[nar]`;
execFileSync('ffmpeg', ['-y', ...inputs, '-filter_complex', [...delays, mix].join(';'),
  '-map', '[nar]', '-c:a', 'aac', '-t', String(t.totalSec), 'promo/out/narration.m4a'], { stdio: 'inherit' });
console.log('BGM:', existsSync('promo/assets/bgm.mp3') ? 'found' : 'absent (시사본은 내레이션만)');
```

- [ ] **Step 2: 영상 concat**

```powershell
# promo/out/concat.txt: file 'scene1.mp4' … file 'scene6.mp4'
ffmpeg -y -f concat -safe 0 -i promo/out/concat.txt -c copy promo/out/video-only.mp4
```

- [ ] **Step 3: 무음 시사본** — video-only + narration + 자막 번인 → `promo/out/preview-v0.mp4`. 사용자 전체 시사 컨펌 (스펙의 '최종 전 시사' 게이트).

```powershell
ffmpeg -y -i promo/out/video-only.mp4 -i promo/out/narration.m4a -vf "ass=promo/subs/promo.ass:fontsdir=promo/assets" -map 0:v -map 1:a -c:v libx264 -crf 18 -c:a aac promo/out/preview-v0.mp4
```

- [ ] **Step 4: BGM 믹스(파일 수령 후)** — 사이드체인 덕킹:

```powershell
ffmpeg -y -i promo/out/video-only.mp4 -i promo/out/narration.m4a -stream_loop -1 -i promo/assets/bgm.mp3 -filter_complex "[2:a]volume=0.30,atrim=0:<totalSec>,afade=t=out:st=<totalSec-3>:d=3[bg];[bg][1:a]sidechaincompress=threshold=0.02:ratio=8:attack=25:release=500[duck];[1:a][duck]amix=inputs=2:duration=first:normalize=0[a]" -map 0:v -map "[a]" -vf "ass=promo/subs/promo.ass:fontsdir=promo/assets" -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k promo/out/promo-teachers-v1.mp4
```
Expected: 105초 내외, 내레이션 구간에서 BGM이 자동으로 내려감.

- [ ] **Step 5: 최종 검증** — 처음/중간/끝 프레임 + 전체 재생 확인, ffprobe로 길이·해상도·fps 확인. 사용자에게 최종 파일 전송.

- [ ] **Step 6: Commit** (`promo/tools/build-audio.mjs`)

---

### Task 11: 정리

- [ ] **Step 1: 데모 시드 정리** — `node promo/seed-promo-demo.mjs --cleanup`. Firebase 콘솔 확인 없이 스크립트 출력으로 삭제 건수 검증.
- [ ] **Step 2: 중간 산출물 정리** — frames/·captures/ 삭제(원본 webm은 사용자 의사 확인 후), out/에는 최종 mp4와 preview만 유지.
- [ ] **Step 3: 최종 커밋·마무리 보고** — 남은 도구·씬 파일 커밋 여부 최종 확인, 사용자에게 산출물 경로와 재렌더 방법(대본 수정 → Task 2부터 재실행) 안내.

## Self-Review 결과

- 스펙 커버리지: 스토리보드 6씬(T4·6·7·8), 내레이션(T2), 자막(T9), BGM 덕킹(T10), 시드·정리(T5·T11), 시사 게이트(T10-3) 모두 태스크에 매핑됨.
- 미확정 값 2건은 의도된 외부 입력: siteUrl(T1에서 질문), bgm.mp3(T10-4 전까지 수령). 둘 다 없이도 시사본까지 진행 가능하도록 설계.
- 데모 앱 상호작용 selector는 사전 확정 불가 → T6-1·T7 정찰 단계로 명시(짐작 코딩 금지).
