# 사진 미리보기 — 서빙-시점 치환 (1MB 오버플로 보완) · 설계 스펙

- 상태: 설계(승인됨) · 날짜: 2026-06-29
- 다음: writing-plans로 구현 플랜
- 선행: **사진 업로드 기능(feat/photo-upload) 머지 완료**. 이 스펙은 그 후속 개선.
- 관계: **사진 업로드 스펙(2026-06-26) §5.4의 "저장-시점 치환"을 이 스펙이 대체**한다(저장-시점 → 서빙-시점). 나머지(§5.1 토큰/별도필드, ZIP 인라인 치환 등)는 유효.

## 1. 문제

`substitutePhoto`(`lib/ai/photo.ts`)는 생성 코드의 `__PHOTO__` 토큰을 사진 data-URI로 **전역 치환**한다. AI가 `__PHOTO__`를 여러 번 쓰면(예: 9칸 DOM 직소퍼즐에서 칸마다 `background-image: url(__PHOTO__)`), `putPreview`에 저장되는 미리보기 doc에 data-URI(압축 ~160KB, 캡 350KB)가 **N번 인라인**되어 **Firestore 1MB 문서 한계(`previews` 컬렉션)를 초과 → `putPreview` throw → 미리보기 "불러오지 못했어요" 500**.

- 압축 ~160k자 기준 ~5~6회까지는 OK라 흔치는 않지만, **DOM 다칸 퍼즐류에서 발생 가능**. 직소 퍼즐은 사진 기능의 대표 사례(업로드 스펙 §1 첫 예시)라, 그 마퀴 사례에서 실패하는 게 약점.
- **코드 슬라이싱형 퍼즐**(사진 1장→canvas→조각)은 `__PHOTO__` 1회 참조라 무관. **DOM 다중참조만 문제**.
- 저장(`post.photo`는 1회 별도 저장)·보안엔 무관. **미리보기 UX만 저하**.

### 영향 경로 (1MB가 실제로 걸리는 곳 = `putPreview` 쓰기)

| 경로 | 현재 | 사진 위험 |
|---|---|---|
| `POST /api/preview` | `putPreview(buildPreviewDoc(substitutePhoto(code, photo)))` | **있음** (즉석 생성·교실 멤버 미리보기) |
| `POST /api/share/[postId]` | `putPreview(buildPreviewDoc(substitutePhoto(post.code, post.photo)))` | **있음** (공유 PIN 미리보기) |
| `GET /api/preview/post/[id]` | `buildPreviewDoc(code)` (putPreview 미사용, 공개 글) | 없음 (공개 글은 rules상 photo 금지·교실 글은 404) |
| ZIP 다운로드 (`downloadZip.ts`) | 클라 인라인 치환 | 없음 (Firestore 밖, 캡 무관) |

## 2. 결정 (브레인스토밍)

| 항목 | 결정 |
|---|---|
| 전략 | **④ 서빙-시점 치환** + **③ 프롬프트 유도**. (①크기가드·②참조-1회-재작성은 비채택 — 근거 아래.) |
| 치환 시점 | 펼치기를 **저장 시점 → 서빙 시점**으로 이동. 1MB는 Firestore 문서에만 걸리고 HTTP 응답엔 무제한. 작은 토큰코드+사진1장을 저장하고 **읽을 때** 펼침. |
| 결정성 | ④는 **N과 무관하게 결정적**으로 안전(저장 필드가 캡으로 바운드). ③은 확률적 품질·크기 보조이지 보장 아님. |

### 비채택 근거
- **① 크기 가드만**: throw를 친절 메시지로 바꿀 뿐, 대표 사례(직소)에서 미리보기가 **여전히 안 됨**(우아한 실패에 그침).
- **② 참조 1회로 재작성**: `substitutePhoto`는 *맹목적* `split/join`이고, `__PHOTO__`가 HTML `src`·CSS `url()`·JS 문자열 **세 문맥**에 들어가 셋 다에서 단일 정의를 가리키는 참조형이 없음 → 신뢰성 있게 못 함. ④가 ②의 의도("N번 인라인 안 함")를 **저장 doc을 안 만드는 방식**으로 더 깔끔히 달성.

## 3. 설계

### 3.1 `lib/preview-store.ts` — 계약 변경 (핵심)

```ts
// 저장: 펼친 doc 문자열 → 토큰코드 + 사진(별도 필드)
putPreview(code: GeneratedCode, photo?: string): Promise<string>   // { code, photo?, exp } 저장
// 서빙: 읽는 시점에 펼침
getPreview(id): Promise<string | null>   // buildPreviewDoc(substitutePhoto(code, photo)) 반환
```

- `putPreview`: 토큰 코드 + 사진을 **별도 필드**로 저장. **사진 없으면 `photo` 키 자체를 생략**(`undefined` 저장 금지 — Firestore가 거부). `exp`/기회적 청소 로직 불변.
- `getPreview`: 읽는 시점에 `substitutePhoto(data.code, data.photo)` → `buildPreviewDoc(...)` → 펼친 doc 문자열 반환. 만료 처리 불변. **깨진/구버전 레코드(`!data.code`)는 `null`** 반환 → GET 라우트가 친절한 404.
- 새 import: `buildPreviewDoc`(`@/lib/program`), `substitutePhoto`(`@/lib/ai/photo`), `GeneratedCode`(`@/lib/ai/types`) — 전부 `server-only` 안전(둘 다 types만 의존, 클라 전용 의존 없음).

**결정적 바운드(왜 안전한가):** 저장 필드 = `html`+`css`+`javascript`(각 ≤150k, 기존 `MAX_PART`/rules 캡) + `photo`(≤400k, `/api/preview` 캡) ≈ **850k자**, **N과 무관**. N번 인라인은 이제 **서빙 HTTP 응답**에만 존재하고 거긴 1MB 한계 없음. 브라우저는 수 MB HTML 정상 처리, 반복 data-URI는 gzip으로 전송량 거의 0.

### 3.2 호출부 (각 한 줄로 축소)

- **`POST /api/preview`** (`app/api/preview/route.ts`): `substitutePhoto`+`buildPreviewDoc` 두 줄 제거 → `const id = await putPreview({ html, css, javascript }, typeof photo === 'string' ? photo : undefined)`. **`MAX_PART`(150k)·photo 크기캡(400k)은 유지** — 이게 이제 저장 doc < 1MB를 보장하는 장치. 해당 import 2개 제거.
- **`POST /api/share/[postId]`** (`app/api/share/[postId]/route.ts`): `await putPreview(code, post!.photo as string | undefined)`. `substitutePhoto`+`buildPreviewDoc` import 제거. (`post.code`·`post.photo`는 rules로 이미 ≤150k/≤350k 검증됨 → 저장 ≤800k.)
- **`GET /api/preview/[id]`** (`app/api/preview/[id]/route.ts`): **변경 없음**. `getPreview`가 이미 펼친 doc을 반환하므로 라우트는 그대로 서빙. (변경 범위가 작은 이유.)
- **`GET /api/preview/post/[id]`**: **변경 없음**. 교실 글은 404, 공개 글은 rules상 photo 없음 → 사진 doc을 서빙할 일 없음.

### 3.3 `lib/ai/prompts.ts` — 프롬프트 유도 (③, 보조)

`PHOTO_INSTRUCTION`에 **권장사항**(강제 아님 — ④가 진짜 보장) 추가:
- 사진은 **한 번만 로드**: 단일 `new Image()`/`<img>`로 `__PHOTO__`를 1회 불러와 `<canvas>`에 그려 재사용.
- 같은 사진을 여러 칸·여러 곳에 보일 때도 `__PHOTO__`를 곳곳에 반복하지 말고, 1회 로드한 이미지를 `drawImage`로 잘라 쓰거나 복제해 그림.
- 퍼즐은 사진 1장을 canvas에 그린 뒤 조각으로 나누는 방식 **권장**.
- 기존 지시(외부 이미지 금지·`object-fit`·런타임 `naturalWidth/Height`·`KID_CONTRACT`)는 유지. 톤은 **권장("권합니다/좋아요")**, 금지 아님(2~3회 정당한 반복까지 막지 않게 — 어차피 ④가 백스톱).

## 4. 데이터 흐름 (변경 후)

1. 생성/공유 → `putPreview(tokenCode, photo)` → `previews/{id}` = `{ code, photo?, exp }` (작음, N 무관).
2. iframe이 `GET /api/preview/[id]` 로드 → `getPreview` 가 `substitutePhoto`+`buildPreviewDoc` 으로 펼친 doc 반환 → 교차사이트 iframe 서빙(보안 헤더 불변).
3. N번 인라인은 2번의 HTTP 응답에만 존재(무제한). 저장은 항상 1장.

## 5. 검증

- **`tsc --noEmit`**: `putPreview` 시그니처 변경이 모든 호출부를 컴파일 단에서 잡음(내장 안전망). + **`npm run build`**.
- **미커밋 self-test**(`scripts/selftest-*.mjs`, CLAUDE.md 규칙 — Admin SDK 시드 후 **서버 API** 경유 검증, 끝에 정리):
  - `__PHOTO__` ×9 + ~160k 사진을 넣은 코드로 `POST /api/preview` → **200 + previewId**(기존엔 500). `GET /api/preview/[id]` → data-URI **9번** 든 doc.
  - `putPreview` 저장 레코드가 펼친 doc이 아니라 `{ code(토큰), photo }` 임을 확인(Admin SDK read).
  - 사진 없는 코드 → `photo` 필드 미저장 확인. 구버전/사진없는 글 → 무동작·정상 미리보기.
- **수동(dev)**: 학생으로 다칸 사진 퍼즐 생성 → 미리보기 성공 → 교실 업로드 → 멤버 미리보기 → 공유 PIN 보기. (기존 §5.4 수동 흐름 회귀.)
- rules 변경 없음 → `firebase deploy` 불필요.

## 6. 잔여 / 열린 질문

- **한글-바이트 잔여(기존부터 있던 문제, 그대로 둠)**: 캡은 `.length`(문자) 기준인데 Firestore는 UTF-8 **바이트**로 1MB를 셈. 병적으로 전부 한글인 150k자 필드 = 450k바이트 → 그런 필드 3개면 사진과 무관하게 여전히 초과 가능. 단 (a) 이는 **저장-시점 doc을 쓰던 현재도 동일**한 선재 문제, (b) 실제 생성 HTML/CSS/JS는 95%+ ASCII라 여유 큼, (c) 사진 N× 문제와 직교. → **바이트 가드(①) 비채택**, 본 스펙 범위 밖으로 명시. 추후 트래픽·실측에서 재검토.
- **`/api/preview/post/[id]` 일관성(선택, 비채택)**: 모든 서빙 경로를 `substitutePhoto` 경유로 통일하면 일관적이나, 이 경로는 사진 글을 서빙하지 않으므로 무의미한 변경 — 안 함.
- 압축 타깃·photo 캡 수치는 업로드 스펙(2026-06-26) §10 그대로 유효.

## 7. 변경 파일 요약

| 파일 | 변경 |
|---|---|
| `lib/preview-store.ts` | `putPreview(code, photo?)` 시그니처·`{code,photo,exp}` 저장 / `getPreview`가 서빙 시점에 `substitutePhoto`+`buildPreviewDoc` (+import 3) |
| `app/api/preview/route.ts` | `putPreview(code, photo)` 호출 / `substitutePhoto`·`buildPreviewDoc` 제거 / 캡 유지 |
| `app/api/share/[postId]/route.ts` | `putPreview(post.code, post.photo)` 호출 / import 2 제거 |
| `lib/ai/prompts.ts` | `PHOTO_INSTRUCTION`에 "1회 로드·canvas 재사용" 권장 블록 추가 |
| `scripts/selftest-*.mjs` | (미커밋) 9회 참조 오버플로 회귀 검증 |
| `app/api/preview/[id]/route.ts`, `.../post/[id]/route.ts` | **변경 없음** |
