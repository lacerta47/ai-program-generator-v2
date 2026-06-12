'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GeneratedCode } from '@/lib/ai/types';
import { type PlanFields, EMPTY_PLAN } from '@/lib/firebase/types';
import { getPost } from '@/lib/firebase/posts';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { buildGeneratePrompt } from './prompts';

type Loaded = { plan: PlanFields; code: GeneratedCode; genPrompt: string };
type EditState = { id: string; title: string; authorName: string };
type ForkState = { id: string; author: string; categoryId: string };

/**
 * URL 기반 소스 로딩(?edit= / ?fork=)만 담당하는 훅.
 * 불러온 plan/code/genPrompt는 applyLoaded 콜백으로 넘겨 생성기 상태에 반영한다.
 * (생성 상태 자체는 Creator가 소유 — 이 훅은 "어디서 채울지"만 안다.)
 */
export function useCreatorSource(applyLoaded: (d: Loaded) => void) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [forkSource, setForkSource] = useState<ForkState | null>(null);

  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const loadedEditId = useRef<string | null>(null);
  const loadedForkId = useRef<string | null>(null);
  const applyRef = useRef(applyLoaded);
  applyRef.current = applyLoaded;

  // ?edit=postId — 인증 확정 후 본인/관리자만 편집을 열고, 작품을 폼·결과에 복원.
  useEffect(() => {
    const editId = params.get('edit');
    if (!editId || authLoading) return; // 로그인 상태 확정 전엔 대기
    if (loadedEditId.current === editId) return; // 같은 글 중복 로드 방지
    loadedEditId.current = editId;
    getPost(editId).then((p) => {
      if (!p) {
        toast('고칠 작품을 찾지 못했어요.');
        router.replace('/');
        return;
      }
      if (!isAdmin && p.ownerUid !== user?.uid) {
        toast('이 작품은 내 작품이 아니라서 고칠 수 없어요.');
        router.replace('/');
        return;
      }
      setEditing({ id: p.id, title: p.title, authorName: p.authorName || '' });
      applyRef.current({ plan: p.plan ?? EMPTY_PLAN, code: p.code, genPrompt: p.prompt ?? '' });
    });
  }, [params, authLoading, user, isAdmin, toast, router]);

  // ?fork=postId — 원본을 "새 작품"으로 시작(편집모드 아님). 불러오기는 비로그인도 허용.
  useEffect(() => {
    const forkId = params.get('fork');
    if (!forkId) return;
    if (loadedForkId.current === forkId) return;
    loadedForkId.current = forkId;
    getPost(forkId).then((p) => {
      if (!p) {
        toast('이어 만들 작품을 찾지 못했어요.');
        router.replace('/');
        return;
      }
      const srcPlan = p.plan ?? EMPTY_PLAN;
      applyRef.current({
        plan: srcPlan,
        code: p.code,
        genPrompt: p.plan ? buildGeneratePrompt(srcPlan) : p.prompt ?? '',
      });
      setForkSource({ id: p.id, author: p.authorName || '익명', categoryId: p.categoryId });
    });
  }, [params, toast, router]);

  // 새로 만들기 시 소스 모드 해제 — 상태·가드 초기화 + URL 정리.
  function clearSource() {
    if (editing || forkSource) router.replace('/');
    setEditing(null);
    loadedEditId.current = null;
    setForkSource(null);
    loadedForkId.current = null;
  }

  return { editing, forkSource, clearSource };
}
