'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { fetchPosts, getPost, deletePost, type PostCursor } from '@/lib/firebase/posts';
import { downloadProgramZip } from '@/lib/client/downloadZip';
import type { Category, Post } from '@/lib/firebase/types';
import { CloudOff, RotateCcw } from 'lucide-react';
import CategoryBar from './CategoryBar';
import PostList from './PostList';
import PostPreview from './PostPreview';
import LoadingDots from '@/components/ui/LoadingDots';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export default function BoardView() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useSearchParams();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    params.get('category'),
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const cursorRef = useRef<PostCursor>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loadError, setLoadError] = useState(false);
  // 공유 링크 ?post= 의 카테고리가 정해지기 전에는 "첫 카테고리 자동선택"을 보류
  // (categoryId 없이 들어온 딥링크가 엉뚱한 카테고리 목록을 띄우는 레이스 방지)
  const [deepLinkResolving, setDeepLinkResolving] = useState(
    Boolean(params.get('post') && !params.get('category')),
  );

  // 카테고리 실시간 구독
  useEffect(
    () =>
      subscribeCategories(setCategories, (e) => {
        console.error('카테고리 구독 실패:', e);
        setLoadError(true);
      }),
    [],
  );

  // 선택된 카테고리가 없으면 첫 번째로 (딥링크 글 해결 중이면 대기)
  useEffect(() => {
    if (!selectedCategoryId && !deepLinkResolving && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId, deepLinkResolving]);

  // 공유 링크(?post=)로 진입한 경우 해당 게시물 로드
  useEffect(() => {
    const postId = params.get('post');
    if (!postId) return;
    getPost(postId)
      .then((p) => {
        if (p) {
          setSelectedPost(p);
          setSelectedCategoryId((prev) => prev ?? p.categoryId);
        }
      })
      .finally(() => setDeepLinkResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFirst = useCallback(async (categoryId: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const page = await fetchPosts(categoryId);
      setPosts(page.posts);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      console.error('게시물 로드 실패:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 카테고리 변경 시 첫 페이지 로드
  useEffect(() => {
    if (selectedCategoryId) loadFirst(selectedCategoryId);
  }, [selectedCategoryId, loadFirst]);

  async function loadMore() {
    if (!selectedCategoryId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPosts(selectedCategoryId, cursorRef.current);
      setPosts((prev) => [...prev, ...page.posts]);
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
    } catch (e) {
      console.error('추가 로드 실패:', e);
      setHasMore(false); // 무한 재시도 방지
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
    setSelectedPost(null);
    router.replace(`/board?category=${id}`, { scroll: false });
  }

  function selectPost(post: Post) {
    setSelectedPost(post);
    router.replace(`/board?category=${post.categoryId}&post=${post.id}`, { scroll: false });
  }

  async function handleDelete(post: Post) {
    if (!confirm(`'${post.title}' 게시물을 삭제할까요?`)) return;
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (selectedPost?.id === post.id) setSelectedPost(null);
    } catch (e) {
      console.error('게시물 삭제 실패:', e);
      toast('삭제하지 못했어요. 인터넷 연결이나 권한을 확인해 주세요.');
    }
  }

  function handleTitleSaved(id: string, title: string) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, title } : p)));
    setSelectedPost((prev) => (prev?.id === id ? { ...prev, title } : prev));
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(320px,2fr)_3fr]">
      {/* 왼쪽: 카테고리 + 목록 */}
      <section className="anim-pop-in flex max-h-[80vh] flex-col gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5">
        <h2 className="text-[21px]">친구들의 작품</h2>
        <CategoryBar
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={selectCategory}
          isAdmin={isAdmin}
        />
        <div className="min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="py-8">
              <LoadingDots label="작품을 불러오는 중…" />
            </div>
          ) : loadError ? (
            <div className="anim-pop-in flex flex-col items-center gap-3 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-coral-soft text-coral-ink">
                <CloudOff size={26} aria-hidden />
              </span>
              <p className="text-[15px] text-muted">
                작품을 불러오지 못했어요.
                <br />
                인터넷 연결을 확인하고 다시 해볼까요?
              </p>
              <Button
                variant="soft"
                onClick={() => selectedCategoryId && loadFirst(selectedCategoryId)}
              >
                <RotateCcw size={16} aria-hidden /> 다시 시도
              </Button>
            </div>
          ) : (
            <PostList
              posts={posts}
              selectedPostId={selectedPost?.id ?? null}
              onSelect={selectPost}
              currentUserUid={user?.uid ?? null}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onDownload={(p) => downloadProgramZip(p.code, p.title)}
              onTitleSaved={handleTitleSaved}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          )}
        </div>
      </section>

      {/* 오른쪽: 미리보기 */}
      <section
        className="anim-pop-in flex min-h-[62vh] flex-col rounded-[var(--r-lg)] border-2 border-line bg-surface p-5"
        style={{ animationDelay: '60ms' }}
      >
        <PostPreview post={selectedPost} />
      </section>
    </div>
  );
}
