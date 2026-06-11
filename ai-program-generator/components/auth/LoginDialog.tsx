'use client';

import { useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { X, Sparkles } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/Field';

function toMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': '이메일 모양이 이상해요. 다시 확인해 주세요.',
    'auth/invalid-credential': '이메일이나 비밀번호가 맞지 않아요.',
    'auth/wrong-password': '비밀번호가 맞지 않아요.',
    'auth/user-not-found': '아직 가입하지 않은 이메일이에요.',
    'auth/email-already-in-use': '이미 가입된 이메일이에요. 로그인해 보세요.',
    'auth/weak-password': '비밀번호는 6글자 이상으로 만들어 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔어요. 다시 시도해 주세요.',
  };
  return map[code] || (e instanceof Error ? e.message : '로그인이 안 됐어요. 다시 해볼까요?');
}

export default function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function withGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      onClose();
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        await createUserWithEmailAndPassword(auth, email, pw);
      }
      onClose();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="로그인" className="max-w-[380px] p-7">
        <button
          onClick={onClose}
          aria-label="닫기"
          className="press absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X size={20} />
        </button>

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-brand-soft text-brand-strong dark:text-brand">
            <Sparkles size={26} aria-hidden />
          </span>
          <div>
            <h2 className="text-[24px]">{mode === 'login' ? '어서 오세요!' : '반가워요!'}</h2>
            <p className="mt-1 text-[14px] text-muted">
              로그인하면 내 작품을
              <br />
              게시판에 올릴 수 있어요
            </p>
          </div>
        </div>

        <Button variant="ghost" onClick={withGoogle} disabled={busy} className="w-full">
          <GoogleMark /> Google로 계속하기
        </Button>

        <div className="my-5 flex items-center gap-3 text-[13px] text-muted">
          <span className="h-0.5 flex-1 rounded bg-line" /> 또는 이메일로{' '}
          <span className="h-0.5 flex-1 rounded bg-line" />
        </div>

        <form onSubmit={withEmail} className="flex flex-col gap-3">
          <TextInput
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            autoComplete="email"
          />
          <TextInput
            type="password"
            required
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호 (6글자 이상)"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error && (
            <p className="anim-pop-in rounded-[var(--r-md)] bg-coral-soft px-3.5 py-2.5 text-[14px] text-coral-ink">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? '잠깐만요…' : mode === 'login' ? '로그인' : '가입하기'}
          </Button>
        </form>

        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="text-[14px] text-brand-strong underline-offset-4 hover:underline dark:text-brand"
          >
            {mode === 'login' ? '처음이에요? 가입하기' : '계정이 있어요? 로그인하기'}
          </button>
        </div>
    </Modal>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C16.9 1 14.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
    </svg>
  );
}
