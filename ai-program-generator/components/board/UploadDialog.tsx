'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper, LayoutGrid, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { leafPaths } from '@/lib/board/categoryTree';
import { getMyBoard } from '@/lib/student/board';
import { createPost, incrementForkCount } from '@/lib/firebase/posts';
import { getUserProfile, claimNickname, NicknameError } from '@/lib/firebase/users';
import { ProfanityError } from '@/lib/moderation';
import type { Category, PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';
import { playSuccess } from '@/lib/client/sound';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TextInput, Select, Label } from '@/components/ui/Field';

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
  /** 교실 한정 사진(data URI) — 교사보드 게시 시에만 저장(규칙이 공개보드 photo 거부). */
  photo?: string;
}

export default function UploadDialog({ open, onClose, code, plan, prompt, defaultTitle, forkedFrom, forkedFromAuthor, defaultCategoryId, photo }: Props) {
  const { user, isTeacher, isStudent } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  // 업로드 피커엔 공개 게시판만 노출(교사보드는 그 반만 쓰기 가능 — 규칙과 일치). 공개 탐색은 별개로 유지.
  const publicCategories = useMemo(() => categories.filter((c) => !c.teacherUid), [categories]);
  const [title, setTitle] = useState(defaultTitle);
  const [nickname, setNickname] = useState(''); // 최초 설정용 입력값
  const [savedNickname, setSavedNickname] = useState<string | null>(null); // 이미 정한 별명(읽기전용 표시)
  const [categoryId, setCategoryId] = useState('');
  const [studentBoard, setStudentBoard] = useState<{ boardId: string; boardName: string } | null>(null);
  const [slowBoard, setSlowBoard] = useState(false); // 게시판 조회가 오래 걸릴 때 안내용
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ postId: string; categoryId: string } | null>(null);

  useEffect(() => {
    if (open) return subscribeCategories(setCategories);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDone(null);
      setError('');
      setCategoryId(''); // 비우면 아래 derive 효과가 fork 원본/첫 카테고리로 재선택
      setNickname('');
    }
  }, [defaultTitle, open]);

  useEffect(() => {
    if (!open || !isStudent) return;
    let cancelled = false;
    setStudentBoard(null);
    setSlowBoard(false);
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowBoard(true);
    }, 4000);
    getMyBoard()
      .then((b) => {
        if (cancelled) return;
        setStudentBoard(b);
        setCategoryId(b.boardId);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('학생 게시판 조회 실패:', e);
        setError('지금은 올릴 수 없어요. 잠시 후 다시 해주세요.');
      })
      .finally(() => {
        clearTimeout(slowTimer);
      });
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
    };
  }, [open, isStudent]);

  // 이미 정한 별명이 있으면 그대로 사용(읽기전용). 없으면 최초 입력받음.
  useEffect(() => {
    if (open && user) {
      getUserProfile(user.uid).then((p) => setSavedNickname(p?.nickname ?? null));
    }
  }, [open, user]);

  useEffect(() => {
    if (isStudent) return;
    if (!publicCategories.length || categoryId) return;
    const leaves = leafPaths(publicCategories);
    const preferred =
      defaultCategoryId && leaves.some((l) => l.id === defaultCategoryId)
        ? defaultCategoryId
        : leaves[0]?.id ?? '';
    setCategoryId(preferred);
  }, [publicCategories, categoryId, defaultCategoryId, isStudent]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return setError('로그인이 필요해요.');
    if (!user.emailVerified && !isTeacher && !isStudent) return setError('이메일 인증 후 올릴 수 있어요. 마이페이지에서 인증 메일을 받아 주세요.');
    const name = (savedNickname ?? nickname).trim();
    if (!name) return setError('별명을 적어 주세요.');
    if (!categoryId) return setError(isStudent ? '우리 반 게시판을 불러오는 중이에요. 잠시 후 다시 해주세요.' : '게시판을 골라 주세요.');
    if (!title.trim()) return setError('제목을 적어 주세요.');

    setBusy(true);
    setError('');
    try {
      // 별명이 처음이면 점유(유일성 검사). 이미 있으면 그대로 사용.
      if (!savedNickname) {
        try {
          await claimNickname(user.uid, name);
        } catch (err) {
          if (err instanceof NicknameError && err.reason === 'taken') {
            setError('이미 누가 쓰는 별명이에요. 다른 별명으로 해볼까요?');
          } else if (err instanceof NicknameError && err.reason === 'profanity') {
            setError('그 별명은 쓸 수 없어요. 예쁜 말로 바꿔 볼까요?');
          } else if (err instanceof NicknameError && err.reason === 'reserved') {
            setError("그 별명은 쓸 수 없어요. '관리자' 같은 말은 넣을 수 없어요.");
          } else {
            setError('별명을 정하지 못했어요. 잠시 후 다시 해주세요.');
          }
          setBusy(false);
          return;
        }
      }
      const selectedCat = categories.find((c) => c.id === categoryId);
      const boardTeacherUid = selectedCat?.teacherUid ?? null;
      const postId = await createPost({
        title: title.trim(),
        categoryId,
        boardTeacherUid,
        ownerUid: user.uid,
        authorName: name,
        code,
        plan,
        prompt,
        createdAt: Date.now(),
        ...(forkedFrom ? { forkedFrom, forkedFromAuthor: forkedFromAuthor ?? '익명' } : {}),
        ...(photo && boardTeacherUid ? { photo } : {}),
      });
      if (forkedFrom) {
        incrementForkCount(forkedFrom).catch((e) => console.error('forkCount 증가 실패:', e));
      }
      playSuccess();
      setDone({ postId, categoryId });
    } catch (err) {
      if (err instanceof ProfanityError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '올리다가 문제가 생겼어요.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="게시판에 올리기" className="max-w-sm p-6">
      {done ? (
        <div className="anim-pop flex flex-col items-center gap-4 py-4 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-mint-soft text-mint-ink">
            <PartyPopper size={30} aria-hidden />
          </span>
          <p className="anim-pop-tada text-[19px]">게시판에 올라갔어요!</p>
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                router.push(`/board?category=${done.categoryId}&post=${done.postId}`);
              }}
              className="w-full"
            >
              <LayoutGrid size={17} aria-hidden /> 게시판에서 보기
            </Button>
            <Button variant="ghost" onClick={onClose} className="w-full">
              계속 만들기
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-[21px]">작품 올리기</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="닫기" className="h-10 w-10 rounded-full border-0">
              <X size={20} />
            </Button>
          </div>

          {!isStudent && leafPaths(publicCategories).length === 0 ? (
            <p className="text-[15px] text-muted">
              아직 작품을 올릴 게시판(반)이 없어요. 관리자 선생님이 먼저 만들어야 해요.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              {savedNickname ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-medium text-muted">별명 (게시판에 보여요)</span>
                  <div className="flex items-center gap-2 rounded-[var(--r-md)] bg-surface-2 px-4 py-2.5">
                    <span className="font-medium text-ink">{savedNickname}</span>
                    <span className="text-[12.5px] text-muted">· 바꾸려면 우측 위 별명을 눌러요</span>
                  </div>
                </div>
              ) : (
                <Label text="별명 (게시판에 보여요)" required>
                  <TextInput
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="예: 코딩왕"
                    maxLength={20}
                    required
                  />
                  <span className="mt-1 block text-[12.5px] text-muted">한 번 정하면 15일에 한 번만 바꿀 수 있어요.</span>
                </Label>
              )}
              <Label text="작품 제목" required>
                <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} required />
              </Label>
              {isStudent ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[15px] font-medium text-muted">게시판</span>
                  <div className="rounded-[var(--r-md)] bg-surface-2 px-4 py-2.5 text-[14px] text-ink">
                    {studentBoard ? `우리 반 게시판 「${studentBoard.boardName}」에 올라가요` : '우리 반 게시판을 확인하는 중…'}
                  </div>
                  {!studentBoard && slowBoard && !error && (
                    <p className="text-[12.5px] text-muted">
                      게시판을 불러오는 데 시간이 조금 걸려요. 새로고침을 해보세요.
                    </p>
                  )}
                </div>
              ) : (
                <Label text="어느 게시판에 올릴까요?">
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    {leafPaths(publicCategories).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.path}
                      </option>
                    ))}
                  </Select>
                </Label>
              )}
              {error && (
                <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={busy || (isStudent && !studentBoard)} className="w-full">
                {busy ? '올리는 중…' : isStudent && !studentBoard ? '게시판 확인 중…' : '올리기'}
              </Button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
