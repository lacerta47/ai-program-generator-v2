# Design

대상 앱: `ai-program-generator` (Next.js 15 + Tailwind v4). 초등 저학년도 쓰는 AI 프로그램 생성기.

## Theme

밝고 다정한 장난감 같은 인터페이스. 라이트가 기본 무드(교실·집 낮 사용), 다크 모드 동등 지원. 마스코트·이모지 장식 없음 — 생동감은 컬러·둥근 형태·CSS 모션으로.

## Color (OKLCH)

| Token | Light | Dark | 용도 |
|---|---|---|---|
| `--bg` | oklch(0.977 0.008 270) | oklch(0.195 0 0) | 페이지 배경 (라이트=브랜드 블루 0.008 미세 틴트 / 다크=중립 그레이) |
| `--surface` | oklch(1 0 0) | oklch(0.245 0 0) | 카드/패널 |
| `--surface-2` | oklch(0.955 0.012 270) | oklch(0.29 0 0) | 입력/보조 패널 |
| `--ink` | oklch(0.30 0.02 285) | oklch(0.985 0 0) | 본문 |
| `--muted` | oklch(0.50 0.02 285) | oklch(0.73 0 0) | 보조 텍스트 (4.5:1 확보) |
| `--line` | oklch(0.90 0.012 270) | oklch(1 0 0 / 0.13) | 보더 (다크는 흰색 13% 알파) |
| `--brand` | oklch(0.585 0.19 272) | oklch(0.68 0.16 272) | 주요 액션 (#5B7CFA 계열) |
| `--brand-strong` | oklch(0.53 0.2 272) | oklch(0.74 0.15 272) | 브랜드 hover·강조(진한 단계) |
| `--brand-ink` | white | oklch(0.18 0.03 272) | 브랜드 위 텍스트 |
| `--brand-soft` | oklch(0.93 0.045 272) | oklch(0.34 0.06 272) | 선택/소프트 배경 |
| `--mint` | oklch(0.76 0.13 175) | 동일 | 액센트(성공·칩) |
| `--sunshine` | oklch(0.84 0.15 85) | 동일 | 액센트(칩·장식) |
| `--coral` | oklch(0.72 0.16 35) | 동일 | 액센트(삭제·칩) |
| `--grape` | oklch(0.66 0.15 305) | 동일 | 액센트(칩) |

전략: Restrained+. 브랜드 블루가 주요 액션·선택 상태를 끌고, 4색 액센트는 카테고리 칩·빈 화면 장식·성공 피드백에만. 비활성 상태에 고채도 금지.

다크 중립 정책: 다크는 의도적으로 **중립 그레이(채도 0, MUI 다크 참고)** — 순수 검정보다 살짝 들어올려 가독성 우선. 미세 블루 틴트는 라이트에만. 브랜드·액센트만 다크에서 채도를 유지한다.

### 액센트 칩 토큰 (soft/ink)

각 액센트(mint/sunshine/coral/grape)는 **베이스 1개 + 칩용 2개**로 구성된다: `-soft`(옅은 배경) 위에 `-ink`(그 위 글자)를 얹어 칩·토스트·삭제 버튼을 만들고, 베이스 색은 보더·hover에 쓴다. 라이트/다크에서 `-soft`·`-ink`만 따로 재정의해 칩 가독성을 유지하며, 베이스 4색은 양쪽 동일.

| 토큰 | Light (soft / ink) | Dark (soft / ink) |
|---|---|---|
| `--mint-soft` / `--mint-ink` | oklch(0.95 0.04 175) / oklch(0.35 0.09 175) | oklch(0.33 0.05 175) / oklch(0.85 0.1 175) |
| `--sunshine-soft` / `--sunshine-ink` | oklch(0.96 0.05 85) / oklch(0.42 0.11 75) | oklch(0.34 0.05 85) / oklch(0.88 0.12 90) |
| `--coral-soft` / `--coral-ink` | oklch(0.95 0.04 35) / oklch(0.42 0.14 35) | oklch(0.33 0.05 35) / oklch(0.84 0.11 35) |
| `--grape-soft` / `--grape-ink` | oklch(0.94 0.04 305) / oklch(0.4 0.12 305) | oklch(0.33 0.05 305) / oklch(0.85 0.09 305) |

## Typography

- 제목/큰 CTA/필드 제목: **Jua** (`--font-display`) — 둥글고 다정한 한글 디스플레이. h1 28px, h2 22px, h3 18px. 큰 버튼(size `lg`)·필드 제목(`Label`, 20px)도 Jua.
- 본문/입력 글씨/중간 버튼: **Gowun Dodum** (`--font-body`) — 본문 17px, line-height 1.7. 보조 14px(최소).
- 푸터 액센트: **Geist Mono** (`--font-geist-mono`) — 랜딩 푸터의 라틴·숫자 전용.
- 로고 글꼴(Chakra Petch)은 아래 **Wordmark** 섹션 참조.
- 고정 rem 스케일(클램프 없음), 스케일비 ~1.2.

## Shape & Space

- radius: 카드 20px(`--r-lg`), 버튼/입력 14px(`--r-md`), 칩 pill.
- 탭타깃 ≥48px, 입력 높이 ≥48px. 섹션 여백 24~32px.
- 보더: 버튼·입력 **2px**(톤 `--line`, hover 시 brand). focus = brand 보더 + `brand-soft` 4px 링, 전역 `:focus-visible` 3px outline.

## Motion (생동감의 원천 — 모두 reduced-motion 가드)

- 이징 토큰: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint). 대부분의 전환에 사용.
- press(`.press`): active scale(0.96) → 150ms 복귀. Button primary는 추가로 "입체 그림자 눌림"(그림자 4px→0 + translateY).
- pop-in(`.anim-pop-in`): 카드/리스트 등장 fade + 8px up + scale(0.98), 220ms; 리스트(`.stagger`)는 40ms 간격.
- success pop(`.anim-pop`): scale 0.6 → 1.12(오버슈트) → 1, 250ms.
- pop-tada(`.anim-pop-tada`): scale 0.9 → 1.06 → 1, 360ms — 주목·축하용 톡.
- loading(`LoadingDots`): 점 3개 bounce — 스피너 대체.
- tab indicator: 활성 탭 배경 슬라이드 200ms.
- hover lift(`.lift`): translateY(-2px) + 보더 강조, 180ms.
- hover wiggle(`.hover-wiggle`): 부모 `.group` 호버 시 아이콘 0.5s 흔들.
- float(`FloatingShapes`): 빈 화면 CSS 도형(원/사각/삼각) 6~8s 부유. 장식 모션은 빈 화면에서만 허용.
- BuilderBot(로딩 로봇)·LUN 워드마크 반짝임은 자체 모션(Components/Wordmark 참조). 전부 reduced-motion 가드.

## Components

`components/ui/` 프리미티브만 사용:

- **Button** — variant primary/soft/ghost/danger, size md/lg/icon. primary는 "입체 그림자 눌림" 프레스. 기본 variant=ghost, radius `--r-md`.
- **Card** — 카드/패널 surface(등장 시 pop-in 옵션).
- **Field 모듈** — `TextInput`·`TextArea`·`Select`·`Label`(필드 제목, Jua 20px)·`HelpTip`(? 도움말 말풍선, body로 portal). focus = brand 보더 + `brand-soft` 4px 링.
- **Chip** — 카테고리 칩(brand/mint/sunshine/coral/grape), active/idle 상태. `-soft`/`-ink` 토큰 사용(Color 참조).
- **LoadingDots** — 점 3개 로딩(role=status).
- **FloatingShapes** — 빈 화면 장식 도형(부유).
- **Modal** — 둥근 카드 + 백드롭 블러. 반드시 `createPortal(…, document.body)`(헤더 blur 함정 회피).
- **Toast** — error/success 알림(ToastProvider).
- **CodeView** — 구문 강조 코드 뷰어(라인 번호, 팔레트 라이트/다크 자동).
- **BuilderBot** — 로딩 화면용 순수 CSS 로봇(오리지널, 유일한 예외 마스코트).
- **SoundToggle** — 효과음 on/off 토글.
- **ConfirmProvider** — 확인 다이얼로그(window.confirm 대체).
- **FullscreenFrame** — 미리보기 전체화면 프레임.

## Wordmark (LUN 로고)

- 폰트: **Chakra Petch 700** (`--font-wordmark`) — 각진 테크 톤. **로고 전용**(헤더·랜딩·푸터). 본문·UI엔 쓰지 않는다.
- 반짝임(`.lun-shiny`): 잉크색 글자 위로 브랜드색 빛줄기가 흐르는 효과 — `background-clip: text` 그라데이션, 10s 루프.
- ⚠️ **그라데이션 텍스트는 워드마크/로고 한정 예외.** 일반 제목·본문·버튼엔 절대 쓰지 않는다(가독성·완성도 저하). reduced-motion 시 효과를 풀고 단색 잉크로 표시.
