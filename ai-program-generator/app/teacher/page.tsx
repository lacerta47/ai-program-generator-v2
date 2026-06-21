'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { auth } from '@/lib/firebase/client';
import Header from '@/components/common/Header';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { listStudents, createStudents, patchStudent, deleteStudent, type Student } from '@/lib/teacher/students';
import { listBoardPosts, deleteBoardPost, type BoardPost } from '@/lib/teacher/posts';
import { formatDate } from '@/lib/program';

interface TeacherInfo {
  name: string;
  totalQuota: number;
  usedTotal: number;
}

async function fetchTeacherMe(): Promise<TeacherInfo> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요해요.');
  const idToken = await u.getIdToken();
  const res = await fetch('/api/teacher/me', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as TeacherInfo;
}

export default function TeacherPage() {
  const { user, loading, isTeacher } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !isTeacher) router.replace('/');
  }, [loading, user, isTeacher, router]);

  return (
    <main className="min-h-screen">
      <Header />
      {loading || !user || !isTeacher ? (
        <div className="py-16">
          <LoadingDots label="확인 중…" />
        </div>
      ) : (
        <Console />
      )}
    </main>
  );
}

/** 발급된 계정 목록을 배포용 텍스트로 만든다(공용 비번 + 아이디 목록). */
function buildCredText(list: { email: string; password: string }[]): string {
  if (!list.length) return '';
  return `공용 비밀번호: ${list[0].password}\n` + list.map((c) => c.email).join('\n');
}

function Console() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState<TeacherInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [boardLimited, setBoardLimited] = useState(false); // 최근 50개만 반환됐는지
  const [loadingBoard, setLoadingBoard] = useState(true);

  const [prefix, setPrefix] = useState('');
  const [count, setCount] = useState('');
  const [password, setPassword] = useState('');
  const [limitType, setLimitType] = useState<'daily' | 'total'>('daily');
  const [limitValue, setLimitValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string }[] | null>(null);

  const reload = () => {
    setLoadingList(true);
    setLoadingBoard(true);
    fetchTeacherMe()
      .then(setInfo)
      .catch((e) => console.error('선생님 정보 조회 실패:', e));
    listStudents()
      .then((r) => setStudents(r.students))
      .catch((e) => {
        console.error('학생 목록 조회 실패:', e);
        toast('학생 목록을 불러오지 못했어요.');
      })
      .finally(() => setLoadingList(false));
    listBoardPosts()
      .then((r) => {
        setBoardPosts(r.posts);
        setBoardLimited(r.limited);
      })
      .catch((e) => {
        console.error('우리 반 게시판 조회 실패:', e);
        toast('우리 반 게시판을 불러오지 못했어요.');
      })
      .finally(() => setLoadingBoard(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const c = Number(count);
    const v = Number(limitValue);
    if (!Number.isInteger(c) || c < 1 || c > 50) return toast('인원수는 1~50명으로 적어 주세요.');
    if (!Number.isInteger(v) || v < 1) return toast('한도는 1 이상의 정수로 적어 주세요.');
    setBusy(true);
    try {
      const r = await createStudents({ prefix: prefix.trim(), count: c, password, limitType, limitValue: v });
      setCreated(r.created);
      if (r.skipped.length) toast(`${r.skipped.length}명은 이미 있는 아이디라 건너뛰었어요.`);
      setPrefix('');
      setCount('');
      setPassword('');
      setLimitValue('');
      toast(`${r.created.length}명 만들었어요.`, 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '만들지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function changeLimit(s: Student) {
    const v = window.prompt(`${s.name} 한도 (${s.limitType === 'total' ? '총' : '1일'} 횟수)`, String(s.limitValue));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) return toast('1 이상의 정수로 적어 주세요.');
    try {
      await patchStudent(s.uid, { limitValue: n });
      toast('한도를 바꿨어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

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

  async function remove(s: Student) {
    const ok = await confirm({
      title: '학생 삭제',
      message: `${s.name} 계정을 삭제할까요? 되돌릴 수 없어요.`,
      confirmLabel: '삭제',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteStudent(s.uid);
      toast('삭제했어요.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-[24px]">{info?.name ? `${info.name} 선생님` : '선생님'}</h1>
      <p className="mt-1 text-[14px] text-muted">
        우리 반 한도 <span className="text-ink">{info ? `${info.usedTotal}/${info.totalQuota}` : '…'}</span>
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="text-[18px]">학생 만들기</h2>
        <Label text="반 이름 (영문 소문자·숫자·-)" required>
          <TextInput
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="haetnim"
            pattern="[a-z0-9-]+"
            title="영문 소문자·숫자·- 만 쓸 수 있어요"
            required
          />
        </Label>
        <Label text="인원수 (1~50)" required>
          <TextInput inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="20" required />
        </Label>
        <Label text="공용 비밀번호 (6자 이상)" required>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Label>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" aria-label="1일 한도" checked={limitType === 'daily'} onChange={() => setLimitType('daily')} /> 1일 한도
          </label>
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" aria-label="총 한도" checked={limitType === 'total'} onChange={() => setLimitType('total')} /> 총 한도
          </label>
        </div>
        <Label text="한도 값 (횟수)" required>
          <TextInput inputMode="numeric" value={limitValue} onChange={(e) => setLimitValue(e.target.value)} placeholder="5" required />
        </Label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? '만드는 중…' : '학생 만들기'}
        </Button>
        {created && (
          <div className="rounded-[var(--r-md)] bg-mint-soft px-3.5 py-2.5 text-[13px] text-mint-ink">
            <p className="mb-1 font-medium">만든 계정 (공용 비번으로 로그인) — 학생들에게 나눠주세요</p>
            {created[0] && <p className="mb-1">공용 비밀번호: <b>{created[0].password}</b></p>}
            <ul className="space-y-0.5">
              {created.map((c) => (
                <li key={c.email}>{c.email}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="soft"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildCredText(created));
                    toast('계정 목록을 복사했어요.', 'success');
                  } catch {
                    toast('복사하지 못했어요.');
                  }
                }}
              >
                전체 복사
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const blob = new Blob([buildCredText(created)], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = '우리반-계정.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                텍스트로 저장
              </Button>
            </div>
          </div>
        )}
      </form>

      <h2 className="mb-2 mt-6 text-[18px]">우리 반 ({students.length}명)</h2>
      {loadingList ? (
        <div className="py-8">
          <LoadingDots label="확인 중…" />
        </div>
      ) : students.length === 0 ? (
        <p className="py-8 text-center text-muted">아직 학생이 없어요.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((s) => (
            <div key={s.uid} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] border-2 border-line bg-surface p-4">
              <div className="min-w-0">
                <p className="truncate text-[16px]">
                  {s.name} {s.disabled && <span className="text-coral-ink">· 정지됨</span>}
                </p>
                <p className="truncate text-[13px] text-muted">
                  {s.limitType === 'total' ? `총 ${s.limitValue} · 누적 ${s.usedTotal}` : `1일 ${s.limitValue}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="soft" onClick={() => changeLimit(s)}>한도</Button>
                <Button variant="ghost" onClick={() => remove(s)}>삭제</Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
          {boardLimited && (
            <p className="pt-1 text-center text-[12.5px] text-muted">최근 50개만 보여요.</p>
          )}
        </div>
      )}
    </div>
  );
}
