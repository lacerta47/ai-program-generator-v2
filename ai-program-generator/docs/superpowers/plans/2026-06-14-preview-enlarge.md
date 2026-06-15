# 미리보기 확대 Implementation Plan (게시판 보수 B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판·생성기 미리보기를 인라인으로 더 크게 보여주고, "크게 보기" 인앱 모달로 긴 프로그램을 세로 스크롤하며 전체를 파악하게 한다.

**Architecture:** 공용 `FullscreenFrame`의 OS 전체화면 토글을 공용 `Modal` 기반 인앱 "크게 보기"로 교체(같은 미리보기 URL 재사용 — WeakMap 캐시, 교차사이트 격리·sandbox 유지). `PostPreview`/`BoardView`는 인라인 높이만 키운다. 순수 UI — 데이터·API·격리 불변.

**Tech Stack:** Next.js 15 App Router, TS, Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + 브라우저. self-test 없음(순수 UI).

---

## File Structure

| 파일 | 책임 | 수정 |
|---|---|---|
| `components/ui/FullscreenFrame.tsx` | OS 전체화면 → Modal "크게 보기" | 수정(전체 교체) |
| `components/board/PostPreview.tsx` | 인라인 미리보기 높이 ↑ | 수정(1줄) |
| `components/board/BoardView.tsx` | 우측 섹션 높이 ↑ | 수정(1줄) |

(`components/creator/ResultPanel.tsx`도 `FullscreenFrame`을 쓰므로 자동으로 "크게 보기"가 적용됨 — 수정 불필요.)

---

## Task 1: FullscreenFrame — OS 전체화면을 인앱 "크게 보기" 모달로 교체

**Files:**
- Modify(전체 교체): `ai-program-generator/components/ui/FullscreenFrame.tsx`

- [ ] **Step 1: `FullscreenFrame.tsx` 전체 교체**

`ai-program-generator/components/ui/FullscreenFrame.tsx` 전체를 다음으로 (상단 `previewOrigin`/`previewIdCache`/`requestPreviewId`는 기존과 동일, 컴포넌트 본문만 OS fullscreen → Modal로 바뀜):
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Maximize, X } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import Modal from './Modal';
import LoadingDots from './LoadingDots';

interface Props {
  code: GeneratedCode;
  title: string;
  /** iframe 강제 리마운트용 key */
  frameKey?: string | number;
  className?: string;
}

// 미리보기를 "교차 사이트" URL로 로드해 별도 프로세스에서 실행한다.
// (srcDoc은 부모와 같은 프로세스라, 생성 코드의 무한 루프가 탭 전체를 얼렸음 — 실제 발생 버그)
// localhost ↔ 127.0.0.1 은 서로 다른 사이트라 Chrome 사이트 격리가 적용된다.
function previewOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  // 배포 환경: 별도 미리보기 도메인이 있어야 프로세스 격리가 유지된다.
  const configured = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  if (!configured) {
    console.warn(
      '[preview] NEXT_PUBLIC_PREVIEW_ORIGIN 미설정 — 미리보기가 같은 오리진에서 실행되어 프로세스 격리가 적용되지 않습니다.',
    );
    return '';
  }
  return configured;
}

// code 객체 동일성 기준 미리보기 id 캐시 — 탭 토글로 remount돼도 같은 결과면 재요청하지 않는다.
const previewIdCache = new WeakMap<GeneratedCode, Promise<string>>();

function requestPreviewId(code: GeneratedCode): Promise<string> {
  const cached = previewIdCache.get(code);
  if (cached) return cached;
  const p = fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code),
  }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json().then(({ id }) => id as string);
  });
  p.catch(() => previewIdCache.delete(code));
  previewIdCache.set(code, p);
  return p;
}

/** 생성된 프로그램 미리보기 iframe(프로세스 격리) + 인앱 "크게 보기" 모달 */
export default function FullscreenFrame({ code, title, frameKey, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    requestPreviewId(code)
      .then((id) => {
        if (alive) setSrc(`${previewOrigin()}/api/preview/${id}`);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code, frameKey]);

  return (
    <div className={`relative bg-white ${className}`}>
      {failed ? (
        <p className="grid h-full place-items-center p-6 text-center text-[15px] text-muted">
          미리보기를 불러오지 못했어요. 새로고침해 주세요.
        </p>
      ) : src ? (
        <iframe
          key={`${frameKey ?? ''}-${src}`}
          className="h-full w-full bg-white"
          src={src}
          title={title}
          sandbox="allow-scripts"
        />
      ) : (
        <div className="grid h-full place-items-center">
          <LoadingDots />
        </div>
      )}
      {src && (
        <button
          onClick={() => setExpanded(true)}
          aria-label="크게 보기"
          title="크게 보기"
          className="press absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-surface/90 text-ink backdrop-blur-sm hover:border-brand/60 hover:text-brand-strong dark:hover:text-brand"
        >
          <Maximize size={19} />
        </button>
      )}

      <Modal
        open={expanded}
        onClose={() => setExpanded(false)}
        label="크게 보기"
        className="flex h-[90vh] w-[min(96vw,1100px)] max-w-none flex-col p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="truncate text-[18px]">{title}</h2>
          <button
            onClick={() => setExpanded(false)}
            aria-label="닫기"
            className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>
        {src && (
          <iframe
            className="min-h-0 w-full flex-1 rounded-[var(--r-md)] border-2 border-line bg-white"
            src={src}
            title={title}
            sandbox="allow-scripts"
          />
        )}
      </Modal>
    </div>
  );
}
```
(변경 요지: `useRef`/`isFullscreen`/`fullscreenchange` 리스너/`requestFullscreen`/`exitFullscreen`/`Minimize` 제거 → `expanded` 상태 + `Maximize` "크게 보기" 버튼 + 공용 `Modal`로 큰 iframe. `src`가 같아 WeakMap 캐시가 API 재요청을 막고, 모달 iframe도 교차사이트 URL+`sandbox="allow-scripts"`로 격리 유지.)

- [ ] **Step 2: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음. (`useRef`·`Minimize` 미사용 import 없음 확인.)

- [ ] **Step 3: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/ui/FullscreenFrame.tsx
git commit -m "feat(preview): 미리보기 '크게 보기'를 인앱 모달로(OS 전체화면 대체)

같은 미리보기 URL 재사용(WeakMap 캐시), 교차사이트 격리·sandbox 유지.
게시판·생성기 공용 적용.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 인라인 미리보기 높이 확대

**Files:**
- Modify: `ai-program-generator/components/board/PostPreview.tsx`
- Modify: `ai-program-generator/components/board/BoardView.tsx`

- [ ] **Step 1: PostPreview 미리보기 높이 ↑**

`components/board/PostPreview.tsx`에서 `FullscreenFrame`의 className을 교체. FROM:
```tsx
        className="min-h-[52vh] w-full flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line"
```
TO:
```tsx
        className="min-h-[65vh] w-full flex-1 overflow-hidden rounded-[var(--r-md)] border-2 border-line"
```

- [ ] **Step 2: BoardView 우측 섹션 높이 ↑**

`components/board/BoardView.tsx`의 미리보기 섹션(`<section ...>`)에서 `min-h-[62vh]` → `min-h-[72vh]`. FROM:
```tsx
        className="anim-pop-in flex min-h-[62vh] flex-col rounded-[var(--r-lg)] border-2 border-line bg-surface p-5"
```
TO:
```tsx
        className="anim-pop-in flex min-h-[72vh] flex-col rounded-[var(--r-lg)] border-2 border-line bg-surface p-5"
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/board/PostPreview.tsx ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(preview): 게시판 인라인 미리보기 높이 확대(52→65vh)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 빌드 + 브라우저 검증 + 푸시

- [ ] **Step 1: 프로덕션 빌드** (dev 서버 떠 있으면 먼저 정지)

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공.

- [ ] **Step 2: 브라우저 검증** (dev 재기동)

- 게시판에서 작품 선택 → 미리보기 칸이 더 큼(긴 프로그램이 더 많이 보임).
- 미리보기 우상단 **"크게 보기"**(확대 아이콘) → 큰 모달이 뜨고, 세로로 긴 프로그램을 **스크롤로 전부** 확인. **Esc / 닫기(X) / 배경 클릭**으로 닫힘.
- 생성기(만들기)에서 프로그램 생성 후 미리보기에서도 "크게 보기" 동일 동작.
- 콘솔 에러 0. 미리보기 격리 유지(주소가 교차사이트 `/api/preview/…`, sandbox).

- [ ] **Step 3: 푸시 전 점검 + 푸시**

```bash
cd /c/Users/amh47/Documents/test
git log origin/main..HEAD --oneline
git diff origin/main --stat
```
`tsc` + `npm run build` clean이면:
```bash
git push origin main
```

---

## Self-Review

**1. Spec coverage:**
- 인라인 확대(PostPreview 높이↑, BoardView 섹션↑) → Task 2 ✓
- "크게 보기" 인앱 모달(FullscreenFrame OS fullscreen→Modal, 큰 iframe 스크롤, 같은 src 재사용) → Task 1 ✓
- 게시판·생성기 공용 적용(ResultPanel 자동) → Task 1(공용 컴포넌트) ✓
- 격리 유지(교차사이트·sandbox) → Task 1 코드 그대로 ✓
- 검증(tsc·빌드·브라우저·격리) → Task 3 ✓

**2. Placeholder scan:** TBD/TODO 없음. 코드 단계 완전(FullscreenFrame 전체 코드 포함).

**3. Type consistency:**
- `FullscreenFrame` props(`code/title/frameKey/className`) 불변 — 호출부(PostPreview/ResultPanel) 변경 불필요 ✓
- `Modal` props(`open/onClose/label/className/children`) — 기존 시그니처 일치 ✓
- 제거된 심볼(`useRef`/`Minimize`/`requestFullscreen`)이 코드에 남지 않음 ✓
- lucide `Maximize`/`X` import 추가, `Minimize` 제거 ✓
