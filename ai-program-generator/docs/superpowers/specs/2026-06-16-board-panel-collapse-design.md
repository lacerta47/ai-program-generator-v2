# 게시판 좌측 패널 접기/펼치기 설계

작성일: 2026-06-16

## 배경 / 목표
게시판은 2단 레이아웃(좌: "친구들의 작품" = 카테고리 트리 + 작품 목록 / 우: 미리보기)이다. 미리보기를 더 크게 보려고 **좌측 패널을 접어** 우측 미리보기가 넓은 폭을 쓰게 한다. 접으면 좌측엔 **얇은 띠**만 남고, 띠를 눌러 다시 편다. 순수 UI 변경(데이터·API·미리보기 파이프라인·규칙 불변).

## 결정 사항(확정)
- **데스크탑(lg+) 전용**: 모바일(<lg)은 이미 세로 1단 스택이라 미리보기가 폭 전체를 쓴다 → 접기 토글 비노출, 항상 전체 패널.
- **접힌 모습 = 얇은 띠(항상 보임)**: 트리·목록은 숨고, 띠에 펼치기 버튼 + 세로 라벨 "친구들의 작품".
- **상태는 세션 로컬**(`useState`, 기본 펼침). 새로고침 시 펼친 기본값. 영속화는 비범위.

## 동작 / 레이아웃
- `BoardView`에 `collapsed: boolean` 상태(기본 `false`).
- 바깥 그리드 컬럼(현재 `lg:grid-cols-[minmax(320px,2fr)_3fr]`)을 상태로 분기:
  - 펼침: `lg:grid-cols-[minmax(320px,2fr)_3fr]`(현행 유지).
  - 접힘: `lg:grid-cols-[3rem_1fr]`(좌측 얇은 띠 + 우측 미리보기 거의 전체 폭).
  - `<lg`에선 두 경우 모두 기본 1단(베이스에 grid-cols 없음)이라 `collapsed`가 레이아웃에 영향 없음.
- 좌측 `<section>`은 **전체 콘텐츠 블록**과 **얇은 띠 블록**을 모두 렌더하고 가시성으로 토글(반응형 + 상태 조합):
  - 전체 콘텐츠: `collapsed`면 `lg:hidden`(데스크탑에서만 숨김, `<lg`에선 항상 보임). 즉 `collapsed ? 'flex lg:hidden' : 'flex'`.
  - 얇은 띠: `collapsed`일 때 데스크탑에서만 표시 → `collapsed ? 'hidden lg:flex' : 'hidden'`.

## UI
- **접기 버튼**: 좌측 "친구들의 작품" `<h2>` 헤더 옆에 아이콘 버튼(`PanelLeftClose`, lucide). `hidden lg:inline-flex`로 데스크탑에서만 노출. 클릭 → `collapsed=true`.
- **얇은 띠**: 세로 정렬 — 상단에 펼치기 버튼(`PanelLeftOpen`) + 그 아래 세로 라벨 "친구들의 작품"(`writing-mode: vertical-rl` 또는 회전). 띠 영역/버튼 클릭 → `collapsed=false`. 폭 ~3rem, 패딩은 띠에 맞게 슬림하게.
- 두 버튼 모두 큰 탭타깃(≥44px), `press`/`lift` 등 기존 모션 유틸·토큰 사용.

## 애니메이션
- grid 트랙 형태(`minmax(320px,2fr)_3fr` ↔ `3rem_1fr`)는 보간이 깔끔하지 않아 폭 자체의 부드러운 전환은 스냅될 수 있음 → **v1은 레이아웃은 즉시 전환**, 새로 나타나는 블록(띠/패널)에 가벼운 페이드(`anim-pop-in` 류)만 적용.
- 모든 모션은 `prefers-reduced-motion: reduce`에서 비활성(globals.css 가드 준수).

## 범위
- 수정 파일: `components/board/BoardView.tsx` **만**.
- 미리보기 컴포넌트(`PostPreview`/`FullscreenFrame`)·`CategoryTree`·`PostList`·데이터·인덱스·`firestore.rules` **변경 없음**.
- 비범위: 모바일 접기, 상태 영속화(localStorage/URL), 우측 미리보기 패널 접기.

## 검증 기준 (완료 정의)
1. `tsc --noEmit` + 프로덕션 빌드 통과.
2. 데스크탑(lg+) 게시판에서 "친구들의 작품" 헤더 옆 접기 버튼 클릭 → 좌측이 얇은 띠로 줄고 우측 미리보기가 눈에 띄게 넓어짐.
3. 얇은 띠의 펼치기 버튼(또는 띠) 클릭 → 원래 2단으로 복원.
4. 브라우저 폭을 `<lg`로 줄이면 접기 버튼·띠가 사라지고 항상 전체 패널(세로 스택)로 동작.
5. `prefers-reduced-motion`에서 페이드 모션 멈춤. 콘솔 에러 0. 기존 게시판 기능(트리·목록·미리보기·딥링크) 회귀 없음.

## 메모(구현 시 함께 점검)
- 현재 평면 카테고리인데 트리에 `aria-expanded` 토글이 6개 잡혔음 — `CategoryTree`가 잎새에도 토글을 그리는지(또는 다른 버튼이 잡힌 것인지) 구현 단계에서 확인. 잎새엔 토글이 없어야 정상.
- 이 기능은 `feature/nested-categories`의 `BoardView` 위에 얹힘 → 같은 흐름의 후속 작업으로 진행.
