'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Download, Link2, Check, Trash2, Heart, Eye, GitFork, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { deleteMyAccount } from '@/lib/client/account';
import { auth } from '@/lib/firebase/client';
import { fetchMyPosts, deletePost, type PostCursor } from '@/lib/firebase/posts';
import {
  getUserProfile,
  claimNickname,
  NicknameError,
  NICKNAME_COOLDOWN_DAYS,
} from '@/lib/firebase/users';
import { sharePostUrl, downloadProgram } from '@/lib/client/postActions';
import { formatDate } from '@/lib/program';
import type { Post } from '@/lib/firebase/types';
import Header from '@/components/common/Header';
import Button from '@/components/ui/Button';
import { TextInput, Label } from '@/components/ui/Field';
import Modal from '@/components/ui/Modal';
import LoadingDots from '@/components/ui/LoadingDots';

interface Usage {
  used: number;
  limit: number | null;
  unlimited: boolean;
  kind?: 'daily' | 'total';
}

/** 본인 토큰으로 /api/me/usage 호출. */
async function fetchMyUsage(): Promise<Usage> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요해요.');
  const idToken = await u.getIdToken();
  const res = await fetch('/api/me/usage', { headers: { Authorization: `Bearer ${idToken}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as Usage;
}

export default function MyPage() {
  const { user, loading, isAdmin, isTeacher, isStudent } = useAuth();
  const router = useRouter();

  // 로그아웃(또는 비로그인) 시 조용히 메인으로 — 안내 토스트는 띄우지 않음(로그아웃 시 거슬림).
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/');
  }, [loading, user, router]);

  return (
    <main className="min-h-screen">
      <Header />
      {loading || !user ? (
        <div className="py-16">
          <LoadingDots label="확인 중…" />
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
          <AccountCard uid={user.uid} email={user.email} createdAt={user.metadata?.creationTime} isAdmin={isAdmin} isTeacher={isTeacher} isStudent={isStudent} />
          <MyWorks uid={user.uid} />
        </div>
      )}
    </main>
  );
}

function AccountCard({
  uid,
  email,
  createdAt,
  isAdmin,
  isTeacher,
  isStudent,
}: {
  uid: string;
  email: string | null;
  createdAt?: string;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const confirm = useConfirm();
  const [withdrawing, setWithdrawing] = useState(false);

  async function withdraw() {
    const ok = await confirm({
      title: '정말 탈퇴할까요?',
      message: '계정과 만든 작품이 모두 영구 삭제돼요. 되돌릴 수 없어요.',
      confirmLabel: '탈퇴',
      danger: true,
    });
    if (!ok) return;
    setWithdrawing(true);
    try {
      await deleteMyAccount();
      await signOut(auth);
      toast('탈퇴가 완료됐어요. 그동안 고마웠어요.', 'success');
      router.replace('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : '계정을 삭제하지 못했어요.');
      setWithdrawing(false);
    }
  }

  const [nickname, setNickname] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  // 이메일 인증 상태(Google은 자동 true). 미인증이면 안내 + 재발송/확인.
  const [verified, setVerified] = useState(true);
  const [vBusy, setVBusy] = useState(false);

  useEffect(() => {
    setVerified(auth.currentUser?.emailVerified ?? true);
  }, [uid]);

  async function resendVerification() {
    if (!auth.currentUser) return;
    setVBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast('인증 메일을 다시 보냈어요. 메일함을 확인해 주세요.', 'success');
    } catch {
      toast('잠시 후 다시 시도해 주세요.');
    } finally {
      setVBusy(false);
    }
  }

  async function recheckVerification() {
    if (!auth.currentUser) return;
    setVBusy(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true); // 서버가 볼 토큰도 갱신
      const ok = auth.currentUser.emailVerified;
      setVerified(ok);
      toast(ok ? '이메일 인증이 확인됐어요!' : '아직 인증 전이에요. 메일 링크를 눌러 주세요.', ok ? 'success' : undefined);
    } finally {
      setVBusy(false);
    }
  }

  useEffect(() => {
    let alive = true;
    getUserProfile(uid)
      .then((p) => {
        if (alive) setNickname(p?.nickname ?? null);
      })
      .catch((e) => console.error('프로필 조회 실패:', e));
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    let alive = true;
    setUsageError(false);
    fetchMyUsage()
      .then((u) => {
        if (alive) setUsage(u);
      })
      .catch((e) => {
        console.error('사용량 조회 실패:', e);
        if (alive) setUsageError(true);
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  async function saveNick(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await claimNickname(uid, draft);
      setNickname(draft.trim());
      setEditOpen(false);
      toast('별명을 바꿨어요!', 'success');
    } catch (err) {
      if (err instanceof NicknameError && err.reason === 'taken') {
        toast('이미 누가 쓰는 별명이에요. 다른 별명으로 해볼까요?');
      } else if (err instanceof NicknameError && err.reason === 'profanity') {
        toast('그 별명은 쓸 수 없어요. 예쁜 말로 바꿔 볼까요?');
      } else if (err instanceof NicknameError && err.reason === 'reserved') {
        toast("그 별명은 쓸 수 없어요. '관리자' 같은 말은 넣을 수 없어요.");
      } else if (err instanceof NicknameError && err.reason === 'cooldown') {
        toast(`별명은 ${NICKNAME_COOLDOWN_DAYS}일에 한 번만 바꿀 수 있어요. ${err.daysLeft}일 뒤에 다시 해주세요.`);
      } else {
        toast('별명을 바꾸지 못했어요. 잠시 후 다시 해주세요.');
      }
    } finally {
      setBusy(false);
    }
  }

  const usageText = usageError
    ? '—'
    : usage
      ? usage.unlimited
        ? '무제한'
        : `${usage.used}/${usage.limit}`
      : '…';

  return (
    <section className="rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[24px]">{nickname ?? '별명을 정해 주세요'}</h1>
          {email && <p className="truncate text-[13px] text-muted">{email}</p>}
        </div>
        <Button
          variant="soft"
          onClick={() => {
            setDraft(nickname ?? '');
            setEditOpen(true);
          }}
        >
          <Pencil size={15} aria-hidden /> 별명 바꾸기
        </Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
        <span className="text-muted">
          가입일 <span className="text-ink">{createdAt ? formatDate(new Date(createdAt).getTime()) : '—'}</span>
        </span>
        <span className="text-muted">
          {usage?.kind === 'total' ? '사용' : '오늘 사용'} <span className="text-ink">{usageText}</span>
        </span>
      </div>

      {!verified && !isTeacher && !isStudent && (
        <div className="anim-pop-in mt-4 rounded-[var(--r-md)] border-2 border-coral/40 bg-coral-soft p-4">
          <p className="text-[15px] text-coral-ink">
            이메일 인증이 필요해요. 인증해야 <strong>프로그램 만들기·게시판 올리기</strong>를 쓸 수 있어요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={resendVerification} disabled={vBusy}>
              인증 메일 다시 보내기
            </Button>
            <Button variant="ghost" onClick={recheckVerification} disabled={vBusy}>
              인증했어요(새로고침)
            </Button>
          </div>
        </div>
      )}

      {!isAdmin && !isTeacher && !isStudent && (
        <div className="mt-5 border-t border-line pt-4 text-right">
          <button
            type="button"
            onClick={withdraw}
            disabled={withdrawing}
            className="text-[13px] text-muted underline-offset-4 hover:text-coral-ink hover:underline disabled:opacity-50"
          >
            {withdrawing ? '탈퇴 처리 중…' : '회원 탈퇴'}
          </button>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} label="별명 바꾸기" className="max-w-xs p-6">
        <h2 className="mb-4 text-[20px]">별명 바꾸기</h2>
        <form onSubmit={saveNick} className="flex flex-col gap-3">
          <Label text="새 별명 (게시판에 보여요)" required>
            <TextInput
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20}
              placeholder="예: 코딩왕"
              autoFocus
            />
          </Label>
          <p className="text-[13px] text-muted">
            별명은 {NICKNAME_COOLDOWN_DAYS}일에 한 번만 바꿀 수 있어요. 이미 올린 작품의 별명은 그대로고, 다음 작품부터 새 별명으로 보여요.
          </p>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function MyWorks({ uid }: { uid: string }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 커서 기반 페이지(이전/다음). startsRef[i] = i페이지를 가져올 시작 커서(0페이지는 undefined).
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const startsRef = useRef<(PostCursor | undefined)[]>([undefined]);

  // uid 바뀌면 1페이지로 리셋
  useEffect(() => {
    startsRef.current = [undefined];
    setPage(0);
  }, [uid]);

  useEffect(() => {
    let alive = true;
    setError(false);
    setPosts(null);
    fetchMyPosts(uid, startsRef.current[page])
      .then((res) => {
        if (!alive) return;
        setPosts(res.posts);
        setHasMore(res.hasMore);
        startsRef.current[page + 1] = res.cursor ?? undefined; // 다음 페이지 시작 커서 기록
      })
      .catch((e) => {
        console.error('내 작품 불러오기 실패:', e);
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [uid, page, reloadKey]);

  async function handleDelete(post: Post) {
    if (!(await confirm({ title: '작품을 삭제할까요?', message: `'${post.title}' 작품을 삭제해요. 되돌릴 수 없어요.`, confirmLabel: '삭제', danger: true }))) return;
    try {
      await deletePost(post.id);
      toast('작품을 삭제했어요.', 'success');
      // 삭제로 페이지 경계가 밀리므로 이후 페이지의 시작 커서는 stale → 폐기하고 재조회가 다시 채우게 한다.
      // 현재 페이지의 마지막 1건이었고 첫 페이지가 아니면 이전 페이지로(그 시작 커서는 유효).
      if ((posts?.length ?? 0) <= 1 && page > 0) {
        startsRef.current = startsRef.current.slice(0, page); // 이전 페이지까지의 커서만 유지
        setPage((p) => Math.max(0, p - 1));
      } else {
        startsRef.current = startsRef.current.slice(0, page + 1); // 현재 페이지 이후 커서 폐기
        setReloadKey((k) => k + 1);
      }
    } catch (e) {
      console.error('작품 삭제 실패:', e);
      toast('삭제하지 못했어요. 잠시 후 다시 해주세요.');
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-[20px]">내 작품</h2>
      {error ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[15px] text-muted">작품을 불러오지 못했어요.</p>
          <Button variant="soft" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </Button>
        </div>
      ) : posts === null ? (
        <div className="py-10">
          <LoadingDots label="불러오는 중…" />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[var(--r-lg)] border-2 border-dashed border-line py-10 text-center">
          <Sparkles size={28} className="text-brand" aria-hidden />
          <p className="text-[15px] text-muted">
            아직 만든 작품이 없어요.
            <br />첫 작품을 만들어 볼까요?
          </p>
          <Link href="/create" className="press rounded-full bg-brand px-4 py-2 text-[14px] text-white">
            만들러 가기
          </Link>
        </div>
      ) : (
        <>
        <div className="grid gap-3 sm:grid-cols-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="anim-pop-in flex flex-col gap-2 rounded-[var(--r-lg)] border-2 border-line bg-surface p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate text-[17px]" title={post.title}>
                  {post.title}
                </h3>
                <p className="text-[12px] text-muted">{formatDate(post.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3 text-[13px] text-muted">
                {(post.likeCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Heart size={13} aria-hidden /> {post.likeCount}
                  </span>
                )}
                {(post.viewCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Eye size={13} aria-hidden /> {post.viewCount}
                  </span>
                )}
                {(post.forkCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <GitFork size={13} aria-hidden /> {post.forkCount}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap justify-end gap-1.5">
                <Link
                  href={`/create?edit=${post.id}`}
                  className="press inline-flex items-center gap-1 rounded-full border-2 border-line px-2.5 py-1 text-[13px] hover:border-brand/50"
                >
                  <Pencil size={14} aria-hidden /> 고치기
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    sharePostUrl(post, toast, () => {
                      setCopiedId(post.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    })
                  }
                  aria-label="공유"
                  title="공유"
                  className="rounded-full"
                >
                  {copiedId === post.id ? (
                    <Check size={16} className="text-mint-ink" aria-hidden />
                  ) : (
                    <Link2 size={16} aria-hidden />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => downloadProgram(post.code, post.title, toast)}
                  aria-label="다운로드"
                  title="다운로드"
                  className="rounded-full"
                >
                  <Download size={16} aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(post)}
                  aria-label="삭제"
                  title="삭제"
                  className="rounded-full text-coral-ink"
                >
                  <Trash2 size={16} aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {(page > 0 || hasMore) && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              이전
            </Button>
            <span className="text-[14px] text-muted">{page + 1} 페이지</span>
            <Button variant="ghost" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
              다음
            </Button>
          </div>
        )}
        </>
      )}
    </section>
  );
}
