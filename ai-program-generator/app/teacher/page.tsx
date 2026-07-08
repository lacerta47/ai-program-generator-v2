'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { authedJson } from '@/lib/client/authedFetch';
import Header from '@/components/common/Header';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { listStudents, createStudents, patchStudent, deleteStudent, type Student } from '@/lib/teacher/students';
import { listBoardPosts, deleteBoardPost, type BoardPost } from '@/lib/teacher/posts';
import { listTeacherReports, dismissReportedPost, deleteReportedPost, type TeacherReportGroup } from '@/lib/teacher/reports';
import { getViewPinStatus, setViewPin } from '@/lib/teacher/viewPin';
import { formatDate } from '@/lib/program';
import ClassInsights from '@/components/teacher/ClassInsights';

interface TeacherInfo {
  name: string;
  totalQuota: number;
  usedTotal: number;
}

function fetchTeacherMe(): Promise<TeacherInfo> {
  return authedJson<TeacherInfo>('/api/teacher/me');
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

/** 발급된 계정 목록을 배포용 텍스트로 만든다(학교·PIN·학번 목록). */
function buildCredText(schoolCode: string, list: { email: string; hakbun: string; password: string }[]): string {
  if (!list.length) return '';
  return `학교 코드: ${schoolCode}\n공용 PIN: ${list[0].password}\n학번:\n` + list.map((c) => c.hakbun).join('\n');
}

function Console() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState<TeacherInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [reports, setReports] = useState<TeacherReportGroup[]>([]);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [boardLimited, setBoardLimited] = useState(false); // 최근 50개만 반환됐는지
  const [loadingBoard, setLoadingBoard] = useState(true);

  const [grade, setGrade] = useState('');
  const [classNo, setClassNo] = useState('');
  const [count, setCount] = useState('');
  const [startNo, setStartNo] = useState('1');
  const [password, setPassword] = useState('');
  const [limitType, setLimitType] = useState<'daily' | 'total'>('daily');
  const [limitValue, setLimitValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; hakbun: string; password: string }[] | null>(null);
  const [createdSchool, setCreatedSchool] = useState('');
  const [editTarget, setEditTarget] = useState<Student | null>(null); // 한도 수정 모달 대상
  const [editVal, setEditVal] = useState('');
  const [hasPin, setHasPin] = useState(false); // 관람 PIN 설정 여부
  const [pinOpen, setPinOpen] = useState(false); // 관람 PIN 모달
  const [pinVal, setPinVal] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

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
    listTeacherReports()
      .then((r) => setReports(r.reports))
      .catch((e) => console.error('신고 조회 실패:', e));
    getViewPinStatus()
      .then((r) => setHasPin(r.hasPin))
      .catch((e) => console.error('관람 PIN 상태 조회 실패:', e));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const g = Number(grade);
    const c = Number(classNo);
    const n = Number(count);
    const s = Number(startNo);
    const v = Number(limitValue);
    if (!Number.isInteger(g) || g < 1 || g > 6) return toast('학년은 1~6으로 적어 주세요.');
    if (!Number.isInteger(c) || c < 1 || c > 99) return toast('반은 1~99로 적어 주세요.');
    if (!Number.isInteger(n) || n < 1 || n > 50) return toast('인원수는 1~50명으로 적어 주세요.');
    if (!Number.isInteger(s) || s < 1 || s + n - 1 > 99) return toast('학생 번호(시작 번호+인원수)는 1~99 범위로 해주세요.');
    if (password.length < 6) return toast('PIN은 6자 이상으로 적어 주세요.');
    if (!Number.isInteger(v) || v < 1) return toast('한도는 1 이상의 정수로 적어 주세요.');
    setBusy(true);
    try {
      const r = await createStudents({ grade: g, classNo: c, count: n, startNo: s, password, limitType, limitValue: v });
      setCreated(r.created);
      setCreatedSchool(r.schoolCode);
      if (r.skipped.length) toast(`${r.skipped.length}명은 이미 있는 학번이라 건너뛰었어요.`);
      setGrade('');
      setClassNo('');
      setCount('');
      setStartNo('1');
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

  function changeLimit(s: Student) {
    setEditTarget(s);
    setEditVal(String(s.limitValue));
  }

  async function saveLimit() {
    if (!editTarget) return;
    const n = Number(editVal);
    if (!Number.isInteger(n) || n < 1) return toast('1 이상의 정수로 적어 주세요.');
    try {
      await patchStudent(editTarget.uid, { limitValue: n });
      toast('한도를 바꿨어요.', 'success');
      setEditTarget(null);
      reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : '바꾸지 못했어요.');
    }
  }

  async function savePin() {
    setPinBusy(true);
    try {
      await setViewPin(pinVal);
      setHasPin(true);
      setPinOpen(false);
      setPinVal('');
      toast('관람 PIN을 정했어요.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '정하지 못했어요.');
    } finally {
      setPinBusy(false);
    }
  }

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

      <ClassInsights />

      <section className="mt-5 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[18px]">관람 PIN</h2>
            <p className="mt-1 text-[14px] text-muted">
              {hasPin
                ? '관람 PIN: 설정됨'
                : '관람 PIN이 아직 없어요 — 정하면 학부모가 공유 링크로 작품을 볼 수 있어요.'}
            </p>
          </div>
          <Button
            variant="soft"
            className="shrink-0"
            onClick={() => {
              setPinVal('');
              setPinOpen(true);
            }}
          >
            {hasPin ? '관람 PIN 바꾸기' : '관람 PIN 정하기'}
          </Button>
        </div>
      </section>

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

      <form onSubmit={submit} className="mt-5 flex flex-col gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="text-[18px]">학생 만들기</h2>
        <div className="flex gap-3">
          <Label text="학년 (1~6)" required>
            <TextInput inputMode="numeric" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="1" required />
          </Label>
          <Label text="반 (1~99)" required>
            <TextInput inputMode="numeric" value={classNo} onChange={(e) => setClassNo(e.target.value)} placeholder="1" required />
          </Label>
        </div>
        <div className="flex gap-3">
          <Label text="시작 번호" required>
            <TextInput inputMode="numeric" value={startNo} onChange={(e) => setStartNo(e.target.value)} placeholder="1" required />
          </Label>
          <Label text="인원수 (1~50)" required>
            <TextInput inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="20" required />
          </Label>
        </div>
        <p className="-mt-1 text-[12px] text-muted">전학생 등 이어서 추가할 땐 시작 번호를 다음 번호로 바꿔요(예: 이미 10명이면 11).</p>
        <Label text="공용 PIN (6자리 이상)" required>
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Label>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" checked={limitType === 'daily'} onChange={() => setLimitType('daily')} /> 1일 한도
          </label>
          <label className="flex items-center gap-1.5 text-[14px]">
            <input type="radio" name="ltype" checked={limitType === 'total'} onChange={() => setLimitType('total')} /> 총 한도
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
            <p className="mb-1 font-medium">만든 계정 — 학생들에게 나눠주세요</p>
            <p className="mb-1">학교 코드: <b>{createdSchool}</b> · 공용 PIN: <b>{created[0]?.password}</b></p>
            <p className="mb-1 text-[12px]">학생은 로그인에서 학교를 고르고, 자기 학번 + PIN을 넣어요.</p>
            <ul className="space-y-0.5">
              {created.map((c) => (
                <li key={c.hakbun}>학번 {c.hakbun}</li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button type="button" variant="soft" onClick={async () => {
                try { await navigator.clipboard.writeText(buildCredText(createdSchool, created)); toast('계정 목록을 복사했어요.', 'success'); }
                catch { toast('복사하지 못했어요.'); }
              }}>전체 복사</Button>
              <Button type="button" variant="ghost" onClick={() => {
                const blob = new Blob([buildCredText(createdSchool, created)], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = '우리반-계정.txt'; a.click(); URL.revokeObjectURL(url);
              }}>텍스트로 저장</Button>
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

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} label="한도 바꾸기" className="max-w-xs p-6">
        <h2 className="mb-4 text-[19px]">
          {editTarget?.name} 한도 ({editTarget?.limitType === 'total' ? '총' : '1일'} 횟수)
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveLimit();
          }}
          className="flex flex-col gap-3"
        >
          <Label text="횟수 (1 이상)" required>
            <TextInput inputMode="numeric" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus required />
          </Label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>취소</Button>
            <Button type="submit" variant="primary">저장</Button>
          </div>
        </form>
      </Modal>

      <Modal open={pinOpen} onClose={() => setPinOpen(false)} label="관람 PIN 정하기" className="max-w-xs p-6">
        <h2 className="mb-1 text-[19px]">관람 PIN</h2>
        <p className="mb-4 text-[13px] text-muted">숫자 6~8자리로 정해 주세요. 공유 링크로 작품을 볼 때 쓰여요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            savePin();
          }}
          className="flex flex-col gap-3"
        >
          <Label text="관람 PIN (숫자 6~8자리)" required>
            <TextInput
              inputMode="numeric"
              maxLength={8}
              value={pinVal}
              onChange={(e) => setPinVal(e.target.value)}
              autoFocus
              required
            />
          </Label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setPinOpen(false)}>취소</Button>
            <Button type="submit" variant="primary" disabled={pinBusy}>
              {pinBusy ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
