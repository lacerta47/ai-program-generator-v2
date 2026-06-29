# 사진 업로드 기능 — 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생이 사진 1장을 올려 Gemini(멀티모달·유료티어)가 그 사진을 활용한 프로그램을 만들고, 교실 보드에 게시·공유한다.

**Architecture:** 생성 코드엔 작은 `__PHOTO__` 토큰만(150k 필드캡 안전), 실제 data-URI는 post의 별도 `photo` 필드(1MB 문서캡 안). 모든 렌더 경로에서 공용 `substitutePhoto`로 토큰→data-URI 치환. 사진은 멀티모달로 Gemini에 전송(유료티어=학습 미사용). 사진은 교실 보드 전용. 사진 생성은 쿼터 2배.

**Tech Stack:** Next.js 15·TS·Firebase(rules·Firestore)·`@google/genai`(멀티모달)·canvas 압축·jszip.

**스펙:** `ai-program-generator/docs/superpowers/specs/2026-06-26-photo-upload-design.md`
**선행(사용자):** 유료 Gemini 티어(결제 활성화) — 사진 학습 미사용.

---

## 검증 현실
테스트 프레임워크 없음. "테스트" = `scripts/selftest-*.mjs`(미커밋) + `./node_modules/.bin/tsc --noEmit` + `npm run build` + 브라우저(dev). 순수함수는 인라인 `node -e` 어서션으로 확인. rules는 `firebase deploy --only firestore:rules --project test-ai-builder` 후 client-SDK self-test.

## 파일 맵

| 파일 | 책임 | 변경 |
|---|---|---|
| `lib/ai/photo.ts` | 토큰·치환 헬퍼 | 신규(T1) |
| `lib/firebase/types.ts` | `Post.photo` | T1 |
| `firestore.rules` | photo 필드 검증(교실한정·크기) | T2 |
| `app/api/preview/route.ts` | POST 본문 photo→치환 | T3 |
| `app/api/share/[postId]/route.ts` | post.photo 치환 | T3 |
| `lib/client/downloadZip.ts` | ZIP에 photo 치환 | T3 |
| `lib/client/imageCompress.ts` | canvas 압축 | 신규(T4) |
| `components/creator/PhotoUpload.tsx` | 업로드 위젯+배너 | 신규(T5) |
| `components/creator/Creator.tsx`·`components/survey/SurveyWizard.tsx` | photo 상태·전달 | T5·T8 |
| `components/board/UploadDialog.tsx` | createPost photo | T6 |
| `components/ui/FullscreenFrame.tsx` | 교실 사진글 미리보기에 photo 전달 | T6 |
| `lib/ai/types.ts`·`lib/ai/gemini.ts` | GenerateInput.photo·멀티모달 | T7 |
| `app/api/generate/route.ts`·`lib/client/generate.ts`·`lib/ai/prompts.ts` | photo 전달·사진 지시·쿼터 | T8·T9 |
| `lib/server/studentQuota.ts` | cost 인자 | T9 |
| `scripts/selftest-photo.mjs` | rules/치환 검증(미커밋) | T2·T10 |

---

## Phase 1 — Plumbing (사진 없이도 회귀 0)

### Task 1: `substitutePhoto` 헬퍼 + `Post.photo` 타입

**Files:**
- Create: `lib/ai/photo.ts`
- Modify: `lib/firebase/types.ts`(Post)

- [ ] **Step 1: 헬퍼 작성** — `lib/ai/photo.ts`:
```ts
import type { GeneratedCode } from './types';

/** 생성 코드 안에서 사진 자리를 가리키는 리터럴 토큰. AI가 이미지 소스로 사용. */
export const PHOTO_TOKEN = '__PHOTO__';

// 사진이 없는데 토큰만 남은 경우 깨지지 않게 1×1 투명 PNG로 대체.
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** 코드 3필드의 PHOTO_TOKEN을 data-URI로 치환. photo 없으면 투명 PNG. 토큰 없으면 무변경(no-op). */
export function substitutePhoto(code: GeneratedCode, photo?: string): GeneratedCode {
  const img = photo || TRANSPARENT_PNG;
  // split/join = 리터럴 전역 치환(replaceAll의 $ 특수문자 이슈 회피; data-URI는 $ 포함 가능).
  const sub = (s: string) => s.split(PHOTO_TOKEN).join(img);
  return { html: sub(code.html), css: sub(code.css), javascript: sub(code.javascript) };
}
```

- [ ] **Step 2: 단위 확인** — Run:
```
cd ai-program-generator && node --input-type=module -e "import {substitutePhoto,PHOTO_TOKEN} from './lib/ai/photo.ts'" 2>/dev/null || echo "ts는 직접 실행 불가 — tsc로 검증"
```
대신 임시 검증: tsc가 타입을 잡고, 로직은 T10 self-test에서. 여기선 다음 단계 tsc로 컴파일 확인.

- [ ] **Step 3: Post 타입** — `lib/firebase/types.ts`의 `Post`에 `forkCount?` 등 뒤에 추가:
```ts
  /** 업로드 사진 1장(data-URI). 교실 보드 글에만. code의 __PHOTO__ 토큰을 렌더 시 이걸로 치환. 구버전/비사진 글엔 없음. */
  photo?: string;
```

- [ ] **Step 4: tsc** — Run: `cd ai-program-generator && ./node_modules/.bin/tsc --noEmit`. Expected: PASS.

- [ ] **Step 5: 커밋**
```
git add ai-program-generator/lib/ai/photo.ts ai-program-generator/lib/firebase/types.ts
git commit -m "feat(photo): substitutePhoto 헬퍼 + Post.photo 필드"
```

### Task 2: firestore.rules — photo 필드(교실 한정·크기캡)

**Files:**
- Modify: `firestore.rules`(validPost + posts update)
- Test: `scripts/selftest-photo.mjs`(신규)

- [ ] **Step 1: 실패 self-test** — `scripts/selftest-photo.mjs`(`selftest-board-privacy.mjs` 하네스 본떠). 시드: 교사 T·교실 카테고리 CAT(teacherUid=T)·공개 카테고리 PUB. 교사 T 로그인 client로:
```js
const okPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(1000);
const bigPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(360000);
// (1) 교실글 + photo(작음) → 성공
await assertSucceeds(addDoc(posts, mkPost({categoryId:CAT, boardTeacherUid:T, photo:okPhoto})));
// (2) 공개글 + photo → 거부(공개 보드 사진 금지)
await assertFails(addDoc(posts, mkPost({categoryId:PUB, boardTeacherUid:null, photo:okPhoto})));
// (3) 교실글 + photo 초과크기 → 거부
await assertFails(addDoc(posts, mkPost({categoryId:CAT, boardTeacherUid:T, photo:bigPhoto})));
// (4) 교실글 + photo 비-data:image → 거부
await assertFails(addDoc(posts, mkPost({categoryId:CAT, boardTeacherUid:T, photo:'http://x/y.jpg'})));
// (5) 교실글 photo 없음 → 성공(회귀)
await assertSucceeds(addDoc(posts, mkPost({categoryId:CAT, boardTeacherUid:T})));
```

- [ ] **Step 2: 배포 전 실패 확인** — Run: `node scripts/selftest-photo.mjs`. Expected: (1)이 거부됨(현 validPost는 photo 키 없어 hasOnly 위반) → FAIL.

- [ ] **Step 3: validPost에 photo** — `firestore.rules` `validPost(d)`:
  (a) `keys().hasOnly([...])` 배열 끝에 `'photo'` 추가.
  (b) 본문 끝(boardTeacherUid 검증 다음)에 추가:
```
        && (!('photo' in d) || (
             d.photo is string
             && d.photo.matches('data:image/.*')
             && d.photo.size() <= 350000
             && d.boardTeacherUid != null
           ));
```
  (c) posts `allow update`의 `affectedKeys().hasOnly([...])`에 `'photo'` 추가 + update 본문에도 같은 photo 검증 추가(수정 시 사진 유지/교체 허용).

- [ ] **Step 4: 배포 + 통과** — Run:
```
firebase deploy --only firestore:rules --project test-ai-builder
node scripts/selftest-photo.mjs
```
Expected: (1)~(5) 기대대로 PASS.

- [ ] **Step 5: 커밋**
```
git add ai-program-generator/firestore.rules
git commit -m "feat(photo): rules — photo 필드 교실한정·크기캡(350k)·data:image"
```

### Task 3: 렌더 경로 치환 (preview·share·ZIP)

**Files:**
- Modify: `app/api/preview/route.ts`·`app/api/share/[postId]/route.ts`·`lib/client/downloadZip.ts`

- [ ] **Step 1: /api/preview가 photo 수용** — `app/api/preview/route.ts`. `buildPreviewDoc({html,css,javascript})`(line 40) 직전에 photo를 받아 치환:
```ts
import { substitutePhoto } from '@/lib/ai/photo';
// body 구조분해에 photo 추가:
const { html, css, javascript, photo } = (body ?? {}) as Record<string, unknown>;
// html/css/javascript 검증은 기존대로. photo는 옵셔널 string.
const sub = substitutePhoto(
  { html: html as string, css: css as string, javascript: javascript as string },
  typeof photo === 'string' ? photo : undefined,
);
const doc = buildPreviewDoc(sub);
```
(photo는 MAX_PART(150k) 검증 대상 아님 — 별도 필드. 단 과대 방지로 `if (typeof photo === 'string' && photo.length > 400000) return 413`.)

- [ ] **Step 2: 공유 API 치환** — `app/api/share/[postId]/route.ts`. line 30~31:
```ts
import { substitutePhoto } from '@/lib/ai/photo';
const code = post!.code as GeneratedCode;
const previewId = await putPreview(buildPreviewDoc(substitutePhoto(code, post!.photo as string | undefined)));
```

- [ ] **Step 3: ZIP 치환** — `lib/client/downloadZip.ts`. `buildIndexHtml(code, title)`(line 12)을 치환된 코드로:
```ts
import { substitutePhoto } from '@/lib/ai/photo';
// downloadZip 시그니처에 photo?: string 추가, 호출부에서 전달.
// const code2 = substitutePhoto(code, photo); 후 buildIndexHtml(code2, title) + css/js도 code2 사용.
```
downloadZip의 시그니처를 `downloadZip(code, title, photo?)`로 바꾸고 맨 위에서 `code = substitutePhoto(code, photo)`로 재대입. 호출부(ResultPanel 등)는 photo 없으면 그대로 동작.

- [ ] **Step 4: tsc + 커밋** — `./node_modules/.bin/tsc --noEmit` PASS.
```
git add ai-program-generator/app/api/preview/route.ts ai-program-generator/app/api/share/[postId]/route.ts ai-program-generator/lib/client/downloadZip.ts
git commit -m "feat(photo): preview·share·ZIP 렌더 경로에 substitutePhoto 적용"
```

---

## Phase 2 — 업로드·압축 UI

### Task 4: 이미지 압축 유틸

**Files:** Create `lib/client/imageCompress.ts`

- [ ] **Step 1: 작성**:
```ts
/** File을 canvas로 최대 변 maxDim·JPEG quality로 압축한 data-URI 반환. 목표 크기 초과 시 quality 하향 재시도. */
export async function compressImage(file: File, maxDim = 768, maxChars = 160000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리할 수 없어요.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  for (const q of [0.7, 0.55, 0.4]) {
    const uri = canvas.toDataURL('image/jpeg', q);
    if (uri.length <= maxChars) return uri;
  }
  throw new Error('사진이 너무 커요. 더 작은 사진으로 해볼까요?');
}
```

- [ ] **Step 2: tsc + 커밋**:
```
git add ai-program-generator/lib/client/imageCompress.ts
git commit -m "feat(photo): 클라 이미지 압축 유틸(canvas 768px/JPEG)"
```

### Task 5: 업로드 위젯 + 생성 화면 통합 + 배너

**Files:**
- Create: `components/creator/PhotoUpload.tsx`
- Modify: `components/creator/Creator.tsx`·`components/survey/SurveyWizard.tsx`

- [ ] **Step 1: 위젯** — `components/creator/PhotoUpload.tsx`:
```tsx
'use client';
import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { compressImage } from '@/lib/client/imageCompress';
import Button from '@/components/ui/Button';

/** 사진 1장 업로드(압축 후 data-URI). 학생/교사 생성 화면에만 렌더. value/onChange로 부모가 상태 보유. */
export default function PhotoUpload({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pick(file: File) {
    setBusy(true); setError('');
    try { onChange(await compressImage(file)); }
    catch (e) { setError(e instanceof Error ? e.message : '사진을 못 올렸어요.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="relative w-fit">
          <img src={value} alt="올린 사진" className="h-28 rounded-[var(--r-md)] border-2 border-line object-cover" />
          <button type="button" onClick={() => onChange(null)} aria-label="사진 빼기"
            className="press absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-line bg-surface"><X size={15} /></button>
        </div>
      ) : (
        <Button type="button" variant="soft" onClick={() => inputRef.current?.click()} disabled={busy} className="w-fit">
          <ImagePlus size={18} aria-hidden /> {busy ? '사진 줄이는 중…' : '사진 올리기(선택)'}
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
      {error && <p className="text-[13px] text-coral-ink">{error}</p>}
      <p className="text-[12.5px] text-muted">사진은 <b>AI가 보고</b> 프로그램을 만들어요. 우리 반과 선생님만 볼 수 있어요. 친구·가족 얼굴은 올리지 않는 게 좋아요.</p>
    </div>
  );
}
```

- [ ] **Step 2: Creator 통합** — `components/creator/Creator.tsx`. `useAuth()`에서 `isStudent`/`isTeacher` 사용 중. 상태 추가 `const [photo, setPhoto] = useState<string | null>(null);`. 계획서 폼 근처(생성 버튼 위)에 **학생/교사만** 렌더:
```tsx
{(isStudent || isTeacher) && <PhotoUpload value={photo} onChange={setPhoto} />}
```
import 추가. (실제 전송은 Task 8에서 requestGenerateStream에 photo 전달.)

- [ ] **Step 3: SurveyWizard 통합** — `components/survey/SurveyWizard.tsx`도 동일하게 photo 상태 + `{(isStudent||isTeacher) && <PhotoUpload .../>}` (생성 단계 화면). useAuth import 확인.

- [ ] **Step 4: tsc + 커밋**:
```
git add ai-program-generator/components/creator/PhotoUpload.tsx ai-program-generator/components/creator/Creator.tsx ai-program-generator/components/survey/SurveyWizard.tsx
git commit -m "feat(photo): 업로드 위젯+압축+고지배너, 학생/교사 생성화면 통합"
```

### Task 6: createPost photo 저장 + 보드 멤버 미리보기

**Files:** Modify `components/board/UploadDialog.tsx`·`components/ui/FullscreenFrame.tsx`(+ 그 호출 PostPreview)

- [ ] **Step 1: 업로드 시 photo 동봉** — `UploadDialog`에 `photo?: string` prop 추가(생성 결과의 photo). `createPost({...})`에 `...(photo && boardTeacherUid ? { photo } : {})` 추가 — **교실 보드(boardTeacherUid 있음)일 때만**. (공개 보드면 photo 제외 → rules와 일치.) Creator/SurveyWizard가 UploadDialog에 photo 전달.

- [ ] **Step 2: 보드 멤버 미리보기에 photo** — `FullscreenFrame`이 즉석 POST 경로(`requestPreviewId`)에서 photo도 보내게: `requestPreviewId(code, photo?)` → `/api/preview` body에 photo 추가. `FullscreenFrame` props에 `photo?: string`. `PostPreview.tsx`가 교실 글 렌더 시 `photo={post.photo}` 전달. (공개 글은 photo 없음.)

- [ ] **Step 3: tsc + 커밋**:
```
git add ai-program-generator/components/board/UploadDialog.tsx ai-program-generator/components/ui/FullscreenFrame.tsx ai-program-generator/components/board/PostPreview.tsx ai-program-generator/components/creator/Creator.tsx ai-program-generator/components/survey/SurveyWizard.tsx
git commit -m "feat(photo): createPost photo(교실한정) + 보드 멤버 미리보기 photo 전달"
```

---

## Phase 3 — 멀티모달 생성

### Task 7: GenerateInput.photo + gemini.ts 멀티모달

**Files:** Modify `lib/ai/types.ts`·`lib/ai/gemini.ts`

- [ ] **Step 1: 타입** — `lib/ai/types.ts` `GenerateInput`에:
```ts
  /** 멀티모달: 첨부 사진(없으면 텍스트-only). data=순수 base64(접두 제외), mimeType=image/jpeg 등 */
  photo?: { data: string; mimeType: string };
```

- [ ] **Step 2: gemini 멀티모달** — `lib/ai/gemini.ts` `startStream`의 `contents`를 photo 유무로 분기:
```ts
const contents = input.photo
  ? [{ role: 'user', parts: [{ text: input.prompt }, { inlineData: { mimeType: input.photo.mimeType, data: input.photo.data } }] }]
  : input.prompt;
// generateContentStream({ model, contents, config: {...} })  — contents만 교체
```

- [ ] **Step 3: tsc + 커밋**:
```
git add ai-program-generator/lib/ai/types.ts ai-program-generator/lib/ai/gemini.ts
git commit -m "feat(photo): GenerateInput.photo + gemini 멀티모달 이미지 파트"
```

### Task 8: /api/generate photo 전달 + 사진 지시 + 클라 전송

**Files:** Modify `app/api/generate/route.ts`·`lib/client/generate.ts`·`lib/ai/prompts.ts`·`Creator.tsx`·`SurveyWizard.tsx`

- [ ] **Step 1: 시스템 프롬프트 사진 지시** — `lib/ai/prompts.ts`에 export 추가:
```ts
export const PHOTO_INSTRUCTION = `

**사진 활용 (첨부됨)**: 사용자가 사진 1장을 올렸습니다. 사진을 보고 계획서대로 그 사진을 **활용하는** 프로그램(퍼즐·필터·스티커·사진 게임·꾸미기 등)을 만드세요. 코드에서 이미지 소스는 반드시 \`__PHOTO__\` 리터럴을 쓰고(사진을 다시 그리거나 다른 URL을 쓰지 마세요), 사진의 크기·비율은 모를 수 있으니 \`object-fit\`·런타임 \`naturalWidth/Height\`로 어떤 사진에도 맞게 하세요.`;
```

- [ ] **Step 2: route가 photo 수용·지시 append·provider 전달** — `app/api/generate/route.ts`:
  - body 구조분해에 `photo`(data-URI string) 추가.
  - photo 있으면 data-URI 파싱: `const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(photo)` → `{ mimeType: m[1], data: m[2] }`. 형식 불일치/과대(>400000자)면 400.
  - `system = SYSTEM_PROMPTS[variant] + (mode==='modify'?MODIFY:'') + (photo? PHOTO_INSTRUCTION:'')`.
  - provider 호출 `generateStream({ prompt: finalPrompt, system, mode, photo: parsedPhoto }, signal)`.
  - (쿼터 2배는 Task 9.)

- [ ] **Step 3: 클라 전송** — `lib/client/generate.ts` `requestGenerateStream(prompt, mode, variant, opts)`에 `photo?: string`를 opts나 인자로 추가 → body에 `photo` 포함. `Creator.tsx`·`SurveyWizard.tsx`가 생성 호출 시 `photo`(state) 전달.

- [ ] **Step 4: tsc + build + 커밋**:
```
git add ai-program-generator/app/api/generate/route.ts ai-program-generator/lib/client/generate.ts ai-program-generator/lib/ai/prompts.ts ai-program-generator/components/creator/Creator.tsx ai-program-generator/components/survey/SurveyWizard.tsx
git commit -m "feat(photo): 멀티모달 생성 — /api/generate photo 전달·사진 지시 프롬프트·클라 전송"
```

---

## Phase 4 — 쿼터 2배

### Task 9: studentQuota cost 인자 + route cost 결정

**Files:** Modify `lib/server/studentQuota.ts`·`app/api/generate/route.ts`

- [ ] **Step 1: cost 인자** — `lib/server/studentQuota.ts`:
  - `reserveStudentQuota(uid: string, cost = 1)`: 체크를 `pool + cost > cap`(여유 부족)→`pool`, `studentUsed + cost > limitValue`→`cap-total`, `dayCount + cost > limitValue`→`cap-daily`로. write는 `pool + cost`·`studentUsed + cost`·`dayCount + cost`.
  - `refundStudentQuota(uid: string, cost = 1)`: 각 차감을 `Math.max(0, x - cost)`로(현 `>0` 가드를 cost 반영).

- [ ] **Step 2: route cost** — `app/api/generate/route.ts`:
  - `const cost = parsedPhoto ? 2 : 1;`
  - 학생: `reserveStudentQuota(uid, cost)`; 환불 `refundStudentQuota(uid, cost)`.
  - 교사·admin 일일 카운터: `if (count + cost > dailyLimit) 429`, write `count + cost`; 환불 `refundQuota(usageRef, cost)`(refundQuota도 cost 인자 추가, `count - cost` 0-floor).
  - 사진인데 한도 부족 429 메시지: "오늘 사진 만들기는 2번이 필요해요. 한도가 부족해요."

- [ ] **Step 3: self-test(서버) + 커밋** — `scripts/selftest-photo.mjs`에 쿼터 케이스 추가(가능 시): 학생 풀 cap 근처에서 photo 생성 시 2 차감·1 남으면 거부. tsc PASS.
```
git add ai-program-generator/lib/server/studentQuota.ts ai-program-generator/app/api/generate/route.ts
git commit -m "feat(photo): 사진 생성 쿼터 2배(studentQuota cost 인자)"
```

---

## Phase 5 — 검증·배포

### Task 10: 전체 self-test + 빌드 + 수동 + 배포

- [ ] **Step 1: rules 배포**(Task 2에서 했으면 재확인): `firebase deploy --only firestore:rules --project test-ai-builder`.
- [ ] **Step 2: self-test**: `node scripts/selftest-photo.mjs`(photo rules 5케이스 + 쿼터) + 회귀 `node scripts/selftest-board-privacy.mjs`·`selftest-integrity.mjs`(여전히 통과 — photo 옵셔널이라 무영향).
- [ ] **Step 3: 빌드**: `taskkill //F //IM node.exe 2>/dev/null; rm -rf .next && npm run build`.
- [ ] **Step 4: 수동(dev, 유료 키 필요)**: 학생 로그인 → 사진 업로드(압축됨) → "내 사진으로 퍼즐" 생성 → 미리보기에 사진 보임(치환) → 교실 보드 업로드 → 멤버 미리보기 사진 보임 → 공유 PIN 페이지서 사진 보임 → ZIP 다운로드 HTML에 사진 인라인. 쿼터 2 차감 확인. **공개 보드 흐름엔 사진 위젯 미노출**·일반 사용자 photo create rules 거부 확인.
- [ ] **Step 5: PR**: `feat/photo-upload`. self-test 미커밋 유지. **유료 Gemini 티어 필요**(릴리스 노트). rules 변경 배포 완료 명시.

---

## Self-Review (작성자 점검)

**Spec 커버리지:** §5.1 모델=T1, §5.2 업로드/압축/배너=T4·T5, §5.3 멀티모달=T7·T8, §5.4 치환=T1·T3·T6, §5.5 rules=T2, §5.6 쿼터2배=T9, §5.7 안전=Gemini필터(T8 멀티모달)+rules(T2)+배너(T5), §5.8 수정모드=update rules(T2)+photo 유지(클라). §9 단계=Phase1~5. ✅
**타입 일관성:** `substitutePhoto(code, photo?)`(T1)→T3·T6 사용; `Post.photo: string`(T1)→rules `photo`(T2)·createPost(T6)·share(T3); `GenerateInput.photo:{data,mimeType}`(T7)→route 파싱(T8)·gemini(T7); `reserveStudentQuota(uid,cost)`(T9). ✅
**플레이스홀더:** 압축 타깃/캡 수치는 실값(768/0.7/160000/350000), 구현 시 실측 조정 여지만. 치환은 call-site(buildPreviewDoc 시그니처 무변경 — 스펙의 buildPreviewDoc(code,photo)보다 DRY). ✅
**위험:** 멀티모달은 유료 키 없으면 무료 티어로 동작하나(학습 사용 약관) — 수동검증 전 결제 활성화 필요. rules photo 검증은 create+update 양쪽.

## 단계 분리 가능
Phase 1(plumbing)은 사진 없이도 머지 가능(회귀 0). Phase 2~4 머지 후 수동검증 시 유료 키 필요. rules(Task 2)는 배포 동반.
