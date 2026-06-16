# 게시판 좌측 패널 접기/펼치기 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판 좌측 "친구들의 작품" 패널을 데스크탑에서 접어 얇은 띠로 만들고, 우측 미리보기를 넓힌다.

**Architecture:** `BoardView`에 `collapsed` 로컬 상태를 두고, 바깥 그리드 컬럼 템플릿을 분기. 좌측은 전체 패널과 얇은 띠 두 블록을 모두 렌더하고 `collapsed` + 반응형(`lg:`) 가시성으로 토글. 데스크탑(lg+) 전용 — `<lg`는 항상 전체 패널(세로 스택).

**Tech Stack:** Next.js 15 App Router · React · Tailwind v4 · lucide-react.

**검증 도구 주의:** 단위 테스트 러너 없음. 검증 = `./node_modules/.bin/tsc --noEmit`(dev 띄운 채 안전) + 브라우저(코디네이터가 수행). dev 실행 중 `npm run build` 금지. git은 repo 루트 `C:/Users/amh47/Documents/test`에서. 현재 브랜치 `feature/nested-categories`(이 기능은 그 위 후속 작업). 커밋 footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## 파일 구조
- 수정: `ai-program-generator/components/board/BoardView.tsx` **단 하나**. (미리보기·트리·목록·데이터·규칙 불변.)

## 참고: 현재 `BoardView.tsx`의 관련 코드
- lucide import: `import { CloudOff, RotateCcw } from 'lucide-react';`
- `useState`는 이미 import됨(`import { useCallback, useEffect, useRef, useState } from 'react';`).
- 렌더 시작(현재):
  ```tsx
  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(320px,2fr)_3fr]">
      {/* 왼쪽: 카테고리 + 목록 */}
      <section className="anim-pop-in flex max-h-[80vh] flex-col gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="text-[21px]">친구들의 작품</h2>
        <CategoryTree ... />
        <div className="min-h-0 flex-1 overflow-y-auto"> ...목록/로딩/에러... </div>
      </section>

      {/* 오른쪽: 미리보기 */}
      <section className="anim-pop-in flex min-h-[72vh] flex-col ..." style={{ animationDelay: '60ms' }}>
        ...PostPreview...
      </section>

      <LoginDialog ... />
    </div>
  ```

---

## Task 1: 좌측 패널 접기/펼치기

**Files:** Modify `ai-program-generator/components/board/BoardView.tsx`

- [ ] **Step 1: lucide import에 패널 아이콘 추가**

`import { CloudOff, RotateCcw } from 'lucide-react';` 를 다음으로 교체:
```ts
import { CloudOff, RotateCcw, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
```

- [ ] **Step 2: `collapsed` 상태 추가**

컴포넌트 본문의 다른 `useState` 선언들 근처(예: `const [loginOpen, setLoginOpen] = useState(false);` 바로 아래)에 추가:
```ts
  // 데스크탑에서 좌측 목록 패널을 접어 미리보기를 넓히는 상태(세션 로컬)
  const [collapsed, setCollapsed] = useState(false);
```

- [ ] **Step 3: 바깥 그리드 컬럼을 상태로 분기**

렌더의 바깥 `<div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(320px,2fr)_3fr]">` 여는 태그를 다음으로 교체:
```tsx
    <div
      className={`mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 ${
        collapsed ? 'lg:grid-cols-[3rem_1fr]' : 'lg:grid-cols-[minmax(320px,2fr)_3fr]'
      }`}
    >
```

- [ ] **Step 4: 좌측 전체 패널에 접기 버튼 + 접힘 시 `lg:hidden`, 그리고 얇은 띠 추가**

좌측 `<section>` 블록 전체(여는 `<section className="anim-pop-in flex max-h-[80vh] ...">`부터 그 `</section>`까지)를 아래로 교체. 두 가지가 바뀐다: ① section className에 `${collapsed ? 'lg:hidden' : ''}` 추가, ② `<h2>` 줄을 헤더 행(제목 + 접기 버튼)으로 교체. **그 아래 `<CategoryTree>`와 목록 `<div>`는 그대로 둔다.** 이어서 닫는 `</section>` 다음에 얇은 띠 `<aside>`를 새로 추가한다.

좌측 전체 패널 — 여는 태그와 헤더만 교체(내부 CategoryTree/목록 div는 기존 유지):
```tsx
      {/* 왼쪽: 카테고리 + 목록 (접히는 전체 패널) */}
      <section
        className={`anim-pop-in flex max-h-[80vh] flex-col gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5 ${
          collapsed ? 'lg:hidden' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[21px]">친구들의 작품</h2>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="목록 접기"
            title="목록 접기"
            className="press hidden h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink lg:grid"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>
```
(이후 `<CategoryTree ... />`, 목록 `<div className="min-h-0 flex-1 overflow-y-auto"> ... </div>`, 그리고 `</section>`는 기존 그대로 유지.)

그 `</section>` 바로 다음에 얇은 띠 `<aside>` 추가:
```tsx
      {/* 접힌 띠 (데스크탑에서만 보임; 클릭하면 다시 펼침) */}
      <aside
        className={`anim-pop-in max-h-[80vh] flex-col items-center gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface py-4 ${
          collapsed ? 'hidden lg:flex' : 'hidden'
        }`}
      >
        <button
          onClick={() => setCollapsed(false)}
          aria-label="목록 펼치기"
          title="목록 펼치기"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <PanelLeftOpen size={20} />
        </button>
        <button
          onClick={() => setCollapsed(false)}
          aria-label="목록 펼치기"
          className="press flex-1 text-[14px] text-muted hover:text-ink"
          style={{ writingMode: 'vertical-rl' }}
        >
          친구들의 작품
        </button>
      </aside>
```

- [ ] **Step 5: 타입체크**

Run(`ai-program-generator/`): `./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음(종료코드 0).

- [ ] **Step 6: 커밋**

```bash
cd C:/Users/amh47/Documents/test
git add ai-program-generator/components/board/BoardView.tsx
git commit -m "$(printf 'feat(board): 좌측 목록 패널 접기/펼치기(데스크탑) — 미리보기 넓게 보기\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## 코디네이터 브라우저 검증 (구현 커밋 후)
1. 데스크탑 폭에서 게시판 → "친구들의 작품" 헤더 옆 접기 버튼(`목록 접기`) 클릭 → 좌측이 얇은 띠로 줄고 우측 미리보기가 넓어짐.
2. 띠의 펼치기 버튼/세로 라벨(`목록 펼치기`) 클릭 → 원래 2단 복원.
3. `preview_resize`로 폭을 `<lg`(예: 800px)로 줄임 → 접기 버튼·띠가 사라지고 항상 전체 패널(세로 스택). collapsed 상태여도 모바일에선 전체 패널.
4. 콘솔 에러 0. 트리·목록·미리보기·딥링크 회귀 없음.

## 자체 점검 (작성자용 — 스펙 대비)
- 데스크탑 전용 접기: Step 3(grid 분기) + Step 4(버튼 `hidden lg:*`, 띠 `hidden lg:flex`) ✓
- 얇은 띠(항상 보임·세로 라벨·펼치기): Step 4 `<aside>` ✓
- 세션 로컬 상태: Step 2 ✓
- 모바일 비노출(항상 전체 패널): 버튼 `hidden ... lg:grid`, 띠 `hidden`(base), 전체 패널 `collapsed ? lg:hidden`(=`<lg`에선 항상 보임) ✓
- 데이터·미리보기·규칙 불변: 단일 파일 BoardView, 렌더 클래스/마크업만 ✓
- 애니메이션/reduced-motion: 레이아웃 즉시 전환 + `anim-pop-in`(초기 마운트 페이드, 기존 reduced-motion 가드 적용). 토글 자체는 즉시(스펙 허용) ✓
