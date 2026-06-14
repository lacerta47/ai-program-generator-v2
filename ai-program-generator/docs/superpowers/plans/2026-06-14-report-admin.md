# 신고 기능 + 관리자 처리 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 부적절한 작품을 신고하고, 관리자가 `/admin`에서 신고를 검토해 작품 삭제 또는 신고 무시로 처리한다.

**Architecture:** flat `reports/{postId}_{reporterUid}` 컬렉션(1인 1회, 비정규화 카운트 없음, 처리 = doc 삭제). 신고 제출은 `PostPreview`의 Flag 버튼 → `ReportDialog`. 관리자 화면은 별도 `/admin` 라우트(코드 스플릿, `isAdmin` 가드 + 규칙이 진짜 방어선), 작품별 그룹 카드 + 삭제/무시 액션. 진입점은 기존 AuthButton "관리자" 칩을 `/admin` 링크로 전환하고 미처리 신고 수를 세션 1회 표시.

**Tech Stack:** Next.js 15 App Router, TypeScript, Firebase(client SDK Firestore) + Admin SDK(테스트), Tailwind v4, lucide-react. 테스트 프레임워크 없음 → 검증 = `tsc --noEmit` + `npm run build` + 규칙 배포 + custom-token 통합 self-test + 브라우저 확인.

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `lib/firebase/reports.ts` | reports 데이터 계층 + `Report` 타입(submit/fetch/dismiss/count) | 신규 |
| `firestore.rules` | reports 컬렉션 규칙(읽기·삭제 admin, 생성 본인만) | 수정 + 배포 |
| `components/board/ReportDialog.tsx` | 신고 다이얼로그(사유 칩 + 메모 + 제출) | 신규 |
| `components/board/PostPreview.tsx` | 남의 글 액션줄에 Flag 버튼 + 다이얼로그 마운트 | 수정 |
| `components/auth/AuthButton.tsx` | "관리자" 칩 → `/admin` 링크 + 신고 count(세션 1회) | 수정 |
| `app/admin/page.tsx` | 관리자 처리 화면(가드 + 그룹 카드 + 삭제/무시) | 신규 |
| `scripts/selftest-reports.mjs` | custom-token 통합 self-test(일회성) | 신규(미커밋) |

**계약(다른 태스크가 의존하는 시그니처):**
- `Report` = `{ id, postId, postTitle, postAuthorName, postOwnerUid, reporterUid, reason, memo?, createdAt }`
- `submitReport(post: Post, reporterUid: string, reason: string, memo?: string): Promise<void>`
- `fetchReports(): Promise<Report[]>`
- `dismissReportsForPost(postId: string): Promise<void>`
- `countReports(): Promise<number>`

---

## Task 1: 데이터 계층 + Firestore 규칙

**Files:**
- Create: `ai-program-generator/lib/firebase/reports.ts`
- Modify: `ai-program-generator/firestore.rules` (nicknames match 다음, `match /databases/{database}/documents` 닫기 전)

- [ ] **Step 1: `reports.ts` 작성**

`ai-program-generator/lib/firebase/reports.ts`:
```typescript
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './client';
import type { Post } from './types';

const COL = 'reports';

export interface Report {
  id: string;
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  reporterUid: string;
  reason: string;
  memo?: string;
  createdAt: number;
}

/** 신고 제출. doc id = `${postId}_${reporterUid}` 라 사용자당 작품 1회(재신고는 덮어쓰기). */
export async function submitReport(
  post: Post,
  reporterUid: string,
  reason: string,
  memo?: string,
): Promise<void> {
  const ref = doc(db, COL, `${post.id}_${reporterUid}`);
  const trimmed = memo?.trim();
  await setDoc(ref, {
    postId: post.id,
    postTitle: post.title,
    postAuthorName: post.authorName || '익명',
    postOwnerUid: post.ownerUid,
    reporterUid,
    reason,
    ...(trimmed ? { memo: trimmed } : {}),
    createdAt: Date.now(),
  });
}

/** 전체 신고 조회(관리자 전용 — 규칙이 비관리자 읽기를 거부). */
export async function fetchReports(): Promise<Report[]> {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report);
}

/** 특정 작품의 신고 일괄 삭제(관리자 처리). */
export async function dismissReportsForPost(postId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, COL), where('postId', '==', postId)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/** 미처리 신고 수(관리자 칩 배지용). */
export async function countReports(): Promise<number> {
  const snap = await getCountFromServer(collection(db, COL));
  return snap.data().count;
}
```

- [ ] **Step 2: 규칙에 reports match 추가**

`firestore.rules`에서 `match /nicknames/{key} { ... }` 블록 **바로 다음**, `match /databases/{database}/documents`의 닫는 `}` **앞**에 추가:
```
    match /reports/{reportId} {
      allow read: if isAdmin();
      allow create, update: if isSignedIn()
        && request.resource.data.reporterUid == request.auth.uid
        && request.resource.data.keys().hasOnly(['postId','postTitle','postAuthorName','postOwnerUid','reporterUid','reason','memo','createdAt'])
        && request.resource.data.postId is string
        && request.resource.data.reason is string && request.resource.data.reason.size() <= 20
        && (!('memo' in request.resource.data) || (request.resource.data.memo is string && request.resource.data.memo.size() <= 500))
        && request.resource.data.createdAt is number;
      allow delete: if isAdmin();
    }
```

- [ ] **Step 3: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없이 종료(reports.ts가 깨끗이 컴파일).

- [ ] **Step 4: 규칙 배포**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && firebase deploy --only firestore:rules`
Expected: `✔  Deploy complete!` (프로젝트 test-ai-builder). 규칙 컴파일 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/lib/firebase/reports.ts ai-program-generator/firestore.rules
git commit -m "feat(report): reports 데이터 계층 + Firestore 규칙

submitReport/fetchReports/dismissReportsForPost/countReports.
규칙: 읽기·삭제 admin만, 생성은 본인 uid + 필드 화이트리스트.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: ReportDialog + PostPreview 신고 버튼

**Files:**
- Create: `ai-program-generator/components/board/ReportDialog.tsx`
- Modify: `ai-program-generator/components/board/PostPreview.tsx` (import 줄 5, 액션줄 ~138, 컴포넌트 하단 Modal 근처)

- [ ] **Step 1: `ReportDialog.tsx` 작성**

`ai-program-generator/components/board/ReportDialog.tsx`:
```tsx
'use client';

import { useState } from 'react';
import type { Post } from '@/lib/firebase/types';
import { submitReport } from '@/lib/firebase/reports';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const REASONS = ['나쁜 말', '이상해요', '불쾌해요', '기타'] as const;

export default function ReportDialog({
  open,
  onClose,
  post,
  reporterUid,
}: {
  open: boolean;
  onClose: () => void;
  post: Post;
  reporterUid: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await submitReport(post, reporterUid, reason, memo);
      toast('신고했어요. 선생님이 확인할게요.', 'success');
      setMemo('');
      onClose();
    } catch (e) {
      console.error('신고 실패:', e);
      toast('신고하지 못했어요. 잠시 후 다시 해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="작품 신고" className="max-w-xs p-6">
      <h2 className="mb-3 text-[20px]">무엇이 문제인가요?</h2>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`press rounded-full border-2 px-3 py-1.5 text-[14px] ${
              reason === r
                ? 'border-coral bg-coral-soft text-coral-ink'
                : 'border-line text-muted hover:border-coral/50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <TextArea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="자세히 알려주세요 (선택)"
        maxLength={500}
        rows={3}
        className="mb-3"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={submit} disabled={busy}>
          {busy ? '보내는 중…' : '신고 보내기'}
        </Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: PostPreview import에 Flag + ReportDialog 추가**

`components/board/PostPreview.tsx:5` 의 lucide import에 `Flag` 추가:
```tsx
import { FileText, Download, MonitorPlay, Pencil, X, Link2, Check, GitFork, Heart, Eye, Flag } from 'lucide-react';
```
그리고 import 블록(줄 16 아래)에 추가:
```tsx
import ReportDialog from './ReportDialog';
```

- [ ] **Step 3: 신고 다이얼로그 state 추가**

`components/board/PostPreview.tsx` 의 `const [planOpen, setPlanOpen] = useState(false);`(줄 37) 다음 줄에 추가:
```tsx
  const [reportOpen, setReportOpen] = useState(false);
```

- [ ] **Step 4: 액션줄에 신고 버튼 추가**

`components/board/PostPreview.tsx` 의 액션 버튼 컨테이너(줄 138 `<div className="flex shrink-0 flex-wrap justify-end gap-1.5">`) 안, 계획서 버튼(`{post.prompt && (...)}` 블록, 줄 139~143) **바로 앞**에 추가:
```tsx
          {currentUserUid !== post.ownerUid && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (currentUserUid ? setReportOpen(true) : onNeedLogin?.())}
              aria-label="신고"
              title="신고"
              className="rounded-full"
            >
              <Flag size={18} aria-hidden />
            </Button>
          )}
```
(`currentUserUid`가 없으면(비로그인) 조건이 참 → 버튼 노출 → 클릭 시 `onNeedLogin`. 자기 글이면 숨김.)

- [ ] **Step 5: ReportDialog 마운트**

`components/board/PostPreview.tsx` 하단, 계획서 `<Modal>`(planOpen) 닫힘 태그 다음에 추가(로그인 사용자일 때만 마운트해 `reporterUid` non-null 보장):
```tsx
      {currentUserUid && (
        <ReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          post={post}
          reporterUid={currentUserUid}
        />
      )}
```
주의: 이 블록은 `post`가 non-null인 렌더 분기 안에 둘 것(파일 상단에 `if (!post) return ...` 빈상태 분기가 있으므로 본문 return은 post 보장됨).

- [ ] **Step 6: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 7: 브라우저 확인**

dev 서버(localhost:3000) → 게시판에서 **남의 글** 선택 → 액션줄에 깃발(신고) 아이콘 보임. 비로그인 클릭 → 로그인 다이얼로그. 로그인 후 클릭 → 사유 칩 4개(나쁜 말/이상해요/불쾌해요/기타) + 메모 + "신고 보내기" 다이얼로그. **자기 글**엔 신고 버튼 없음.

- [ ] **Step 8: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/board/ReportDialog.tsx ai-program-generator/components/board/PostPreview.tsx
git commit -m "feat(report): 신고 다이얼로그 + PostPreview 신고 버튼

남의 글 액션줄에 Flag 버튼(비로그인→로그인 유도). 사유 4종+메모.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: AuthButton 관리자 칩 → /admin 진입점

**Files:**
- Modify: `ai-program-generator/components/auth/AuthButton.tsx` (import, state, effect, 관리자 칩 60~64)

- [ ] **Step 1: import 추가**

`components/auth/AuthButton.tsx` 상단 import에 추가:
```tsx
import Link from 'next/link';
import { countReports } from '@/lib/firebase/reports';
```

- [ ] **Step 2: 신고 count state + 세션 1회 조회 effect**

`const [busy, setBusy] = useState(false);`(줄 22) 다음에 추가:
```tsx
  const [reportCount, setReportCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    countReports()
      .then(setReportCount)
      .catch((e) => console.error('신고 수 조회 실패:', e));
  }, [isAdmin]);
```

- [ ] **Step 3: 관리자 칩을 클릭 가능한 링크로 교체**

`components/auth/AuthButton.tsx` 의 기존 관리자 칩(줄 60~64):
```tsx
        {isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sunshine-soft px-3 py-1.5 text-[13px] font-medium text-sunshine-ink">
            <Crown size={14} aria-hidden /> 관리자
          </span>
        )}
```
를 다음으로 교체:
```tsx
        {isAdmin && (
          <Link
            href="/admin"
            className="press inline-flex items-center gap-1 rounded-full bg-sunshine-soft px-3 py-1.5 text-[13px] font-medium text-sunshine-ink hover:brightness-95"
          >
            <Crown size={14} aria-hidden /> 관리자{reportCount > 0 ? ` · 신고 ${reportCount}` : ''}
          </Link>
        )}
```

- [ ] **Step 4: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: 브라우저 확인**

관리자 계정 로그인 → 우측 상단 "관리자" 칩이 링크가 되어 클릭 시 `/admin`으로 이동. 미처리 신고가 있으면 "관리자 · 신고 N" 표시. 일반 사용자엔 칩 없음(닉네임 버튼 그대로).

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/components/auth/AuthButton.tsx
git commit -m "feat(report): 관리자 칩을 /admin 링크로 + 신고 count 표시

기존 '관리자' 라벨을 클릭 진입점으로. countReports 세션 1회 조회.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 관리자 처리 화면 `/admin`

**Files:**
- Create: `ai-program-generator/app/admin/page.tsx`

- [ ] **Step 1: `/admin` 페이지 작성**

`ai-program-generator/app/admin/page.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Check, ExternalLink } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { fetchReports, dismissReportsForPost, type Report } from '@/lib/firebase/reports';
import { deletePost } from '@/lib/firebase/posts';
import { formatDate } from '@/lib/program';
import Header from '@/components/common/Header';
import Button from '@/components/ui/Button';
import LoadingDots from '@/components/ui/LoadingDots';

interface ReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  items: Report[];
}

function groupReports(reports: Report[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const r of reports) {
    const g = map.get(r.postId);
    if (g) {
      g.items.push(r);
    } else {
      map.set(r.postId, {
        postId: r.postId,
        postTitle: r.postTitle,
        postAuthorName: r.postAuthorName,
        items: [r],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export default function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      toast('관리자만 들어갈 수 있어요.');
      router.replace('/');
      return;
    }
    fetchReports()
      .then(setReports)
      .catch((e) => {
        console.error('신고 목록 불러오기 실패:', e);
        setReports([]);
      });
  }, [authLoading, isAdmin, router, toast]);

  async function handleDelete(postId: string) {
    if (!confirm('이 작품을 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await deletePost(postId);
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('작품을 삭제했어요.', 'success');
    } catch (e) {
      console.error('작품 삭제 실패:', e);
      toast('삭제하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  async function handleDismiss(postId: string) {
    try {
      await dismissReportsForPost(postId);
      setReports((prev) => prev?.filter((r) => r.postId !== postId) ?? null);
      toast('신고를 정리했어요.', 'success');
    } catch (e) {
      console.error('신고 무시 실패:', e);
      toast('처리하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  const groups = reports ? groupReports(reports) : null;

  return (
    <main className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="mb-4 text-[24px]">신고 처리</h1>
        {groups === null ? (
          <div className="py-10">
            <LoadingDots label="신고를 불러오는 중…" />
          </div>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-muted">처리할 신고가 없어요.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <ReportCard key={g.postId} group={g} onDelete={handleDelete} onDismiss={handleDismiss} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ReportCard({
  group,
  onDelete,
  onDismiss,
}: {
  group: ReportGroup;
  onDelete: (postId: string) => void;
  onDismiss: (postId: string) => void;
}) {
  return (
    <div className="anim-pop-in rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[19px]" title={group.postTitle}>
            {group.postTitle}
          </h2>
          <p className="text-[13px] text-muted">
            {group.postAuthorName || '익명'} · 신고 {group.items.length}건
          </p>
        </div>
        <a
          href={`/board?post=${group.postId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-line px-3 py-1.5 text-[13px] text-ink hover:border-brand/50"
        >
          작품 보기 <ExternalLink size={14} aria-hidden />
        </a>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {group.items.map((r) => (
          <li key={r.id} className="rounded-[var(--r-md)] border border-line px-3 py-2 text-[14px]">
            <span className="font-medium text-coral-ink">{r.reason}</span>
            {r.memo && <span className="text-ink"> — {r.memo}</span>}
            <span className="ml-2 text-[12px] text-muted">{formatDate(r.createdAt)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDismiss(group.postId)}>
          <Check size={16} aria-hidden /> 신고 무시
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => onDelete(group.postId)}
          className="!bg-coral !text-white hover:!brightness-95"
        >
          <Trash2 size={16} aria-hidden /> 작품 삭제
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && ./node_modules/.bin/tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 브라우저 확인(관리자/비관리자)**

- 비로그인/일반 사용자가 `/admin` 직접 진입 → 토스트 "관리자만 들어갈 수 있어요" + 홈 리다이렉트.
- 관리자 진입 → 신고된 작품이 카드로(제목·작성자·신고 N건·사유 목록), "작품 보기"는 새 탭. **작품 삭제** 시 작품+신고 사라짐, **신고 무시** 시 신고만 사라짐.
- 신고가 없으면 "처리할 신고가 없어요".

- [ ] **Step 4: 커밋**

```bash
cd /c/Users/amh47/Documents/test
git add ai-program-generator/app/admin/page.tsx
git commit -m "feat(report): 관리자 처리 화면 /admin

isAdmin 가드(+규칙), 작품별 그룹 카드, 작품 삭제/신고 무시 액션.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 통합 self-test + 빌드 + 최종 검증

**Files:**
- Create: `ai-program-generator/scripts/selftest-reports.mjs` (일회성, 커밋 안 함)

- [ ] **Step 1: 통합 self-test 스크립트 작성**

기존 `scripts/selftest-likes.mjs` 패턴을 따른다(Admin SDK로 custom token 발급 → client SDK로 로그인 → 배포된 규칙 하에서 동작 검증). `serviceAccountKey.json`(루트)과 `.env.local`의 `NEXT_PUBLIC_FIREBASE_*`를 사용.

`ai-program-generator/scripts/selftest-reports.mjs`:
```javascript
// 신고 기능 통합 self-test — 배포된 규칙 하에서 제출/관리자 읽기/삭제 + 규칙 거부 검증.
// 실행: node scripts/selftest-reports.mjs
import { readFileSync } from 'node:fs';
import { initializeApp as initAdmin, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where,
} from 'firebase/firestore';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => {
      const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sa = JSON.parse(readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'));
initAdmin({ credential: cert(sa) });

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);
const auth = getAuth(app);

const REPORTER = 'selftest-reporter';
const ADMIN = 'selftest-admin';
const POST_ID = 'selftest-post-xyz';
const RID = `${POST_ID}_${REPORTER}`;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };

async function asReporter() {
  const t = await getAdminAuth().createCustomToken(REPORTER); // admin claim 없음
  await signInWithCustomToken(auth, t);
}
async function asAdmin() {
  const t = await getAdminAuth().createCustomToken(ADMIN, { admin: true });
  await signInWithCustomToken(auth, t);
}
const payload = (uid) => ({
  postId: POST_ID, postTitle: '테스트 작품', postAuthorName: '코딩친구',
  postOwnerUid: 'someowner', reporterUid: uid, reason: '나쁜 말', createdAt: Date.now(),
});

try {
  // 1) 신고자: 본인 uid로 제출 성공
  await asReporter();
  await setDoc(doc(db, 'reports', RID), payload(REPORTER));
  ok(true, '신고자 제출 성공');

  // 2) 재신고: 덮어쓰기(중복 doc 안 생김)
  await setDoc(doc(db, 'reports', `${POST_ID}_${REPORTER}`), { ...payload(REPORTER), reason: '이상해요' });
  ok(true, '재신고 덮어쓰기 성공');

  // 3) 신고자: 다른 uid 사칭 제출 → 거부
  let rejected = false;
  try { await setDoc(doc(db, 'reports', `${POST_ID}_spoof`), payload('someone-else')); }
  catch { rejected = true; }
  ok(rejected, '사칭 uid 제출 거부됨');

  // 4) 신고자: reports 읽기 → 거부
  rejected = false;
  try { await getDocs(collection(db, 'reports')); } catch { rejected = true; }
  ok(rejected, '비관리자 reports 읽기 거부됨');

  // 5) 관리자: reports 읽기 성공 + 우리가 만든 신고 포함
  await signOut(auth);
  await asAdmin();
  const snap = await getDocs(query(collection(db, 'reports'), where('postId', '==', POST_ID)));
  ok(snap.docs.some((d) => d.id === RID), '관리자 reports 읽기 성공');

  // 6) 관리자: 신고 삭제 성공
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  const after = await getDoc(doc(db, 'reports', RID));
  ok(!after.exists(), '관리자 신고 삭제 성공');
} catch (e) {
  fail++; console.error('스크립트 예외:', e);
} finally {
  await signOut(auth).catch(() => {});
  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
```

- [ ] **Step 2: self-test 실행**

Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && node scripts/selftest-reports.mjs`
Expected: `결과: 6 pass / 0 fail` (제출·재신고·사칭거부·비관리자읽기거부·관리자읽기·관리자삭제 전부 통과). 실패 시 규칙/데이터계층 수정 후 재실행.

- [ ] **Step 3: dev 서버 정지 후 프로덕션 빌드**

dev 서버를 끄고(`.next` 공유 충돌 방지):
Run: `cd /c/Users/amh47/Documents/test/ai-program-generator && npm run build`
Expected: 타입체크 통과 + 빌드 성공. `/admin` 라우트가 빌드 출력에 별도 청크로 보임(코드 스플릿 확인).

- [ ] **Step 4: 브라우저 종단 확인(dev 재기동 후)**

스펙 §검증 기준 1~5 수동 확인: 신고 제출(비로그인→로그인, 사유+메모) → reports 기록; 재신고 덮어쓰기; 비관리자 `/admin` 차단; 관리자 카드 삭제/무시; 관리자 칩 "신고 N" + 진입.

- [ ] **Step 5: 푸시 전 점검 + 푸시**(pre-push 프로세스)

```bash
cd /c/Users/amh47/Documents/test
git status            # selftest-reports.mjs 등 미커밋 일회성 스크립트는 푸시 대상 아님(확인)
git diff origin/main --stat
```
diff 검토 + `tsc --noEmit` + `npm run build` 모두 clean이면:
```bash
git push origin main
```
Expected: 5개 기능 커밋(Task 1~4 + 필요 시 수정)이 origin/main에 반영.

---

## Self-Review

**1. Spec coverage** (스펙 §검증 기준 대조):
- 신고 제출 UI(비로그인→로그인, 사유+메모) → Task 2 ✓
- 재신고 덮어쓰기(doc id = postId_uid) → Task 1 submitReport + Task 5 self-test #2 ✓
- 비관리자 `/admin` 차단 + 규칙 읽기 거부 → Task 4 가드 + Task 1 규칙 + self-test #4 ✓
- 관리자 카드 + 작품 보기(새 탭) + 삭제/무시 → Task 4 ✓
- 관리자 칩 클릭 → `/admin` + 신고 N → Task 3 ✓
- tsc + 빌드 + 규칙 배포 + 통합 self-test → Task 1 Step3/4, Task 5 ✓
- 데이터 모델 `postAuthorName` 포함 → Task 1 `Report` + submitReport + 규칙 hasOnly ✓

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 단계가 완전한 코드 포함.

**3. Type consistency:**
- `Report` 필드(postId/postTitle/postAuthorName/postOwnerUid/reporterUid/reason/memo?/createdAt)가 Task 1 정의 ↔ Task 4 카드 사용 ↔ 규칙 hasOnly ↔ self-test payload 전부 일치 ✓
- 함수명 `submitReport`/`fetchReports`/`dismissReportsForPost`/`countReports` 모든 태스크에서 동일 ✓
- `toast(msg, 'success')` = 성공, `toast(msg)` = 에러(기본값) — Toast의 `Kind='error'|'success'`와 일치 ✓
- `useAuth()` 반환 `{ user, isAdmin, loading }` — Task 3/4에서 `isAdmin`/`loading` 사용 일치 ✓
- `formatDate(ms: number)` — `Report.createdAt`(number)와 일치 ✓
- `Header` props `{ active? }` — `/admin`은 active 없이 `<Header />` ✓
