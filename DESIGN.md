# Design

대상 앱: `ai-program-generator` (Next.js 15 + Tailwind v4). 초등 저학년도 쓰는 AI 프로그램 생성기.

## Theme

밝고 다정한 장난감 같은 인터페이스. 라이트가 기본 무드(교실·집 낮 사용), 다크 모드 동등 지원. 마스코트·이모지 장식 없음 — 생동감은 컬러·둥근 형태·CSS 모션으로.

## Color (OKLCH)

| Token | Light | Dark | 용도 |
|---|---|---|---|
| `--bg` | oklch(0.977 0.008 270) | oklch(0.21 0.018 285) | 페이지 배경(브랜드 블루 기 0.008 틴트) |
| `--surface` | oklch(1 0 0) | oklch(0.26 0.02 285) | 카드/패널 |
| `--surface-2` | oklch(0.955 0.012 270) | oklch(0.30 0.022 285) | 입력/보조 패널 |
| `--ink` | oklch(0.30 0.02 285) | oklch(0.94 0.008 270) | 본문 |
| `--muted` | oklch(0.50 0.02 285) | oklch(0.72 0.015 280) | 보조 텍스트 (4.5:1 확보) |
| `--line` | oklch(0.90 0.012 270) | oklch(0.36 0.02 285) | 보더 |
| `--brand` | oklch(0.585 0.19 272) | oklch(0.68 0.16 272) | 주요 액션 (#5B7CFA 계열) |
| `--brand-ink` | white | oklch(0.18 0.03 272) | 브랜드 위 텍스트 |
| `--brand-soft` | oklch(0.93 0.045 272) | oklch(0.34 0.06 272) | 선택/소프트 배경 |
| `--mint` | oklch(0.76 0.13 175) | 동일 | 액센트(성공·칩) |
| `--sunshine` | oklch(0.84 0.15 85) | 동일 | 액센트(칩·장식) |
| `--coral` | oklch(0.72 0.16 35) | 동일 | 액센트(삭제·칩) |
| `--grape` | oklch(0.66 0.15 305) | 동일 | 액센트(칩) |

전략: Restrained+. 브랜드 블루가 주요 액션·선택 상태를 끌고, 4색 액센트는 카테고리 칩·빈 화면 장식·성공 피드백에만. 비활성 상태에 고채도 금지.

## Typography

- 제목/큰 CTA: **Jua** (`--font-display`) — 둥글고 다정한 한글 디스플레이. h1 28px, h2 22px, h3 18px.
- 본문/라벨/버튼: **Gowun Dodum** (`--font-body`) — 본문 17px, line-height 1.7. 보조 14px(최소).
- 고정 rem 스케일(클램프 없음), 스케일비 ~1.2.

## Shape & Space

- radius: 카드 20px(`--r-lg`), 버튼/입력 14px(`--r-md`), 칩 pill.
- 탭타깃 ≥48px, 입력 높이 ≥48px. 섹션 여백 24~32px.
- 보더 1px `--line`, hover 시 brand로.

## Motion (생동감의 원천 — 모두 reduced-motion 가드)

- press: 버튼 active scale(0.96) → 150ms ease-out-quart 복귀.
- pop-in: 카드/리스트 등장 fade+8px up, 220ms; 리스트는 40ms stagger.
- tab indicator: 활성 탭 배경 슬라이드 200ms.
- loading: 점 3개 bounce(점프 0.5s 교차) — 스피너 대체.
- success: 체크/배지 scale 1.15 → 1 pop 250ms.
- float: 빈 화면 CSS 도형(원/사각/삼각) 6~8s 부유. 장식 모션은 빈 화면에서만 허용.
- 호버 lift: translateY(-2px) + 보더 강조, 180ms.

## Components

`components/ui/` 프리미티브만 사용: Button(primary/soft/ghost/danger), Card, TextInput, TextArea, Chip(액센트 컬러), LoadingDots, FloatingShapes. 모달은 둥근 카드 + 백드롭 블러.
