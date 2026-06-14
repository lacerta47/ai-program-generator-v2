# 좋아요 · 조회수 · Fork 카운트 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 게시판 작품에 좋아요(♥, 인터랙티브)·조회수(본 사람 수)·이어 만든 횟수(fork)를 비정규화 카운트로 추가한다.

**Architecture:** 카운트는 게시물 문서의 필드(`likeCount`/`viewCount`/`forkCount`)로 비정규화(미래 정렬 대비). 누가 했는지는 `posts/{id}/likes|views/{uid}` 서브컬렉션. 좋아요는 낙관적 토글, 조회는 첫 조회 1회 멱등 기록. 규칙으로 카운트 ±1만 허용.

**Tech Stack:** Next.js 15, Firebase Firestore(client SDK, `increment`/`writeBatch`/`runTransaction`), lucide-react(`Heart`/`GitFork`/`Eye`).

**검증 방식:** 단위 테스트 프레임워크 없음(CLAUDE.md). 각 태스크 = `./node_modules/.bin/tsc --noEmit` + 커밋. 마지막에 프로덕션 빌드 + 규칙 배포 + 브라우저 수동(더미 "코딩친구" 글로 좋아요/조회). 이모지 금지 — lucide 아이콘만.

스펙: `docs/superpowers/specs/2026-06-12-likes-views-design.md`

---

## 파일 구조
- 수정 `lib/firebase/types.ts` — Post에 카운트 3필드
- 수정 `firestore.rules` — likes/views 서브컬렉션 + posts update 카운트 분기 (배포)
- 생성 `lib/firebase/likes.ts` — isLiked, toggleLike
- 생성 `lib/firebase/views.ts` — recordView
- 수정 `lib/firebase/posts.ts` — incrementForkCount
- 수정 `components/board/UploadDialog.tsx` — fork 저장 후 forkCount +1
- 수정 `components/board/PostList.tsx` — 목록 ♥ 개수
- 수정 `components/board/PostPreview.tsx` — 통계줄 + 하트 토글 + recordView
- 수정 `components/board/BoardView.tsx` — currentUserUid/onNeedLogin/onLikeChanged 연결

---

## Task 1: 데이터 모델 + 규칙

**Files:**
- Modify: `lib/firebase/types.ts`
- Modify: `firestore.rules`

- [ ] **Step 1: Post에 카운트 필드 추가**

`lib/firebase/types.ts`의 `Post`에서 `forkedFromAuthor?: string;` 다음 줄에 추가:

```ts
  /** 좋아요 수(비정규화). 구버전 글엔 없음 → 0으로 취급 */
  likeCount?: number;
  /** 본 사람 수(비정규화) */
  viewCount?: number;
  /** 이어 만든 횟수(비정규화) */
  forkCount?: number;
}
```

- [ ] **Step 2: posts update 규칙에 카운트 분기 추가**

`firestore.rules`의 `match /posts/{postId} { ... }`에서 `allow update:` 블록을 아래로 교체(기존 소유자 편집은 (a)로 보존 + 카운트 ±1 분기 OR):

```
      allow update: if (
          (isAdmin() || isOwner(resource.data.ownerUid))
          && request.resource.data.diff(resource.data).affectedKeys()
               .hasOnly(['title', 'authorName', 'plan', 'code', 'prompt', 'updatedAt'])
          && request.resource.data.title is string
          && request.resource.data.title.size() > 0 && request.resource.data.title.size() <= 100
          && request.resource.data.authorName is string
          && request.resource.data.authorName.size() > 0 && request.resource.data.authorName.size() <= 20
          && request.resource.data.prompt is string && request.resource.data.prompt.size() <= 50000
          && validCode(request.resource.data.code)
          && (!('plan' in request.resource.data) || validPlan(request.resource.data.plan))
        )
        || (
          isSignedIn()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['likeCount'])
          && request.resource.data.likeCount is number
          && ( request.resource.data.likeCount == resource.data.get('likeCount', 0) + 1
            || request.resource.data.likeCount == resource.data.get('likeCount', 0) - 1 )
        )
        || (
          isSignedIn()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewCount'])
          && request.resource.data.viewCount == resource.data.get('viewCount', 0) + 1
        )
        || (
          isSignedIn()
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['forkCount'])
          && request.resource.data.forkCount == resource.data.get('forkCount', 0) + 1
        );
```

- [ ] **Step 3: likes/views 서브컬렉션 규칙 추가**

같은 `match /posts/{postId} { ... }` 안, `allow delete:` 줄 다음(닫는 `}` 직전)에 중첩 match 추가:

```
      match /likes/{uid} {
        allow read: if true;
        allow create: if isSignedIn() && uid == request.auth.uid
          && request.resource.data.keys().hasOnly(['createdAt'])
          && request.resource.data.createdAt is number;
        allow update: if false;
        allow delete: if isOwner(uid) || isAdmin();
      }
      match /views/{uid} {
        allow read: if true;
        allow create: if isSignedIn() && uid == request.auth.uid
          && request.resource.data.keys().hasOnly(['createdAt'])
          && request.resource.data.createdAt is number;
        allow update: if false;
        allow delete: if isAdmin();
      }
```

- [ ] **Step 4: tsc + 규칙 배포**

```bash
cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit
firebase deploy --only firestore:rules
```
Expected: tsc 종료코드 0 / `rules file ... compiled successfully` + `Deploy complete!`

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/lib/firebase/types.ts ai-program-generator/firestore.rules
git commit -m "feat(likes): 카운트 필드 + likes/views 서브컬렉션 규칙"
```

---

## Task 2: 데이터 계층 (likes.ts · views.ts · incrementForkCount)

**Files:**
- Create: `lib/firebase/likes.ts`
- Create: `lib/firebase/views.ts`
- Modify: `lib/firebase/posts.ts`

- [ ] **Step 1: likes.ts 작성**

```ts
import { doc, getDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from './client';

const COL = 'posts';

/** 현재 사용자가 이 글을 좋아요 했는지 */
export async function isLiked(postId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COL, postId, 'likes', uid));
  return snap.exists();
}

/** 좋아요 토글 — liked(현재 상태)=true면 취소, false면 추가. likeCount ±1 동시 반영(배치). */
export async function toggleLike(postId: string, uid: string, liked: boolean): Promise<void> {
  const batch = writeBatch(db);
  const likeRef = doc(db, COL, postId, 'likes', uid);
  const postRef = doc(db, COL, postId);
  if (liked) {
    batch.delete(likeRef);
    batch.update(postRef, { likeCount: increment(-1) });
  } else {
    batch.set(likeRef, { createdAt: Date.now() });
    batch.update(postRef, { likeCount: increment(1) });
  }
  await batch.commit();
}
```

- [ ] **Step 2: views.ts 작성**

```ts
import { doc, increment, runTransaction } from 'firebase/firestore';
import { db } from './client';

const COL = 'posts';

/** 첫 조회면 view doc 생성 + viewCount +1, 이미 봤으면 no-op. 증가했으면 true. */
export async function recordView(postId: string, uid: string): Promise<boolean> {
  const viewRef = doc(db, COL, postId, 'views', uid);
  const postRef = doc(db, COL, postId);
  return runTransaction(db, async (tx) => {
    const viewSnap = await tx.get(viewRef);
    if (viewSnap.exists()) return false;
    tx.set(viewRef, { createdAt: Date.now() });
    tx.update(postRef, { viewCount: increment(1) });
    return true;
  });
}
```

- [ ] **Step 3: posts.ts에 incrementForkCount + increment import**

`lib/firebase/posts.ts` 상단 firestore import에 `increment` 추가(기존 import 목록에 끼움):

```ts
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  increment,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
```

그리고 `deletePost` 함수 다음에 추가:

```ts
/** 이어 만들기 저장 시 원본의 forkCount +1 */
export async function incrementForkCount(postId: string): Promise<void> {
  await updateDoc(doc(db, COL, postId), { forkCount: increment(1) });
}
```

- [ ] **Step 4: tsc**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/lib/firebase/likes.ts ai-program-generator/lib/firebase/views.ts ai-program-generator/lib/firebase/posts.ts
git commit -m "feat(likes): 데이터 계층 likes/views + incrementForkCount"
```

---

## Task 3: UploadDialog — fork 저장 후 forkCount +1

**Files:**
- Modify: `components/board/UploadDialog.tsx`

- [ ] **Step 1: import에 incrementForkCount 추가**

`import { createPost } from '@/lib/firebase/posts';` 를 교체:

```ts
import { createPost, incrementForkCount } from '@/lib/firebase/posts';
```

- [ ] **Step 2: createPost 성공 후 원본 forkCount 증가**

`submit` 안의 `const postId = await createPost({ ... });` 호출 다음 줄(현재 `setDone(...)` 직전)에 추가:

```ts
      if (forkedFrom) {
        incrementForkCount(forkedFrom).catch((e) => console.error('forkCount 증가 실패:', e));
      }
```

- [ ] **Step 3: tsc**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 4: 커밋**

```bash
git add ai-program-generator/components/board/UploadDialog.tsx
git commit -m "feat(likes): 이어 만들기 저장 시 원본 forkCount +1"
```

---

## Task 4: PostList — 목록 ♥ 개수

**Files:**
- Modify: `components/board/PostList.tsx`

- [ ] **Step 1: Heart import 추가**

PostList의 lucide import에 `Heart` 추가:

```tsx
import { Link2, Check, Download, Pencil, Trash2, FileQuestion, GitFork, Heart } from 'lucide-react';
```

- [ ] **Step 2: 메타줄에 ♥ 개수 추가**

작성자/날짜 메타 `<span>`을 교체(좋아요 0이면 생략):

```tsx
                <span className="flex min-w-0 items-center gap-1 text-[12.5px] text-muted">
                  {post.forkedFrom && (
                    <GitFork size={11} aria-hidden className="shrink-0 text-grape" />
                  )}
                  <span className="truncate">
                    {post.authorName || '익명'} · {formatDate(post.createdAt)}
                  </span>
                  {!!post.likeCount && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-coral-ink">
                      <Heart size={11} aria-hidden /> {post.likeCount}
                    </span>
                  )}
                </span>
```

- [ ] **Step 3: tsc**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 4: 커밋**

```bash
git add ai-program-generator/components/board/PostList.tsx
git commit -m "feat(likes): 목록 항목에 좋아요 개수 표시"
```

---

## Task 5: PostPreview 통계줄 + 하트 토글 + recordView, BoardView 연결

**Files:**
- Modify: `components/board/PostPreview.tsx`
- Modify: `components/board/BoardView.tsx`

- [ ] **Step 1: PostPreview import·props·상태 추가**

상단 import 교체(useEffect·아이콘·데이터계층 추가):

```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Download, MonitorPlay, Pencil, X, Link2, Check, GitFork, Heart, Eye } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { Post } from '@/lib/firebase/types';
import { formatDate } from '@/lib/program';
import { downloadProgram, sharePostUrl } from '@/lib/client/postActions';
import { isLiked, toggleLike } from '@/lib/firebase/likes';
import { recordView } from '@/lib/firebase/views';
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
  currentUserUid,
  onNeedLogin,
  onLikeChanged,
}: {
  post: Post | null;
  canEdit?: boolean;
  canFork?: boolean;
  onFork?: (post: Post) => void;
  currentUserUid?: string | null;
  onNeedLogin?: () => void;
  onLikeChanged?: (postId: string, delta: number) => void;
}) {
  const [planOpen, setPlanOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const { toast } = useToast();
  const router = useRouter();

  // 작품이 바뀌면 카운트 초기화 + (로그인 시) 내 좋아요 여부·조회 기록.
  // post 객체가 아니라 id에만 반응(좋아요 동기화로 객체가 바뀌어도 재초기화 안 함).
  useEffect(() => {
    if (!post) return;
    setLiked(false);
    setLikeCount(post.likeCount ?? 0);
    setViewCount(post.viewCount ?? 0);
    if (!currentUserUid) return;
    let alive = true;
    isLiked(post.id, currentUserUid).then((v) => {
      if (alive) setLiked(v);
    });
    recordView(post.id, currentUserUid).then((inc) => {
      if (alive && inc) setViewCount((c) => c + 1);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, currentUserUid]);

  function handleLike() {
    if (!post) return;
    if (!currentUserUid) {
      onNeedLogin?.();
      return;
    }
    const wasLiked = liked;
    const delta = wasLiked ? -1 : 1;
    setLiked(!wasLiked);
    setLikeCount((c) => c + delta);
    onLikeChanged?.(post.id, delta);
    toggleLike(post.id, currentUserUid, wasLiked).catch((e) => {
      console.error('좋아요 실패:', e);
      setLiked(wasLiked);
      setLikeCount((c) => c - delta);
      onLikeChanged?.(post.id, -delta);
      toast('좋아요를 처리하지 못했어요. 잠시 후 다시 해주세요.');
    });
  }
```

- [ ] **Step 2: 통계줄 JSX 추가**

헤더 `<div className="flex items-center justify-between gap-2"> ... </div>` 닫힌 직후, `<FullscreenFrame ... />` 바로 앞에 추가:

```tsx
      <div className="flex items-center gap-1 text-[14px]">
        <button
          onClick={handleLike}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
          title={liked ? '좋아요 취소' : '좋아요'}
          className="press inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 hover:bg-coral-soft"
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} className={liked ? 'text-coral' : 'text-muted'} aria-hidden />
          <span className="font-medium tabular-nums text-ink">{likeCount}</span>
        </button>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-muted" title="이어 만든 횟수">
          <GitFork size={16} aria-hidden /> <span className="tabular-nums">{post.forkCount ?? 0}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-muted" title="본 사람 수">
          <Eye size={16} aria-hidden /> <span className="tabular-nums">{viewCount}</span>
        </span>
      </div>
```

- [ ] **Step 3: BoardView에서 새 props 연결**

`components/board/BoardView.tsx`의 `handleDownload`/`handleTitleSaved` 근처에 좋아요 동기화 핸들러 추가:

```tsx
  function handleLikeChanged(postId: string, delta: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likeCount: (p.likeCount ?? 0) + delta } : p)),
    );
    setSelectedPost((prev) =>
      prev && prev.id === postId ? { ...prev, likeCount: (prev.likeCount ?? 0) + delta } : prev,
    );
  }
```

`<PostPreview ... />` 호출에 세 prop 추가:

```tsx
          <PostPreview
            post={selectedPost}
            canEdit={!!selectedPost && (isAdmin || selectedPost.ownerUid === user?.uid)}
            canFork={!!selectedPost && selectedPost.ownerUid !== user?.uid}
            onFork={handleFork}
            currentUserUid={user?.uid ?? null}
            onNeedLogin={() => setLoginOpen(true)}
            onLikeChanged={handleLikeChanged}
          />
```

- [ ] **Step 4: tsc**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 종료코드 0

- [ ] **Step 5: 커밋**

```bash
git add ai-program-generator/components/board/PostPreview.tsx ai-program-generator/components/board/BoardView.tsx
git commit -m "feat(likes): 미리보기 통계줄(♥/fork/조회) + 하트 토글 + 조회 기록"
```

---

## Task 6: 통합 검증 (빌드 + 규칙 + 브라우저)

**Files:** (없음 — 검증)

- [ ] **Step 1: dev 중지 후 프로덕션 빌드**

```bash
# 3000 포트 dev 종료(PowerShell taskkill) 후
cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build
```
Expected: `✓ Compiled successfully`, `✓ Generating static pages (7/7)`, 에러 없음

- [ ] **Step 2: 브라우저 수동 확인 (로그인 상태)**

더미 "코딩친구" 글(남의 글)로:
1. 작품 선택 → 통계줄에 ♥/fork/조회 보임. **조회수 +1**(다시 열면 그대로)
2. **하트 클릭 → 채워지고 ♥ +1**, 목록 항목 개수도 동기화. 다시 클릭 → -1
3. 비로그인 상태에서 하트 → 로그인창
4. 내 글에서도 하트 눌러짐(자기 글 좋아요 허용)
5. 남의 글 이어 만들기→올리기 후, 원본 다시 열면 **fork 카운트 +1**
6. 구버전(카운트 없는) 글도 0으로 정상 표시

- [ ] **Step 3: 최종 상태**

```bash
git -C /c/Users/amh47/Documents/test status -sb
```
Expected: 작업트리 clean(시드 스크립트·code_review.txt 제외), 모든 태스크 커밋

---

## 의존성 메모
- Task 1 규칙 배포 전에는 좋아요/조회 쓰기가 거부되므로 Task 1 Step 4(배포)는 선행 필수.
- Task 5는 Task 2(데이터 계층)에 의존.
- 정렬 UI·복합 인덱스·목록 인터랙션은 범위 밖(미래 리뉴얼).
