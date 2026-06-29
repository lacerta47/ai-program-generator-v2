# 사진 업로드 기능 — 설계 스펙

- 상태: 설계(승인됨) · 날짜: 2026-06-26
- 다음: writing-plans로 구현 플랜
- 선행: **보드 리뉴얼 Plan 1+2 완료**(교실 보드 비공개 + 공유 PIN, main 반영). 사진은 그 위에 올림.

## 1. 목표 / 동기

아이가 **자기 사진**을 올려 그걸 활용한 프로그램(직소 퍼즐·필터·스티커·사진 게임·내용 기반 꾸미기)을 만든다. "내가 만들었다" 자부심(PRODUCT.md 성공지표)을 키운다.

## 2. 확정 결정 (브레인스토밍)

| 항목 | 결정 |
|---|---|
| 스코프 | **학생(+교사 시연) 전용**. 사진은 교실 보드에만 게시 가능하고 학생 글은 항상 교실행이라 일관. 일반 사용자(공개 보드)는 사진 없음. |
| 장수 | **1장**(MVP). placeholder `__PHOTO__` 1개. |
| 활용 수준 | **Level 2** — Gemini가 사진을 **보고**(멀티모달) 내용까지 인식해 활용. 단 코드 속 이미지 소스는 런타임 `__PHOTO__` 토큰으로 치환. |
| Gemini 티어 | **유료(학습 미사용)** — 아이 사진이 학습에 안 쓰이게. **결제 활성화 선행(사용자 작업)**. |
| 저장/치환 | **별도 `photo` 필드 + 토큰**. `code`엔 작은 토큰, post에 data-URI, 렌더 시 치환. (인라인=150k캡 위협·기각, 외부 Storage=Blaze·자기완결 깨짐·기각.) |
| 쿼터 | 사진 생성은 **이용한도 2단위 차감**(멀티모달 비용↑). |

## 3. 현재 구조 (기반)

- 생성: `components/creator/Creator.tsx`·`components/survey/SurveyWizard.tsx` → `requestGenerateStream(prompt, mode, variant)` → `POST /api/generate`(NDJSON 스트리밍) → `lib/ai/provider.ts`→`lib/ai/gemini.ts`. 시스템 프롬프트는 서버가 variant로 선택(`lib/ai/prompts.ts`, `KID_CONTRACT` 포함, **외부 이미지 금지**).
- 쿼터(`app/api/generate/route.ts`): 학생=`reserveStudentQuota(uid)`(공유 풀+일일/총 캡)/`refundStudentQuota`, 교사·admin=일일 `ROLE_DAILY_LIMIT` 카운터. **Gemini 호출 전 차감**, 실패 1회 환불.
- 미리보기: `POST /api/preview`(코드 → `buildPreviewDoc`(`lib/program.ts`) → `putPreview`(`lib/preview-store.ts`, TTL) → 교차사이트 iframe). 게시물=공개 글 `GET /api/preview/post/[id]`, 교실 글=멤버가 POST 경로(보드 리뉴얼 Task E).
- 저장: `createPost`(`lib/firebase/posts.ts`, 클라). `Post`에 `code{html,css,javascript}`·`boardTeacherUid`. `firestore.rules` validPost(code 각 150k, 문서 1MB).
- 공유: `POST /api/share/[postId]`(PIN → `putPreview(buildPreviewDoc(post.code))`).
- ZIP: 다운로드(코드 3파일).

## 4. 범위

**In:** 사진 업로드·압축 UI(학생/교사), 멀티모달 생성, 토큰+별도필드 저장, 전 렌더 경로 치환, rules(photo 크기캡·교실 한정), 시스템 프롬프트 사진 지시, 쿼터 2배, 고지 배너, 수정 모드 사진 유지.
**Out:** 사진 2장 이상, 공개 보드 사진, 사진 자동검열(신고 노선 유지), Storage 기반.

## 5. 설계

### 5.1 데이터 모델

| 위치 | 변경 |
|---|---|
| `Post` (`lib/firebase/types.ts`) | `photo?: string`(data-URI) 신규. `code`엔 `__PHOTO__` 토큰만(필드캡 안전). |
| `firestore.rules` validPost | `'photo'` 화이트리스트 추가 + 검증: `photo`는 `data:image/`로 시작·길이 ≤ **350000자**(≈260KB) + **`boardTeacherUid != null`일 때만 허용**(공개 보드 금지). |

토큰: 코드 어디서든 이미지 소스로 `__PHOTO__` 리터럴. 치환 = 공용 헬퍼 `substitutePhoto(code: GeneratedCode, photo?: string): GeneratedCode`(`lib/ai/photo.ts` 신규) — `photo` 있으면 html/css/js의 `__PHOTO__`를 data-URI로 replaceAll, 없으면 빈 1×1 투명 png data-URI로(깨짐 방지).

### 5.2 업로드·압축 (클라)

- 생성 화면(Creator·SurveyWizard)에 **사진 1장** 업로드(파일 input + 미리보기 썸네일 + 제거). **로그인 학생/교사에게만 노출**.
- 압축: `lib/client/imageCompress.ts`(신규) — canvas로 최대 변 ~768px 리사이즈 + JPEG `quality 0.7` → data-URI. 결과가 ~120KB(≈160k자) 초과면 quality 단계적 하향, 그래도 크면 거부("사진이 너무 커요").
- **고지 배너**(업로드 영역): "사진은 **AI가 보고** 프로그램을 만들어요. 우리 반과 선생님만 볼 수 있어요. **친구·가족 얼굴은 올리지 않는 게 좋아요.**" (교사/보호자 인지용 톤.)

### 5.3 생성 (멀티모달)

- 클라: 사진 있으면 `requestGenerateStream`에 photo(data-URI) 동봉 → `POST /api/generate` 본문에 `photo` 추가.
- route: photo 있으면 (a) **쿼터 2단위 차감**(아래 5.6), (b) provider에 photo 전달.
- `lib/ai/gemini.ts`: photo 있으면 요청에 **이미지 파트**(inlineData: base64 + mimeType) 추가(멀티모달). 텍스트는 계획서 + 시스템 프롬프트.
- 시스템 프롬프트(`prompts.ts`): photo 있을 때 서버가 사진 지시 블록 append —
  > "사용자가 사진 1장을 첨부했습니다. 사진을 보고 계획서대로 **그 사진을 활용하는** 프로그램(퍼즐·필터·스티커·사진 게임·꾸미기 등)을 만드세요. 코드에서 이미지 소스는 **반드시 `__PHOTO__` 리터럴**을 쓰고(그 사진을 다시 그리거나 다른 URL을 쓰지 마세요), 사진의 정확한 크기·비율은 모를 수 있으니 `object-fit`·런타임 `naturalWidth/Height`로 어떤 사진에도 맞게 하세요."
  (기존 외부 이미지 금지·`KID_CONTRACT`는 유지.)
- Gemini는 사진 내용을 인식해 코드 생성(예: 강아지 사진 → 강아지 테마 퍼즐). 런타임 이미지는 `__PHOTO__`로.

### 5.4 미리보기·저장·렌더 (치환)

- **생성 중 미리보기**: 클라가 `POST /api/preview` 본문에 `photo` 추가 → route가 `buildPreviewDoc(code, photo)`로 치환해 doc 생성·`putPreview`. (`code`는 토큰이라 150k 안전; 치환된 doc은 previews 문서로 1MB 안.)
- `buildPreviewDoc(code, photo?)` 시그니처 확장 → 내부에서 `substitutePhoto` 적용.
- **저장**: `createPost`가 `code`(토큰) + `photo`(data-URI) 저장. UploadDialog는 학생(교실 보드)일 때만 photo 포함.
- **공유 API**: `buildPreviewDoc(post.code, post.photo)`로 치환(한 줄).
- **보드 멤버 미리보기**: 교실 사진 글은 멤버가 POST 경로 사용(Task E) — `FullscreenFrame`이 photo도 함께 `POST /api/preview`.
- **ZIP**: HTML 파일 빌드 시 `__PHOTO__`→data-URI 인라인 치환(ZIP은 캡 밖).

### 5.5 firestore.rules

- validPost: `photo` 화이트리스트 + (`!('photo' in d)` 또는 (`photo` is string && `data:image/` 접두 && size ≤ 350000 && `boardTeacherUid != null`)). 즉 **공개 보드(boardTeacherUid null) 글엔 photo 금지**.
- 수정(update) 규칙도 `photo` 변경 허용 필드에 추가(동일 검증). 변경 시 rules 배포.

### 5.6 쿼터 2배

- `reserveStudentQuota(uid, cost=1)`·`refundStudentQuota(uid, cost=1)`에 cost 인자 추가 — 사진 생성은 `cost=2`(풀·일일·총 캡 모두 2 차감, 대칭 환불).
- 교사·admin 일일 카운터: `count + cost <= dailyLimit`이면 `count + cost`, 아니면 429. 환불 `count - cost`. 사진=cost 2.
- cost는 route가 `photo` 유무로 결정. 차감은 Gemini 호출 전, 실패 시 2 환불(기존 1회 환불 로직을 cost 인지로).

### 5.7 안전

- **Gemini 멀티모달 안전필터**: 부적절 사진은 Gemini가 거부 → 빈/에러 응답(기존 친화 에러 경로). 이미지 검열을 일부 대신.
- **교실 비공개 + 교사 신고 인박스**(보드 리뉴얼) + **고지 배너**. 코드/이미지 서버검열은 기존대로 비채택.
- **유료 티어**라 사진이 Google 학습에 미사용(약관).

### 5.8 수정 모드

- 사진 글 수정 시 photo 유지(클라가 기존 photo 재첨부) → 멀티모달 재전송(쿼터 2배 동일). code의 `__PHOTO__` 토큰은 보존.

## 6. 선행 (사용자 작업 — 내가 못 함)

- **결제 활성화**: Google Cloud Billing(Blaze) 또는 유료 Gemini 키 → 유료 티어("학습 미사용"). 결제 정보 입력은 사용자 직접.
- 환경변수/모델: 2.5-flash 유지(멀티모달 지원). 비용 모니터링.

## 7. 에러 / 엣지

- 압축 후도 큰 사진 → "사진이 너무 커요, 더 작은 걸로." 거부.
- 비학생/비교사가 photo로 create → rules 거부(클라도 위젯 미노출).
- 공개 보드에 photo 글 업로드 시도 → rules 거부(클라 피커는 학생=교실만).
- Gemini가 안전상 거부 → 빈 결과 → 친화 에러 + 쿼터 환불.
- 미리보기/공유에서 photo 없는 구버전 글 → `substitutePhoto`가 토큰 없으면 무동작(안전).
- 쿼터 부족(2 필요한데 1 남음) → 429("오늘 사진 만들기는 2번이 필요해요").

## 8. 테스트 (self-test 미커밋 + 빌드 + 수동)

- **client-SDK(rules)**: 교실 글 photo create 허용(크기 안)·공개 글 photo 거부·photo 초과크기 거부·비-data:image 거부.
- **서버/유닛**: `substitutePhoto`(토큰 치환·없을 때 폴백)·`imageCompress`(목표 크기)·쿼터 cost=2(학생 풀 2 차감·교사 카운터 +2·환불 2).
- **멀티모달**: gemini.ts가 photo를 이미지 파트로 보내는지(키 있으면 실연결 1건)·`__PHOTO__` 토큰 코드 수신.
- **수동(dev)**: 학생으로 사진 업로드→압축→생성(퍼즐류)→미리보기 치환→교실 보드 업로드→멤버 미리보기→공유 PIN 보기→ZIP. 공개 보드엔 사진 위젯/업로드 차단 확인.

## 9. 구현 단계 (권장 순서)

1. **plumbing(멀티모달 무관)**: `substitutePhoto`·`buildPreviewDoc(code,photo)`·`/api/preview` photo·`Post.photo`·rules(photo 크기·교실한정)·ZIP 치환. (사진 없이도 회귀 0.)
2. **업로드·압축 UI**(학생/교사 생성 화면) + 고지 배너 + createPost photo.
3. **멀티모달 생성**: gemini.ts 이미지 파트 + 시스템 프롬프트 사진 지시 + /api/generate photo 전달.
4. **쿼터 2배**: studentQuota cost 인자 + route cost 결정.
5. **공유·보드 멤버 미리보기** photo 경로 마무리.
6. self-test·빌드·수동. (rules 변경분 `firebase deploy`.)

## 10. 열린 질문 / 수용 잔여

- 압축 타깃(768px·q0.7·≤120KB)·photo 크기캡(350000자): 구현 시 실측 조정.
- 사진 자동검열 없음(Gemini 필터 + 신고로 대처) — 수용.
- 결제·비용은 사용자 책임(유료 티어).
