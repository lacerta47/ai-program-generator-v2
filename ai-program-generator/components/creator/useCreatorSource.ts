'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { EMPTY_PLAN, type Post } from '@/lib/firebase/types';
import { getPost } from '@/lib/firebase/posts';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import type { WorkSnapshot } from '@/lib/creator/workHistory';
import { takeEasyDraft } from '@/lib/creator/easyBridge';
import { buildGeneratePrompt } from './prompts';

type EditState = { id: string; title: string; authorName: string };
type ForkState = { id: string; author: string; categoryId: string };

function readPostMeta(post: Post): WorkSnapshot['meta'] {
  return { logicSummary: post.logicSummary, conceptTags: post.conceptTags, conceptNotes: post.conceptNotes };
}

/** URL의 작업 원본만 불러온다. 작업 기록과 생성 상태는 Creator에서 관리한다. */
export function useCreatorSource(applyLoaded: (snapshot: WorkSnapshot) => void) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [forkSource, setForkSource] = useState<ForkState | null>(null);
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const uid = user?.uid ?? null;
  const editId = params.get('edit');
  const forkId = params.get('fork');
  const fromEasy = params.get('from') === 'easy';
  const loadedEasyBridge = useRef(false);
  const cancelLoad = useRef<(() => void) | null>(null);
  const applyRef = useRef(applyLoaded);
  applyRef.current = applyLoaded;

  useEffect(() => {
    if (!fromEasy) {
      loadedEasyBridge.current = false;
      return;
    }
    if (authLoading || loadedEasyBridge.current) return;
    loadedEasyBridge.current = true;
    const draft = takeEasyDraft(uid);
    if (draft) {
      setEditing(null);
      setForkSource(null);
      applyRef.current(draft);
      toast('골라만들기에서 이어서 키워볼까요?');
    } else {
      toast('작품을 가져오지 못했어요. 골라서 만들기에서 다시 시도해 주세요.');
    }
    router.replace('/create');
  }, [fromEasy, authLoading, uid, router, toast]);

  useEffect(() => {
    const postId = editId ?? forkId;
    if (!postId || (editId && authLoading) || fromEasy) return;
    let active = true;
    const cancel = () => { active = false; };
    cancelLoad.current = cancel;

    getPost(postId).then((post) => {
      if (!active) return;
      if (!post) {
        toast(editId ? '고칠 작품을 찾지 못했어요.' : '이어 만들 작품을 찾지 못했어요.');
        router.replace('/create');
        return;
      }
      if (editId && !isAdmin && post.ownerUid !== uid) {
        toast('이 작품은 내 작품이 아니라서 고칠 수 없어요.');
        router.replace('/create');
        return;
      }
      const plan = post.plan ?? EMPTY_PLAN;
      setEditing(editId ? { id: post.id, title: post.title, authorName: post.authorName || '' } : null);
      setForkSource(editId ? null : { id: post.id, author: post.authorName || '익명', categoryId: post.categoryId });
      applyRef.current({
        plan,
        code: post.code,
        genPrompt: !editId && post.plan ? buildGeneratePrompt(plan) : post.prompt ?? '',
        photo: post.photo ?? null,
        meta: readPostMeta(post),
      });
    }).catch((error) => {
      if (!active) return;
      console.error('작품 불러오기 실패:', error);
      toast('작품을 불러오지 못했어요. 잠시 후 다시 해주세요.');
      router.replace('/create');
    });

    return cancel;
  }, [editId, forkId, fromEasy, authLoading, uid, isAdmin, toast, router]);

  function clearSource() {
    cancelLoad.current?.();
    if (editId || forkId) router.replace('/create');
    setEditing(null);
    setForkSource(null);
  }

  return { editing, forkSource, clearSource };
}
