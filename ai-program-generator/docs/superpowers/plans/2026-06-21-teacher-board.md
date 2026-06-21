# 선생님 게시판(C2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 각 선생님에게 자기 이름의 게시판(카테고리)을 주고, 학생 작품이 자동으로 그 게시판에 올라가며, 선생님이 그 게시판 글을 모더레이션(삭제)할 수 있게 한다.

**Architecture:** `ensureTeacherBoard(teacherUid)`(서버 Admin SDK·멱등)가 선생님 게시판 카테고리를 보장(`categories` 문서 + `teachers/{uid}.boardId` 캐시). 학생 업로드는 `GET /api/student/board`로 boardId를 받아 categoryId 고정(카테고리 선택 숨김). 선생님은 `/api/teacher/posts`(GET 목록)·`/api/teacher/posts/[id]`(DELETE, 소유 board 검증)로 모더레이션. categories/posts 쓰기는 서버라 firestore.rules 변경 없음.

**Tech Stack:** Next.js 15 App Router(route handlers, nodejs runtime), Firebase Admin SDK, 기존 `requireTeacher`·`UploadDialog`·`/teacher 콘솔`·`components/ui`. 테스트 프레임워크 없음 — tsc + 빌드 + self-test.

**공통:** 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`. git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. tsc `./node_modules/.bin/tsc --noEmit`. dev 중 build 금지. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 브랜치 `feat/teacher-board`. 규칙·인덱스 변경 없음(posts `categoryId asc, createdAt desc` 복합 인덱스는 기존 존재 — 게시판 글 목록 쿼리가 이를 사용).

---

### Task 1: Category 타입 + ensureTeacherBoard 헬퍼

**Files:** Modify `lib/firebase/types.ts`; Create `lib/server/teacherBoard.ts`

- [ ] **Step 1: `Category`에 teacherUid 추가.** `lib/firebase/types.ts`의 `Category` 인터페이스에 한 줄 추가(parentId 다음):
```ts
  /** 선생님 소유 게시판이면 그 선생님 uid (C2). 일반 게시판은 없음. */
  teacherUid?: string;
```

- [ ] **Step 2: 헬퍼 생성.** `lib/server/teacherBoard.ts`:
```ts
import { adminDb } from '@/lib/firebase/admin';

/**
 * 선생님 게시판(카테고리)을 보장한다. `teachers/{uid}.boardId` 캐시를 쓰고,
 * 없거나 그 카테고리가 사라졌으면 새로 만든다. 멱등(서버 Admin SDK — 규칙 우회).
 */
export async function ensureTeacherBoard(teacherUid: string): Promise<{ boardId: string; boardName: string }> {
  const teacherRef = adminDb.doc(`teachers/${teacherUid}`);
  const tSnap = await teacherRef.get();
  const t = tSnap.data();
  if (!t) throw new Error('teacher-not-found');
  const name = ((t.name as string | undefined) ?? '').trim() || '우리 반';

  const cachedId = t.boardId as string | undefined;
  if (cachedId) {
    const cSnap = await adminDb.doc(`categories/${cachedId}`).get();
    if (cSnap.exists) return { boardId: cachedId, boardName: (cSnap.data()?.name as string) ?? name };
  }

  const ref = await adminDb.collection('categories').add({
    name,
    order: Date.now(),
    createdAt: Date.now(),
    teacherUid,
  });
  await teacherRef.set({ boardId: ref.id }, { merge: true });
  return { boardId: ref.id, boardName: name };
}
```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/lib/firebase/types.ts ai-program-generator/lib/server/teacherBoard.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(board): Category.teacherUid + ensureTeacherBoard 헬퍼(멱등)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 학생 게시판 조회 API + 클라 헬퍼

**Files:** Create `app/api/student/board/route.ts`, `lib/student/board.ts`

- [ ] **Step 1: 라우트.** `app/api/student/board/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const header = req.headers.get('authorization') ?? '';
  const idToken = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!idToken) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 });

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.student !== true) {
      return NextResponse.json({ error: '학생만 쓸 수 있어요.' }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  try {
    const sSnap = await adminDb.doc(`students/${uid}`).get();
    const teacherUid = sSnap.data()?.teacherUid as string | undefined;
    if (!teacherUid) return NextResponse.json({ error: '반 정보를 찾을 수 없어요.' }, { status: 500 });
    const board = await ensureTeacherBoard(teacherUid);
    return NextResponse.json(board);
  } catch (e) {
    console.error('학생 게시판 조회 실패:', e);
    return NextResponse.json({ error: '게시판을 찾지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 클라 헬퍼.** `lib/student/board.ts`:
```ts
import { auth } from '@/lib/firebase/client';

export async function getMyBoard(): Promise<{ boardId: string; boardName: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/student/board', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as { boardId: string; boardName: string };
}
```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/student/board/ ai-program-generator/lib/student/board.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(board): GET /api/student/board(학생 게시판 보장·조회) + 클라 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 선생님 모더레이션 API + 클라 헬퍼

**Files:** Create `app/api/teacher/posts/route.ts`, `app/api/teacher/posts/[id]/route.ts`, `lib/teacher/posts.ts`

- [ ] **Step 1: 목록 라우트.** `app/api/teacher/posts/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const board = await ensureTeacherBoard(gate.uid);
    const snap = await adminDb
      .collection('posts')
      .where('categoryId', '==', board.boardId)
      .orderBy('createdAt', 'desc')
      .get();
    const posts = snap.docs.map((d) => {
      const p = d.data();
      return {
        id: d.id,
        title: (p.title as string) ?? '',
        authorName: (p.authorName as string) ?? '',
        createdAt: (p.createdAt as number) ?? 0,
      };
    });
    return NextResponse.json({ board: { id: board.boardId, name: board.boardName }, posts });
  } catch (e) {
    console.error('우리 반 게시판 조회 실패:', e);
    return NextResponse.json({ error: '게시판을 불러오지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 삭제 라우트.** `app/api/teacher/posts/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';
import { ensureTeacherBoard } from '@/lib/server/teacherBoard';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  try {
    const postRef = adminDb.doc(`posts/${id}`);
    const pSnap = await postRef.get();
    if (!pSnap.exists) return NextResponse.json({ error: '글을 찾을 수 없어요.' }, { status: 404 });
    const board = await ensureTeacherBoard(gate.uid);
    if (pSnap.data()?.categoryId !== board.boardId) {
      return NextResponse.json({ error: '우리 반 게시판 글이 아니에요.' }, { status: 403 });
    }
    await postRef.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('우리 반 글 삭제 실패:', e);
    return NextResponse.json({ error: '삭제하지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 클라 헬퍼.** `lib/teacher/posts.ts`:
```ts
import { auth } from '@/lib/firebase/client';

async function authed(path: string, init?: RequestInit) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export interface BoardPost {
  id: string;
  title: string;
  authorName: string;
  createdAt: number;
}

export function listBoardPosts(): Promise<{ board: { id: string; name: string }; posts: BoardPost[] }> {
  return authed('/api/teacher/posts');
}

export function deleteBoardPost(id: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/posts/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 5: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/teacher/posts/ ai-program-generator/lib/teacher/posts.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(board): 선생님 모더레이션 API(목록·삭제, 소유 board 검증) + 클라 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: UploadDialog — 학생 업로드 자동 라우팅

**Files:** Modify `components/board/UploadDialog.tsx`

학생이면 `getMyBoard()`로 categoryId를 고정하고 카테고리 선택 UI를 "우리 반 게시판" 안내로 대체한다. 비학생 흐름은 100% 유지.

- [ ] **Step 1: import 추가.** 상단 import에 추가:
```ts
import { getMyBoard } from '@/lib/student/board';
```

- [ ] **Step 2: 학생 board 상태 + 로드.** `const { user, isTeacher, isStudent } = useAuth();` 가 있는 컴포넌트 본문에, 기존 상태 선언들 근처에 추가:
```tsx
  const [studentBoard, setStudentBoard] = useState<{ boardId: string; boardName: string } | null>(null);
```
그리고 `open` 변화 효과들 근처에 새 effect 추가:
```tsx
  useEffect(() => {
    if (!open || !isStudent) return;
    setStudentBoard(null);
    getMyBoard()
      .then((b) => {
        setStudentBoard(b);
        setCategoryId(b.boardId);
      })
      .catch((e) => {
        console.error('학생 게시판 조회 실패:', e);
        setError('지금은 올릴 수 없어요. 잠시 후 다시 해주세요.');
      });
  }, [open, isStudent]);
```

- [ ] **Step 3: 카테고리 자동선택 효과가 학생을 덮지 않게.** 카테고리 leaves에서 categoryId를 derive하는 효과(`if (!categories.length || categoryId) return;` 로 시작하는 useEffect)의 첫 줄에 학생 가드 추가:
```tsx
    if (isStudent) return;
```
(이 effect의 deps 배열에 `isStudent`가 없으면 추가.)

- [ ] **Step 4: 빈-카테고리 가드를 학생에겐 우회.** `{leafPaths(categories).length === 0 ? (` 를:
```tsx
          {!isStudent && leafPaths(categories).length === 0 ? (
```
로 바꿔, 학생은 카테고리 목록이 비어도 폼을 본다.

- [ ] **Step 5: 카테고리 Select을 학생에겐 안내로 대체.** 다음 블록:
```tsx
              <Label text="어느 게시판에 올릴까요?">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {leafPaths(categories).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.path}
                    </option>
                  ))}
                </Select>
              </Label>
```
를 다음으로 교체:
```tsx
              {isStudent ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-medium text-muted">게시판</span>
                  <div className="rounded-[var(--r-md)] bg-surface-2 px-4 py-2.5 text-[14px] text-ink">
                    {studentBoard ? `우리 반 게시판 「${studentBoard.boardName}」에 올라가요` : '우리 반 게시판을 확인하는 중…'}
                  </div>
                </div>
              ) : (
                <Label text="어느 게시판에 올릴까요?">
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {leafPaths(categories).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.path}
                      </option>
                    ))}
                  </Select>
                </Label>
              )}
```

- [ ] **Step 6: 제출 시 학생용 메시지.** 제출 함수의 `if (!categoryId) return setError('게시판을 골라 주세요.');` 를:
```tsx
    if (!categoryId) return setError(isStudent ? '우리 반 게시판을 불러오는 중이에요. 잠시 후 다시 해주세요.' : '게시판을 골라 주세요.');
```

- [ ] **Step 7: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 8: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/components/board/UploadDialog.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(board): 학생 업로드는 우리 반 게시판으로 자동 라우팅(카테고리 선택 숨김)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: /teacher 콘솔 — "우리 반 게시판" 섹션

**Files:** Modify `app/teacher/page.tsx`

`Console` 컴포넌트에 게시판 글 목록 + 삭제를 추가한다(기존 학생 명단 섹션 아래).

- [ ] **Step 1: import 추가.** 상단 import에 추가:
```ts
import { listBoardPosts, deleteBoardPost, type BoardPost } from '@/lib/teacher/posts';
import { formatDate } from '@/lib/program';
```

- [ ] **Step 2: 상태 + 로드.** `Console` 컴포넌트의 상태 선언부에 추가:
```tsx
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
```
그리고 `reload` 함수 안(학생 목록 로드 다음)에 추가:
```tsx
    listBoardPosts()
      .then((r) => setBoardPosts(r.posts))
      .catch((e) => {
        console.error('우리 반 게시판 조회 실패:', e);
        toast('우리 반 게시판을 불러오지 못했어요.');
      })
      .finally(() => setLoadingBoard(false));
```
(reload 시작부에 `setLoadingList(true)`가 있다면 그 옆에 `setLoadingBoard(true);`도 추가.)

- [ ] **Step 3: 삭제 핸들러.** `Console` 안에 추가(remove 함수 근처):
```tsx
  async function removePost(p: BoardPost) {
    const ok = await confirm({
      title: '작품 삭제',
      message: `「${p.title}」을(를) 게시판에서 지울까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteBoardPost(p.id);
      toast('지웠어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '지우지 못했어요.');
    }
  }
```

- [ ] **Step 4: 섹션 렌더.** 학생 명단 블록(`<h2 …>우리 반 ({students.length}명)</h2>` … 로 시작해 닫히는 부분) 다음, 컴포넌트 최상위 `</div>` 직전에 추가:
```tsx
      <h2 className="mb-2 mt-8 text-[18px]">우리 반 게시판</h2>
      {loadingBoard ? (
        <div className="py-8">
          <LoadingDots label="확인 중…" />
        </div>
      ) : boardPosts.length === 0 ? (
        <p className="py-8 text-center text-muted">아직 올라온 작품이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {boardPosts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-[16px]">{p.title || '(제목 없음)'}</p>
                <p className="truncate text-[13px] text-muted">{p.authorName} · {formatDate(p.createdAt)}</p>
              </div>
              <Button variant="ghost" onClick={() => removePost(p)}>삭제</Button>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 5: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 6: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/teacher/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): /teacher에 '우리 반 게시판' 섹션(글 목록·삭제 모더레이션)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: self-test + 전체 검증

**Files:** Create `scripts/selftest-teacher-board.mjs` (미커밋)

- [ ] **Step 1: self-test 작성.** dev 서버 + 규칙 배포 전제. `scripts/selftest-teacher-board.mjs`:
```js
// 선생님 게시판(C2) 검증: 게시판 보장, 학생 board=선생님 board, 모더레이션 소유권/삭제, 비학생 403.
// 사전: npm run dev. 사용: node scripts/selftest-teacher-board.mjs [baseUrl]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://localhost:3000';
const sa = JSON.parse(readFileSync(join(root, 'serviceAccountKey.json'), 'utf8'));
const env = {};
for (const l of readFileSync(join(root, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
initializeApp({ credential: cert(sa) });
const auth = getAuth();
const db = getFirestore();

async function tokenFor(uid, claims) {
  const custom = await auth.createCustomToken(uid, claims);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: custom, returnSecureToken: true }) });
  const d = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(d));
  return d.idToken;
}
const authH = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? (pass++, console.log('  ✅', n)) : (fail++, console.log('  ❌', n, d || '')); };

const T1 = 'selftest-board-teacher1';
const T2 = 'selftest-board-teacher2';
const STU = 'selftest-board-student1';
const PLAIN = 'selftest-board-plain';

async function cleanup() {
  for (const uid of [T1, T2, STU, PLAIN]) await auth.deleteUser(uid).catch(() => {});
  for (const uid of [T1, T2]) {
    const tdoc = await db.doc(`teachers/${uid}`).get();
    const bid = tdoc.data()?.boardId;
    if (bid) {
      const ps = await db.collection('posts').where('categoryId', '==', bid).get().catch(() => ({ docs: [] }));
      for (const d of ps.docs) await d.ref.delete().catch(() => {});
      await db.doc(`categories/${bid}`).delete().catch(() => {});
    }
    await db.doc(`teachers/${uid}`).delete().catch(() => {});
  }
  await db.doc(`students/${STU}`).delete().catch(() => {});
}

async function main() {
  await cleanup();
  // 선생님 2명 + 학생1(소속 T1) 시드
  for (const [uid, nm] of [[T1, '햇님반선생'], [T2, '바다반선생']]) {
    await auth.createUser({ uid, email: `${uid}@class.kr`, password: 'pw1234' });
    await auth.setCustomUserClaims(uid, { teacher: true });
    await db.doc(`teachers/${uid}`).set({ name: nm, totalQuota: 100, usedTotal: 0, createdAt: Date.now() });
  }
  await auth.createUser({ uid: STU, email: `${STU}@class.kr`, password: 'pw1234' });
  await auth.setCustomUserClaims(STU, { student: true });
  await db.doc(`students/${STU}`).set({ teacherUid: T1, name: '학생1', limitType: 'daily', limitValue: 5, usedTotal: 0, createdAt: Date.now() });
  await auth.createUser({ uid: PLAIN, email: `${PLAIN}@class.kr`, password: 'pw1234' }); // claim 없음(일반)

  const t1 = await tokenFor(T1);
  const t2 = await tokenFor(T2);
  const st = await tokenFor(STU);
  const plain = await tokenFor(PLAIN);

  // 1) 선생님 게시판 목록 → board 생성됨
  const r1 = await fetch(`${BASE}/api/teacher/posts`, { headers: authH(t1) });
  const j1 = await r1.json().catch(() => ({}));
  check('GET /api/teacher/posts 200 + board 생성', r1.status === 200 && !!j1.board?.id, `status=${r1.status} ${JSON.stringify(j1)}`);
  const boardId = j1.board?.id;
  const tdoc = await db.doc(`teachers/${T1}`).get();
  check('teachers.boardId 캐시됨', tdoc.data()?.boardId === boardId);

  // 2) 학생 board == 선생님 board
  const r2 = await fetch(`${BASE}/api/student/board`, { headers: authH(st) });
  const j2 = await r2.json().catch(() => ({}));
  check('학생 board == 선생님 board', r2.status === 200 && j2.boardId === boardId, `status=${r2.status} ${JSON.stringify(j2)}`);

  // 3) 비학생 → /api/student/board 403
  const r3 = await fetch(`${BASE}/api/student/board`, { headers: authH(plain) });
  check('비학생 → /api/student/board 403', r3.status === 403, `status=${r3.status}`);

  // 4) board에 글 시드 → 목록에 포함
  const postRef = await db.collection('posts').add({ ownerUid: STU, categoryId: boardId, title: '내 작품', authorName: '학생1', createdAt: Date.now() });
  const r4 = await fetch(`${BASE}/api/teacher/posts`, { headers: authH(t1) });
  const j4 = await r4.json().catch(() => ({}));
  check('목록에 시드 글 포함', (j4.posts ?? []).some((p) => p.id === postRef.id), JSON.stringify(j4.posts));

  // 5) 타 선생님 삭제 → 403
  const r5 = await fetch(`${BASE}/api/teacher/posts/${postRef.id}`, { method: 'DELETE', headers: authH(t2) });
  check('타 선생님 글 삭제 403', r5.status === 403, `status=${r5.status}`);

  // 6) 소유 선생님 삭제 → 200 + 삭제 확인
  const r6 = await fetch(`${BASE}/api/teacher/posts/${postRef.id}`, { method: 'DELETE', headers: authH(t1) });
  check('소유 선생님 글 삭제 200', r6.status === 200, `status=${r6.status}`);
  const gone = !(await postRef.get()).exists;
  check('post 삭제됨', gone);

  await cleanup();
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 띄운 채 실행.** Run: `node scripts/selftest-teacher-board.mjs`
  Expected: 8개 체크 모두 ✅ → `결과: 8 통과, 0 실패`. 실패 시 구현 수정 후 재실행.

- [ ] **Step 3: 타입체크 + 빌드.** dev 정지 후:
  Run: `./node_modules/.bin/tsc --noEmit` → 에러 0.
  Run: `rm -rf .next && npm run build` → 빌드 성공. `/api/student/board`, `/api/teacher/posts` 라우트 출력 확인.

- [ ] **Step 4: self-test 미커밋 확인.** `git -C "C:/Users/amh47/Documents/test" status` 에서 `scripts/selftest-teacher-board.mjs`가 untracked(`??`)인지 확인. 별도 커밋 없음.

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- Category.teacherUid + ensureTeacherBoard(멱등) → Task 1. ✓
- 학생 업로드 자동 라우팅(/api/student/board + UploadDialog) → Task 2 + Task 4. ✓
- 선생님 모더레이션(목록·삭제, 소유 검증) → Task 3. ✓
- /teacher "우리 반 게시판" 섹션 → Task 5. ✓
- 선생님 삭제=계정만(추가 작업 없음) → 플랜에 캐스케이드 없음. ✓
- firestore.rules 변경 없음 → 플랜에 규칙 작업 없음. ✓
- 검증(self-test 8/8·tsc·build) → Task 6. ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 모든 코드 블록 완전. ✓

**3. Type consistency:**
- `ensureTeacherBoard(uid): Promise<{boardId, boardName}>` — Task1 정의, Task2/Task3 호출 일치. ✓
- `getMyBoard(): Promise<{boardId, boardName}>` — Task2 정의, Task4 사용. ✓
- `BoardPost`{id,title,authorName,createdAt} — Task3 정의, Task5 사용. ✓
- `listBoardPosts()`/`deleteBoardPost(id)` — Task3 정의, Task5 호출. ✓
- `teachers/{uid}.boardId` — Task1(쓰기)·Task6(검증) 일치. ✓
- `Category.teacherUid?` — Task1 정의(타입), ensureTeacherBoard가 set. ✓
- `formatDate(createdAt)` — 기존 `@/lib/program` export(마이페이지에서 동일 사용). Task5에서 import. ✓
