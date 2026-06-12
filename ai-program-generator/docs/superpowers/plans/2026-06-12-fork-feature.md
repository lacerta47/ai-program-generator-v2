# Fork(이어서 만들기) 기능 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판의 남의 작품을 "이어서 만들기"로 생성기에 불러와 내 새 작품으로 올리고, 출처를 표기한다.

**Architecture:** 새 페이지·새 데이터흐름을 만들지 않고 기존 `?edit=` 로딩 + 업로드 흐름을 재활용한다. `?fork=postId`는 원본을 불러오되 `editing`을 설정하지 않아 저장 시 새 글이 된다. 출처는 `forkedFrom`(원본 id) + `forkedFromAuthor`(작성자명 스냅샷)로 비정규화 저장.

**Tech Stack:** Next.js 15 App Router, TypeScript, Firebase Firestore(client SDK), lucide-react 아이콘.

**검증 방식(중요):** 이 프로젝트는 단위 테스트 프레임워크가 없다(CLAUDE.md). 따라서 각 태스크의 검증은 **`./node_modules/.bin/tsc --noEmit`**(dev 서버 띄운 채 안전) + **마지막에 프로덕션 빌드** + **브라우저 수동 확인**이다. TDD의 "실패 테스트" 단계는 tsc/수동확인으로 대체한다. 커밋은 태스크 단위로 한다.

스펙: `docs/superpowers/specs/2026-06-12-fork-feature-design.md`

---

## 파일 구조 (생성/수정)
- 수정 `lib/firebase/types.ts` — `Post`에 `forkedFrom?`, `forkedFromAuthor?` 추가
- 수정 `firestore.rules` — `validPost` 화이트리스트+검증 (배포 필요)
- 수정 `components/board/UploadDialog.tsx` — fork props + 조건부 저장 + 카테고리 기본값
- 수정 `components/creator/Creator.tsx` — `?fork=` 로딩 + forkSource + 업로드 연동 + reset
- 수정 `components/board/PostPreview.tsx` — 액션 아이콘화 + 공유/이어서만들기 버튼 + 저장 try/catch + 출처 칩
- 수정 `components/board/BoardView.tsx` — canFork 계산 + onFork(로그인 게이트) + LoginDialog
- 수정 `components/board/PostList.tsx` — 목록 항목 출처 칩

테스트 프레임워크 없음 — 테스트 파일 없음.

---

## Task 1: 데이터 모델 + Firestore 규칙

**Files:**
- Modify: `lib/firebase/types.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Post 타입에 fork 필드 추가**

`lib/firebase/types.ts`의 `Post` 인터페이스에서 `updatedAt?: number;` 다음 줄에 추가:

```ts
  createdAt: number;
  updatedAt?: number;
  /** 이어서 만들기(fork) 출처 — 원본 게시물 id (비-fork 글엔 없음) */
  forkedFrom?: string;
  /** 이어서 만들기 출처 작성자명 스냅샷 (원본이 지워져도 표시 유지) */
  forkedFromAuthor?: string;
}
```

- [ ] **Step 2: firestore.rules의 validPost 갱신**

`firestore.rules`의 `validPost(d)` 함수를 아래로 교체(`hasOnly`에 두 키 추가 + 마지막 두 줄 검증 추가):

```
    function validPost(d) {
      return d.keys().hasOnly(['title', 'categoryId', 'ownerUid', 'authorName', 'code', 'plan', 'prompt', 'createdAt', 'updatedAt', 'forkedFrom', 'forkedFromAuthor'])
        && d.title is string && d.title.size() > 0 && d.title.size() <= 100
        && d.categoryId is string && d.categoryId.size() > 0 && d.categoryId.size() <= 128
        && d.ownerUid is string
        && d.authorName is string && d.authorName.size() > 0 && d.authorName.size() <= 20
        && d.prompt is string && d.prompt.size() <= 50000
        && d.createdAt is number
        && validCode(d.code)
        && (!('plan' in d) || validPlan(d.plan))
        && (!('forkedFrom' in d) || (d.forkedFrom is string && d.forkedFrom.size() <= 128))
        && (!('forkedFromAuthor' in d) || (d.forkedFromAuthor is string && d.forkedFromAuthor.size() <= 20));
    }
```

(수정 규칙 `update`는 `affectedKeys().hasOnly([...])`로 변경 필드만 검사하므로, 편집 시 바뀌지 않는 `forkedFrom*`은 자동 보존 — 변경 불필요.)

- [ ] **Step 3: tsc 통과 확인**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0 (출력 없음)

- [ ] **Step 4: 규칙 배포**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && firebase deploy --only firestore:rules`
Expected: `✔ Deploy complete!` (프로젝트 test-ai-builder)

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/lib/firebase/types.ts ai-program-generator/firestore.rules
git commit -m "feat(fork): Post에 forkedFrom 필드 + 규칙 검증"
```

---

## Task 2: UploadDialog — fork props + 조건부 저장 + 카테고리 기본값

**Files:**
- Modify: `components/board/UploadDialog.tsx`

- [ ] **Step 1: Props 인터페이스 확장**

`interface Props { ... }`에 세 줄 추가:

```ts
interface Props {
  open: boolean;
  onClose: () => void;
  code: GeneratedCode;
  plan: PlanFields;
  prompt: string;
  defaultTitle: string;
  forkedFrom?: string;
  forkedFromAuthor?: string;
  defaultCategoryId?: string;
}
```

그리고 구조분해에 추가:

```ts
export default function UploadDialog({ open, onClose, code, plan, prompt, defaultTitle, forkedFrom, forkedFromAuthor, defaultCategoryId }: Props) {
```

- [ ] **Step 2: 카테고리 기본값을 원본 카테고리로**

기존 effect를 교체:

```ts
  useEffect(() => {
    if (!categories.length || categoryId) return;
    const preferred =
      defaultCategoryId && categories.some((c) => c.id === defaultCategoryId)
        ? defaultCategoryId
        : categories[0].id;
    setCategoryId(preferred);
  }, [categories, categoryId, defaultCategoryId]);
```

- [ ] **Step 3: createPost에 forkedFrom 조건부 포함**

`submit` 안의 `const postId = await createPost({ ... })` 호출을 교체:

```ts
      const postId = await createPost({
        title: title.trim(),
        categoryId,
        ownerUid: user.uid,
        authorName: name,
        code,
        plan,
        prompt,
        createdAt: Date.now(),
        ...(forkedFrom ? { forkedFrom, forkedFromAuthor: forkedFromAuthor ?? '익명' } : {}),
      });
```

(스프레드로 fork가 아닐 땐 필드 자체를 넣지 않아 Firestore의 `undefined` 거부를 피한다.)

- [ ] **Step 4: tsc 통과 확인**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/components/board/UploadDialog.tsx
git commit -m "feat(fork): UploadDialog에 forkedFrom props + 원본 카테고리 기본값"
```

---

## Task 3: Creator — ?fork= 로딩 + 업로드 연동 + reset

**Files:**
- Modify: `components/creator/Creator.tsx`

- [ ] **Step 1: forkSource 상태 + ref 추가**

`const loadedEditId = useRef<string | null>(null);` 다음 줄에 추가:

```ts
  const loadedForkId = useRef<string | null>(null);
```

`const [editing, setEditing] = useState<...>(null);` 다음 줄에 추가:

```ts
  const [forkSource, setForkSource] = useState<{ id: string; author: string; categoryId: string } | null>(null);
```

- [ ] **Step 2: fork 로딩 effect 추가**

기존 `?edit=` 로딩 effect(`}, [params, authLoading, user, isAdmin, toast, router]);`로 끝나는 블록) 바로 다음에 새 effect 추가. 로그인 없이도 불러오기는 허용(토큰 0)하므로 authLoading 게이트는 두지 않는다:

```ts
  // ?fork=postId 로 들어오면 원본을 불러와 "새 작품"으로 시작 (편집모드 아님).
  // 저장 시 forkedFrom으로 출처를 남긴다. 불러오기 자체는 AI를 안 써서 비로그인도 허용.
  useEffect(() => {
    const forkId = params.get('fork');
    if (!forkId) return;
    if (loadedForkId.current === forkId) return;
    loadedForkId.current = forkId;
    getPost(forkId).then((p) => {
      if (!p) {
        toast('이어 만들 작품을 찾지 못했어요.');
        router.replace('/');
        return;
      }
      const srcPlan = p.plan ?? EMPTY_PLAN;
      setPlan(srcPlan);
      setCode(p.code);
      setGenPrompt(p.plan ? buildGeneratePrompt(srcPlan) : p.prompt ?? '');
      setResultTab('preview');
      setPreviewKey((k) => k + 1);
      setForkSource({ id: p.id, author: p.authorName || '익명', categoryId: p.categoryId });
    });
  }, [params, toast, router]);
```

- [ ] **Step 3: handleReset에서 forkSource 정리**

`handleReset`의 `if (editing) { ... }` 블록 다음에 추가(편집/포크 둘 다 처리):

```ts
    if (forkSource) {
      setForkSource(null);
      loadedForkId.current = null;
      router.replace('/');
    }
```

- [ ] **Step 4: UploadDialog에 fork 정보 전달**

`<UploadDialog ... />` 호출에 세 prop 추가:

```tsx
      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        code={code}
        plan={plan}
        prompt={genPrompt}
        defaultTitle={plan.name}
        forkedFrom={forkSource?.id}
        forkedFromAuthor={forkSource?.author}
        defaultCategoryId={forkSource?.categoryId}
      />
```

- [ ] **Step 5: tsc 통과 확인**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 6: 커밋**

```bash
git add ai-program-generator/components/creator/Creator.tsx
git commit -m "feat(fork): Creator가 ?fork= 로 원본 불러와 새 작품으로 시작"
```

---

## Task 4: PostPreview 액션 아이콘화 + 공유/이어서만들기 + 저장 try/catch

**Files:**
- Modify: `components/board/PostPreview.tsx`
- Modify: `components/board/BoardView.tsx`

- [ ] **Step 1: PostPreview import·props·핸들러 추가**

상단 import 교체(아이콘 추가 + useToast):

```tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, MonitorPlay, Pencil, X, Link2, Check, GitFork } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { Post } from '@/lib/firebase/types';
import { formatDate } from '@/lib/program';
import { downloadProgramZip } from '@/lib/client/downloadZip';
import Button from '@/components/ui/Button';
import FloatingShapes from '@/components/ui/FloatingShapes';
import FullscreenFrame from '@/components/ui/FullscreenFrame';
import EmptyParticles from '@/components/fx/EmptyParticles';
import { useToast } from '@/components/ui/Toast';
```

함수 시그니처·상태 교체:

```tsx
export default function PostPreview({
  post,
  canEdit,
  canFork,
  onFork,
}: {
  post: Post | null;
  canEdit?: boolean;
  canFork?: boolean;
  onFork?: (post: Post) => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
```

`if (!post) { ... }` 직전(early-return 위)에 핸들러 두 개 추가:

```tsx
  function handleShare() {
    if (!post) return;
    const url = `${window.location.origin}/board?category=${post.categoryId}&post=${post.id}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast('작품 주소를 복사했어요! 친구들에게 자랑해 봐요', 'success');
      },
      () => toast('링크 복사에 실패했어요.'),
    );
  }

  async function handleDownload() {
    if (!post) return;
    try {
      await downloadProgramZip(post.code, post.title);
    } catch (e) {
      console.error('ZIP 저장 실패:', e);
      toast('저장에 실패했어요. 잠시 후 다시 해주세요.');
    }
  }
```

- [ ] **Step 2: 액션 줄을 아이콘 버튼으로 교체**

`<div className="flex shrink-0 flex-wrap justify-end gap-2"> ... </div>` 블록 전체를 교체:

```tsx
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {post.prompt && (
            <Button variant="ghost" size="icon" onClick={() => setPlanOpen(true)} aria-label="계획서 보기" title="계획서 보기" className="rounded-full">
              <FileText size={18} aria-hidden />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleShare} aria-label="링크 복사" title="링크 복사" className="rounded-full">
            {copied ? <Check size={18} className="text-mint-ink" aria-hidden /> : <Link2 size={18} aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDownload} aria-label="ZIP 저장" title="ZIP 저장" className="rounded-full">
            <Download size={18} aria-hidden />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => router.push(`/?edit=${post.id}`)} aria-label="고치기" title="고치기" className="rounded-full">
              <Pencil size={18} aria-hidden />
            </Button>
          )}
          {canFork && (
            <Button variant="soft" size="icon" onClick={() => onFork?.(post)} aria-label="이어서 만들기" title="이어서 만들기" className="rounded-full">
              <GitFork size={18} aria-hidden />
            </Button>
          )}
        </div>
```

- [ ] **Step 3: BoardView에서 canFork·onFork·LoginDialog 연결**

`components/board/BoardView.tsx` 상단 import에 LoginDialog 추가:

```tsx
import LoginDialog from '@/components/auth/LoginDialog';
```

상태 추가(예: `const [loadError, setLoadError] = useState(false);` 다음 줄):

```tsx
  const [loginOpen, setLoginOpen] = useState(false);
```

핸들러 추가(`handleDownload` 함수 근처):

```tsx
  function handleFork(post: Post) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    router.push(`/?fork=${post.id}`);
  }
```

`<PostPreview ... />` 호출 교체:

```tsx
          <PostPreview
            post={selectedPost}
            canEdit={!!selectedPost && (isAdmin || selectedPost.ownerUid === user?.uid)}
            canFork={!!selectedPost && selectedPost.ownerUid !== user?.uid}
            onFork={handleFork}
          />
```

그리고 컴포넌트 최상위 반환 `<div ...>` 닫기 직전(마지막 `</section>` 다음, 바깥 `</div>` 전)에 LoginDialog 추가:

```tsx
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
```

- [ ] **Step 4: tsc 통과 확인**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/components/board/PostPreview.tsx ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(fork): 미리보기 액션 아이콘화 + 이어서만들기 버튼(로그인 게이트)"
```

---

## Task 5: 출처 칩 (PostPreview + PostList)

**Files:**
- Modify: `components/board/PostPreview.tsx`
- Modify: `components/board/PostList.tsx`

- [ ] **Step 1: PostPreview 제목 아래 출처 칩**

PostPreview의 작성자/날짜 `<p>...</p>` 다음에 추가(`<div className="min-w-0">` 안):

```tsx
          {post.forkedFrom && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-grape-soft px-2 py-0.5 text-[12px] text-grape-ink"
              title={`${post.forkedFromAuthor || '누군가'}의 작품에서 이어 만들었어요`}
            >
              <GitFork size={12} aria-hidden /> 이어 만든 작품
            </span>
          )}
```

(`GitFork`는 Task 4 Step 1에서 이미 import됨.)

- [ ] **Step 2: PostList 항목에 출처 표시**

`components/board/PostList.tsx`의 import에 `GitFork` 추가:

```tsx
import { Link2, Check, Download, Pencil, Trash2, FileQuestion, GitFork } from 'lucide-react';
```

작성자/날짜 줄을 교체(`<span className="block truncate text-[12.5px] text-muted"> ... </span>`):

```tsx
                <span className="flex min-w-0 items-center gap-1 text-[12.5px] text-muted">
                  {post.forkedFrom && (
                    <GitFork size={11} aria-hidden className="shrink-0 text-grape" />
                  )}
                  <span className="truncate">
                    {post.authorName || '익명'} · {formatDate(post.createdAt)}
                  </span>
                </span>
```

- [ ] **Step 3: tsc 통과 확인**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 4: 커밋**

```bash
git add ai-program-generator/components/board/PostPreview.tsx ai-program-generator/components/board/PostList.tsx
git commit -m "feat(fork): 이어 만든 작품 출처 칩(미리보기·목록)"
```

---

## Task 6: 통합 검증 (빌드 + 브라우저 수동 확인)

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: dev 서버 중지 후 프로덕션 빌드**

```bash
# 3000 포트 dev 서버를 먼저 종료(PowerShell): 포트 점유 프로세스 taskkill
cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build
```
Expected: `✓ Compiled successfully`, `✓ Generating static pages (7/7)`, 타입/린트 에러 없음

- [ ] **Step 2: 브라우저 수동 확인 (프로덕션 또는 dev 서버, 로그인 상태)**

확인 항목:
1. 남의 글 미리보기 → 이어서만들기(갈래) 아이콘 보임 / 본인 글 → 고치기 아이콘 보임 (마우스 올리면 툴팁)
2. 비로그인 상태에서 이어서만들기 클릭 → 로그인창. 로그인 후 클릭 → 생성기로 이동하며 계획서+코드 채워짐
3. fork를 게시판에 올림 → 내 소유의 새 글 생성(원본 불변), 새 글에 "이어 만든 작품" 칩 + 목록 갈래 아이콘 표시
4. 칩에 마우스 올리면 "○○의 작품에서 이어 만들었어요"
5. 업로드 다이얼로그의 카테고리 기본값이 원본 카테고리
6. 이어 만든 글을 다시 "고치기"로 편집·저장해도 칩 유지(forkedFrom 보존)

- [ ] **Step 3: 최종 상태 확인**

```bash
git -C /c/Users/amh47/Documents/test status -sb
```
Expected: 작업트리 clean, 모든 태스크 커밋됨

---

## 의존성 메모
- Task 4의 fork 버튼은 `/?fork=id`로 이동 → Task 3가 있어야 실제로 동작. (Task 1·2·3·4를 순서대로 끝내면 fork 저장까지 완성.)
- Task 1의 규칙 배포 전에는 `forkedFrom` 포함 글 저장이 거부되므로, 규칙 배포(Task 1 Step 4)는 반드시 선행.
