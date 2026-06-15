# 미리보기 확대 설계 (게시판 보수 B)

작성일: 2026-06-14

## 배경 / 목표
게시판 2단 레이아웃에서 미리보기 칸이 작아(~화면 55%) 세로로 긴 프로그램의 전체를 파악하기 어렵다. **인라인을 키우고**, **"크게 보기" 인앱 오버레이**로 큰 화면에서 스크롤하며 보게 한다. 순수 UI 변경(데이터·API·미리보기 격리 불변).

## 결정 사항(확정)
- 둘 다: 인라인 확대 + "크게 보기" 인앱 모달.
- 기존 OS 전체화면 토글(`requestFullscreen`)은 **인앱 모달로 교체**(저학년에 부드럽고 닫기 쉬움; `position:fixed`가 헤더 backdrop-blur에 갇히는 함정도 Modal 포털로 회피).
- `FullscreenFrame`은 공용이라 게시판 + 생성기(Creator) 미리보기 둘 다 적용.

## Part 1 — 인라인 확대 (`PostPreview`)
- 미리보기 컨테이너 높이 `min-h-[52vh]` → **`min-h-[65vh]`**. (필요 시 `BoardView` 우측 섹션 `min-h-[62vh]`도 상향해 잘리지 않게.)
- iframe은 그대로 `h-full` — 콘텐츠가 넘치면 iframe 내부에서 세로 스크롤(기존 동작 유지).

## Part 2 — "크게 보기" 인앱 모달 (`FullscreenFrame`)
- 제거: `isFullscreen` 상태, `fullscreenchange` 리스너, `requestFullscreen`/`exitFullscreen`, `Minimize` 아이콘.
- 추가: `expanded` 상태. 프레임 우상단 플로팅 버튼 = **"크게 보기"**(`Maximize`) → `expanded=true`.
- 렌더: 공용 `Modal`(포털·포커스트랩·Esc·스크롤락)로 큰 미리보기 —
  - `className="flex h-[90vh] w-[min(96vw,1100px)] max-w-none flex-col p-3"`, 헤더 행(제목 + 닫기 X) + `iframe src={src} className="min-h-0 w-full flex-1 ..." sandbox="allow-scripts"`.
  - **같은 `src`(이미 받은 미리보기 URL) 재사용** → 코드 객체 기준 WeakMap 캐시로 API 재요청 없음. **교차사이트 격리·sandbox 그대로** 유지.
  - 모달 iframe은 큰 높이를 채우고 내부 세로 스크롤로 전체 프로그램 파악.

## 영향 파일
- 수정: `components/ui/FullscreenFrame.tsx`(OS fullscreen → Modal 크게 보기), `components/board/PostPreview.tsx`(인라인 높이↑), 필요 시 `components/board/BoardView.tsx`(섹션 높이).
- 데이터·API·`firestore.rules`·미리보기 파이프라인 **변경 없음**.

## 검증 기준 (완료 정의)
1. 게시판 글 선택 → 미리보기 칸이 눈에 띄게 커짐(긴 프로그램이 더 많이 보임).
2. "크게 보기" → 큰 모달이 뜨고 **긴 프로그램을 세로 스크롤로 전부** 볼 수 있음. Esc·닫기·배경클릭으로 닫힘.
3. 생성기(Creator) 미리보기도 동일하게 "크게 보기" 동작.
4. 미리보기 격리 유지(교차사이트 URL·sandbox), 무한루프 코드가 탭을 안 얼림.
5. `tsc` + 프로덕션 빌드 통과, 콘솔 에러 0.
