# 교사 신고 인박스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사가 `/teacher`에서 자기 반 학생의 신고된 작품을 보고 삭제하거나 신고를 무시할 수 있게 한다(우리 반 범위; 관리자 전체 신고는 그대로).

**Architecture:** `requireTeacher`로 게이트한 서버 API가 `reports`를 읽어 `postOwnerUid ∈ 내 학생`만 필터/처리(rules는 reports를 admin-only로 막지만 서버 Admin SDK는 우회). `/teacher` 콘솔에 신고 섹션 추가.

**Tech Stack:** Next.js 15 App Router(route handlers, nodejs runtime), Firebase Admin SDK, 기존 `components/ui`·`useConfirm`·`useToast`·`requireTeacher`. 테스트 프레임워크 없음 — `tsc` + 빌드 + self-test.

**공통:** 명령은 `C:/Users/amh47/Documents/test/ai-program-generator`. git은 repo 루트 `git -C "C:/Users/amh47/Documents/test"`. tsc `./node_modules/.bin/tsc --noEmit`. dev 중 build 금지. 커밋 본문 끝 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. 브랜치 `feat/teacher-reports`. 규칙 변경 없음.

---

### Task 1: 신고 목록 API(GET) + 클라 헬퍼

**Files:** Create `app/api/teacher/reports/route.ts`, `lib/teacher/reports.ts`

- [ ] **Step 1: GET 라우트.** `app/api/teacher/reports/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

interface Group {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  items: { reason: string; memo?: string; createdAt: number }[];
}

export async function GET(req: NextRequest) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const stuSnap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
    const studentUids = new Set(stuSnap.docs.map((d) => d.id));
    if (studentUids.size === 0) return NextResponse.json({ reports: [] });

    const repSnap = await adminDb.collection('reports').get();
    const groups = new Map<string, Group>();
    for (const d of repSnap.docs) {
      const r = d.data();
      const ownerUid = r.postOwnerUid as string | undefined;
      if (!ownerUid || !studentUids.has(ownerUid)) continue;
      const postId = r.postId as string;
      let g = groups.get(postId);
      if (!g) {
        g = {
          postId,
          postTitle: (r.postTitle as string) ?? '',
          postAuthorName: (r.postAuthorName as string) ?? '',
          postOwnerUid: ownerUid,
          items: [],
        };
        groups.set(postId, g);
      }
      g.items.push({
        reason: (r.reason as string) ?? '',
        ...(r.memo ? { memo: r.memo as string } : {}),
        createdAt: (r.createdAt as number) ?? 0,
      });
    }
    const reports = [...groups.values()].sort((a, b) => b.items.length - a.items.length);
    return NextResponse.json({ reports });
  } catch (e) {
    console.error('교사 신고 조회 실패:', e);
    return NextResponse.json({ error: '신고를 불러오지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 클라 헬퍼.** `lib/teacher/reports.ts`:
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

export interface TeacherReportGroup {
  postId: string;
  postTitle: string;
  postAuthorName: string;
  postOwnerUid: string;
  items: { reason: string; memo?: string; createdAt: number }[];
}

export function listTeacherReports(): Promise<{ reports: TeacherReportGroup[] }> {
  return authed('/api/teacher/reports');
}

export function dismissReportedPost(postId: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: false }),
  });
}

export function deleteReportedPost(postId: string): Promise<{ ok: true }> {
  return authed(`/api/teacher/reports/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletePost: true }),
  });
}
```

- [ ] **Step 3: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 4: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/api/teacher/reports/route.ts ai-program-generator/lib/teacher/reports.ts
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): 신고 목록 API(GET, 내 학생 신고) + 클라 헬퍼

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 신고 처리 API(DELETE — 무시/글삭제)

**Files:** Create `app/api/teacher/reports/[postId]/route.ts`

- [ ] **Step 1: DELETE 라우트.** `app/api/teacher/reports/[postId]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireTeacher } from '@/lib/admin/requireTeacher';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const gate = await requireTeacher(req);
  if (gate instanceof NextResponse) return gate;
  const { postId } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* 본문 없으면 무시(=dismiss) */
  }
  const deletePost = (body as { deletePost?: unknown })?.deletePost === true;

  try {
    const stuSnap = await adminDb.collection('students').where('teacherUid', '==', gate.uid).get();
    const studentUids = new Set(stuSnap.docs.map((d) => d.id));

    const repSnap = await adminDb.collection('reports').where('postId', '==', postId).get();
    if (repSnap.empty) return NextResponse.json({ error: '신고를 찾을 수 없어요.' }, { status: 404 });
    // report의 postOwnerUid가 내 학생인지로 권한 판정(인박스 범위의 source of truth)
    const mine = repSnap.docs.some((d) => studentUids.has(d.data().postOwnerUid as string));
    if (!mine) return NextResponse.json({ error: '우리 반 신고가 아니에요.' }, { status: 403 });

    if (deletePost) {
      await adminDb.doc(`posts/${postId}`).delete();
    }
    for (let i = 0; i < repSnap.docs.length; i += 450) {
      const batch = adminDb.batch();
      repSnap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('교사 신고 처리 실패:', e);
    return NextResponse.json({ error: '처리하지 못했어요.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 3: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add "ai-program-generator/app/api/teacher/reports/[postId]/route.ts"
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): 신고 처리 API(DELETE — 무시/글삭제, 내 학생 소유 검증)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: /teacher 콘솔 신고 섹션

**Files:** Modify `app/teacher/page.tsx`

`Console` 컴포넌트에 신고 섹션을 추가한다(풀 한도 줄 아래, "학생 만들기" 폼 위). READ the file first.

- [ ] **Step 1: import 추가.**
```ts
import { listTeacherReports, dismissReportedPost, deleteReportedPost, type TeacherReportGroup } from '@/lib/teacher/reports';
```
(`formatDate`는 이미 import돼 있음 — 없으면 `import { formatDate } from '@/lib/program';` 추가.)

- [ ] **Step 2: 상태.** `Console`의 상태 선언부에 추가:
```tsx
  const [reports, setReports] = useState<TeacherReportGroup[]>([]);
```

- [ ] **Step 3: reload에 신고 조회 추가.** `reload` 함수 안(다른 목록 조회들과 나란히)에 추가:
```tsx
    listTeacherReports()
      .then((r) => setReports(r.reports))
      .catch((e) => console.error('신고 조회 실패:', e));
```

- [ ] **Step 4: 처리 핸들러.** `Console` 안(다른 핸들러 근처)에 추가:
```tsx
  async function dismissReport(g: TeacherReportGroup) {
    try {
      await dismissReportedPost(g.postId);
      toast('신고를 정리했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리하지 못했어요.');
    }
  }

  async function removeReportedPost(g: TeacherReportGroup) {
    const ok = await confirm({
      title: '작품 삭제',
      message: `「${g.postTitle}」을(를) 삭제할까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteReportedPost(g.postId);
      toast('작품을 삭제했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.');
    }
  }
```

- [ ] **Step 5: 섹션 렌더.** `Console`의 `return (...)`에서, 풀 한도 표시 `<p ...>우리 반 한도 ...</p>` 다음·"학생 만들기" `<form ...>` 앞에 삽입:
```tsx
      {reports.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-[18px] text-coral-ink">처리할 신고 {reports.reduce((n, g) => n + g.items.length, 0)}건</h2>
          <div className="flex flex-col gap-2">
            {reports.map((g) => (
              <div key={g.postId} className="rounded-[var(--r-md)] border-2 border-coral/40 bg-coral-soft/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[16px]">{g.postTitle || '(제목 없음)'}</p>
                    <p className="truncate text-[13px] text-muted">{g.postAuthorName || '익명'} · 신고 {g.items.length}건</p>
                  </div>
                  <a
                    href={`/board?post=${g.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-line bg-surface px-3 py-1.5 text-[13px] text-ink hover:border-brand/50"
                  >
                    작품 보기
                  </a>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {g.items.map((it, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="font-medium text-coral-ink">{it.reason}</span>
                      {it.memo && <span className="text-ink"> — {it.memo}</span>}
                      <span className="ml-2 text-[12px] text-muted">{formatDate(it.createdAt)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => dismissReport(g)}>신고 무시</Button>
                  <Button variant="soft" onClick={() => removeReportedPost(g)}>작품 삭제</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
```

- [ ] **Step 6: 타입체크.** `./node_modules/.bin/tsc --noEmit` → 에러 0.

- [ ] **Step 7: 커밋.**
```
git -C "C:/Users/amh47/Documents/test" add ai-program-generator/app/teacher/page.tsx
git -C "C:/Users/amh47/Documents/test" commit -m "feat(teacher): /teacher 신고 인박스 섹션(우리 반 신고 보기·삭제·무시)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: self-test + 검증

**Files:** Create `scripts/selftest-teacher-reports.mjs` (미커밋)

- [ ] **Step 1: self-test 작성.** dev 실행 전제. `scripts/selftest-teacher-reports.mjs`:
```js
// 교사 신고 인박스 검증: 내 학생 신고만 보임, 타 교사 403, 무시(글유지)·삭제(글+신고).
// 사전: npm run dev. 사용: node scripts/selftest-teacher-reports.mjs [baseUrl]
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

const T1 = 'selftest-trep-teacher1';
const T2 = 'selftest-trep-teacher2';
const S1 = 'selftest-trep-student1'; // T1 산하
const S2 = 'selftest-trep-student2'; // T2 산하
const POST1 = 'selftest-trep-post1'; // S1의 글
const POST2 = 'selftest-trep-post2'; // S2의 글

async function cleanup() {
  for (const uid of [T1, T2, S1, S2]) { await auth.deleteUser(uid).catch(() => {}); await db.doc(`students/${uid}`).delete().catch(() => {}); await db.doc(`teachers/${uid}`).delete().catch(() => {}); }
  for (const p of [POST1, POST2]) await db.doc(`posts/${p}`).delete().catch(() => {});
  const reps = await db.collection('reports').where('postId', 'in', [POST1, POST2]).get().catch(() => ({ docs: [] }));
  for (const d of reps.docs) await d.ref.delete().catch(() => {});
}

async function main() {
  await cleanup();
  for (const [t, s, p] of [[T1, S1, POST1], [T2, S2, POST2]]) {
    await auth.createUser({ uid: t, email: `${t}@class.kr`, password: 'pw1234' });
    await auth.setCustomUserClaims(t, { teacher: true });
    await db.doc(`teachers/${t}`).set({ name: t, totalQuota: 100, usedTotal: 0, createdAt: Date.now() });
    await db.doc(`students/${s}`).set({ teacherUid: t, name: s, limitType: 'daily', limitValue: 5, usedTotal: 0, createdAt: Date.now() });
    await db.doc(`posts/${p}`).set({ ownerUid: s, categoryId: 'x', title: `${p} 제목`, authorName: s, createdAt: Date.now() });
    await db.doc(`reports/${p}_reporterX`).set({ postId: p, postTitle: `${p} 제목`, postAuthorName: s, postOwnerUid: s, reporterUid: 'reporterX', reason: '나쁜말', createdAt: Date.now() });
  }
  const t1 = await tokenFor(T1);
  const t2 = await tokenFor(T2);

  // 1) 교사1 신고 목록 = 내 학생(POST1)만
  const r1 = await fetch(`${BASE}/api/teacher/reports`, { headers: authH(t1) });
  const j1 = await r1.json().catch(() => ({}));
  const ids = (j1.reports ?? []).map((g) => g.postId);
  check('내 학생 신고만 보임', r1.status === 200 && ids.includes(POST1) && !ids.includes(POST2), `status=${r1.status} ids=${JSON.stringify(ids)}`);

  // 2) 교사2가 POST1(타 교사 학생) 처리 시도 → 403
  const rOwn = await fetch(`${BASE}/api/teacher/reports/${POST1}`, { method: 'DELETE', headers: authH(t2), body: JSON.stringify({ deletePost: false }) });
  check('타 교사 신고 처리 403', rOwn.status === 403, `status=${rOwn.status}`);

  // 3) 교사1 무시(글 유지)
  const rDis = await fetch(`${BASE}/api/teacher/reports/${POST1}`, { method: 'DELETE', headers: authH(t1), body: JSON.stringify({ deletePost: false }) });
  check('무시 200', rDis.status === 200, `status=${rDis.status}`);
  const repsGone = (await db.collection('reports').where('postId', '==', POST1).get()).empty;
  const postKept = (await db.doc(`posts/${POST1}`).get()).exists;
  check('무시: 신고 삭제·글 유지', repsGone && postKept);

  // 4) 교사1 글삭제(글+신고). POST1 신고는 위에서 지웠으니 다시 시드.
  await db.doc(`reports/${POST1}_reporterY`).set({ postId: POST1, postTitle: 'x', postAuthorName: S1, postOwnerUid: S1, reporterUid: 'reporterY', reason: '이상해요', createdAt: Date.now() });
  const rDel = await fetch(`${BASE}/api/teacher/reports/${POST1}`, { method: 'DELETE', headers: authH(t1), body: JSON.stringify({ deletePost: true }) });
  check('글삭제 200', rDel.status === 200, `status=${rDel.status}`);
  const postGone = !(await db.doc(`posts/${POST1}`).get()).exists;
  const reps2Gone = (await db.collection('reports').where('postId', '==', POST1).get()).empty;
  check('글삭제: 글+신고 모두 삭제', postGone && reps2Gone);

  await cleanup();
  console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: dev 띄운 채 실행.** Run: `node scripts/selftest-teacher-reports.mjs`
  Expected: 6개 체크 모두 ✅ → `결과: 6 통과, 0 실패`. 실패 시 구현 수정 후 재실행.

- [ ] **Step 3: 타입체크 + 빌드.** dev 정지 후:
  Run: `./node_modules/.bin/tsc --noEmit` → 에러 0.
  Run: `rm -rf .next && npm run build` → 빌드 성공. (이후 dev로 돌아갈 땐 `rm -rf .next` 후 dev 재시작 — .next 충돌 방지.)

- [ ] **Step 4: self-test 미커밋 확인.** `git -C "C:/Users/amh47/Documents/test" status` 에서 `scripts/selftest-teacher-reports.mjs`가 untracked(`??`). 별도 커밋 없음.

---

## Self-Review (작성자 점검)

**1. Spec coverage:**
- GET 내 학생 신고(postOwnerUid∈students)·글별 그룹 → Task 1. ✓
- DELETE 무시/글삭제 + 소유 검증(403) → Task 2. ✓
- 클라 헬퍼 3종 → Task 1(lib). ✓
- /teacher 신고 섹션(보기·삭제·무시, 0건 미렌더, 건수 표시) → Task 3. ✓
- 관리자 전체 신고 불변 → 변경 없음. ✓
- 규칙 변경 없음 → 플랜에 없음. ✓
- 검증(self-test 6/6·tsc·build) → Task 4. ✓

**2. Placeholder scan:** "TODO/TBD" 없음. 코드 블록 완전. ✓

**3. Type consistency:**
- `TeacherReportGroup`{postId,postTitle,postAuthorName,postOwnerUid,items:[{reason,memo?,createdAt}]} — Task1 정의(서버 Group 형태와 동일)·Task3 사용 일치. ✓
- `listTeacherReports()`/`dismissReportedPost(postId)`/`deleteReportedPost(postId)` — Task1 정의, Task3 호출 일치. DELETE 엔드포인트는 Task2(헬퍼는 fetch라 선정의 무방). ✓
- DELETE 본문 `{ deletePost: boolean }` — 헬퍼(Task1)·라우트(Task2) 일치. ✓
- `requireTeacher` 반환 `{uid}|NextResponse` — Task1·2에서 `instanceof NextResponse` 분기. ✓
- `formatDate(createdAt:number)` — Task3에서 사용(기존 import). ✓
