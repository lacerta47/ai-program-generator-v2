'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper, LayoutGrid, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { createPost } from '@/lib/firebase/posts';
import { getUserProfile, saveNickname } from '@/lib/firebase/users';
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
}

export default function UploadDialog({ open, onClose, code, plan, prompt, defaultTitle }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(defaultTitle);
  const [nickname, setNickname] = useState('');
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

  // 저장된 닉네임 불러와 미리 채우기(한 번 입력하면 다음부터 자동)
  useEffect(() => {
    if (open && user) {
      getUserProfile(user.uid).then((p) => {
        if (p?.nickname) setNickname(p.nickname);
      });
    }
  }, [open, user]);

  useEffect(() => {
    if (categories.length && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return setError('로그인이 필요해요.');
    if (!nickname.trim()) return setError('별명을 적어 주세요.');
    if (!categoryId) return setError('게시판을 골라 주세요.');
    if (!title.trim()) return setError('제목을 적어 주세요.');

    setBusy(true);
    setError('');
    try {
      const name = nickname.trim();
      await saveNickname(user.uid, name); // 다음 업로드 때 재사용되도록 프로필에 기억
      const postId = await createPost({
        title: title.trim(),
        categoryId,
        ownerUid: user.uid,
        authorName: name,
        code,
        plan,
        prompt,
        createdAt: Date.now(),
      });
      setDone({ postId, categoryId });
    } catch (err) {
      setError(err instanceof Error ? err.message : '올리다가 문제가 생겼어요.');
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
              <Label text="별명 (게시판에 보여요)" required>
                <TextInput
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="예: 코딩왕"
                  maxLength={20}
                  required
                />
              </Label>
              <Label text="작품 제목" required>
                <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required />
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
