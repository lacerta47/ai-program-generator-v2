'use client';

import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import { LogIn, LogOut, Crown, Pencil } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { getUserProfile, claimNickname, NicknameError, NICKNAME_COOLDOWN_DAYS } from '@/lib/firebase/users';
import { useAuth } from './AuthProvider';
import LoginDialog from './LoginDialog';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TextInput, Label } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

export default function AuthButton() {
  const { user, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) getUserProfile(user.uid).then((p) => setNickname(p?.nickname ?? null));
    else setNickname(null);
  }, [user]);

  async function saveNick(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !draft.trim()) return;
    setBusy(true);
    try {
      await claimNickname(user.uid, draft);
      setNickname(draft.trim());
      setEditOpen(false);
      toast('별명을 바꿨어요!', 'success');
    } catch (err) {
      if (err instanceof NicknameError && err.reason === 'taken') {
        toast('이미 누가 쓰는 별명이에요. 다른 별명으로 해볼까요?');
      } else if (err instanceof NicknameError && err.reason === 'profanity') {
        toast('그 별명은 쓸 수 없어요. 예쁜 말로 바꿔 볼까요?');
      } else if (err instanceof NicknameError && err.reason === 'cooldown') {
        toast(`별명은 ${NICKNAME_COOLDOWN_DAYS}일에 한 번만 바꿀 수 있어요. ${err.daysLeft}일 뒤에 다시 해주세요.`);
      } else {
        toast('별명을 바꾸지 못했어요. 잠시 후 다시 해주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-11 w-20 animate-pulse rounded-full bg-surface-2" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sunshine-soft px-3 py-1.5 text-[13px] font-medium text-sunshine-ink">
            <Crown size={14} aria-hidden /> 관리자
          </span>
        )}
        <button
          onClick={() => {
            setDraft(nickname ?? '');
            setEditOpen(true);
          }}
          title="별명 바꾸기"
          className="press hidden items-center gap-1 rounded-full border-2 border-line px-3 py-1.5 text-[14px] text-ink hover:border-brand/50 sm:inline-flex"
        >
          {nickname ?? '별명 정하기'}
          <Pencil size={13} className="text-muted" aria-hidden />
        </button>
        <Button variant="ghost" size="icon" onClick={() => signOut(auth)} aria-label="로그아웃" title="로그아웃" className="rounded-full">
          <LogOut size={18} />
        </Button>

        <Modal open={editOpen} onClose={() => setEditOpen(false)} label="별명 바꾸기" className="max-w-xs p-6">
          <h2 className="mb-4 text-[20px]">별명 바꾸기</h2>
          <form onSubmit={saveNick} className="flex flex-col gap-3">
            <Label text="새 별명 (게시판에 보여요)" required>
              <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={20} placeholder="예: 코딩왕" autoFocus />
            </Label>
            <p className="text-[13px] text-muted">
              별명은 {NICKNAME_COOLDOWN_DAYS}일에 한 번만 바꿀 수 있어요. 이미 올린 작품의 별명은 그대로고, 다음 작품부터 새 별명으로 보여요.
            </p>
            <div className="mt-1 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>취소</Button>
              <Button type="submit" variant="primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="min-h-11 rounded-full px-4 text-[15px]">
        <LogIn size={17} aria-hidden /> 로그인
      </Button>
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
