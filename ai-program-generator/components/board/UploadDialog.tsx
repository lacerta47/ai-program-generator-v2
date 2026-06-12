'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper, LayoutGrid, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { createPost } from '@/lib/firebase/posts';
import { getUserProfile, claimNickname, NicknameError } from '@/lib/firebase/users';
import { ProfanityError } from '@/lib/moderation';
import type { Category, PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';
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
}

export default function UploadDialog({ open, onClose, code, plan, prompt, defaultTitle, forkedFrom, forkedFromAuthor, defaultCategoryId }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(defaultTitle);
  const [nickname, setNickname] = useState(''); // 최초 설정용 입력값
  const [savedNickname, setSavedNickname] = useState<string | null>(null); // 이미 정한 별명(읽기전용 표시)
  const [categoryId, setCategoryId] = useState('');
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
    }
  }, [defaultTitle, open]);

  // 이미 정한 별명이 있으면 그대로 사용(읽기전용). 없으면 최초 입력받음.
  useEffect(() => {
    if (open && user) {
      getUserProfile(user.uid).then((p) => setSavedNickname(p?.nickname ?? null));
    }
  }, [open, user]);

  useEffect(() => {
    if (!categories.length || categoryId) return;
    // fork면 원본 카테고리를 기본 선택, 아니면 첫 카테고리
    const preferred =
      defaultCategoryId && categories.some((c) => c.id === defaultCategoryId)
        ? defaultCategoryId
        : categories[0].id;
    setCategoryId(preferred);
  }, [categories, categoryId, defaultCategoryId]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return setError('로그인이 필요해요.');
    const name = (savedNickname ?? nickname).trim();
    if (!name) return setError('별명을 적어 주세요.');
    if (!categoryId) return setError('게시판을 골라 주세요.');
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
          } else {
            setError('별명을 정하지 못했어요. 잠시 후 다시 해주세요.');
          }
          setBusy(false);
          return;
        }
      }
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
      setDone({ postId, categoryId });
    } catch (err) {
      if (err instanceof ProfanityError) {
        setError('제목에 쓸 수 없는 말이 있어요. 고운 말로 바꿔 주세요.');
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
          <p className="text-[19px]">게시판에 올라갔어요!</p>
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

          {categories.length === 0 ? (
            <p className="text-[15px] text-muted">
              아직 게시판이 없어요. 관리자 선생님이 게시판을 먼저 만들어야 해요.
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
              <Label text="어느 게시판에 올릴까요?">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Label>
              {error && (
                <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={busy} className="w-full">
                {busy ? '올리는 중…' : '올리기'}
              </Button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
