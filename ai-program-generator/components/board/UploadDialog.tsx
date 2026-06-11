'use client';

import { useEffect, useState } from 'react';
import { PartyPopper, X } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { createPost } from '@/lib/firebase/posts';
import type { Category } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TextInput, Select, Label } from '@/components/ui/Field';

interface Props {
  open: boolean;
  onClose: () => void;
  code: GeneratedCode;
  prompt: string;
  defaultTitle: string;
}

export default function UploadDialog({ open, onClose, code, prompt, defaultTitle }: Props) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState(defaultTitle);
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) return subscribeCategories(setCategories);
  }, [open]);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [defaultTitle, open]);

  useEffect(() => {
    if (categories.length && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError('로그인이 필요해요.');
      return;
    }
    if (!categoryId) {
      setError('게시판을 골라 주세요.');
      return;
    }
    if (!title.trim()) {
      setError('제목을 적어 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createPost({
        title: title.trim(),
        categoryId,
        ownerUid: user.uid,
        code,
        prompt,
        createdAt: Date.now(),
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : '올리다가 문제가 생겼어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="게시판에 올리기" className="max-w-sm p-6">
        {done ? (
          <div className="anim-pop flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-mint-soft text-mint-ink">
              <PartyPopper size={30} aria-hidden />
            </span>
            <p className="text-[19px]">게시판에 올라갔어요!</p>
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
