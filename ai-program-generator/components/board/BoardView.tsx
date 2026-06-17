'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeCategories } from '@/lib/firebase/categories';
import { fetchPosts, getPost, deletePost, type PostCursor } from '@/lib/firebase/posts';
import { downloadProgram } from '@/lib/client/postActions';
import type { Category, Post } from '@/lib/firebase/types';
import { CloudOff, RotateCcw, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import CategoryTree from './CategoryTree';
import { leafPaths, hasChildren } from '@/lib/board/categoryTree';
import PostList from './PostList';
import PostPreview from './PostPreview';
import LoginDialog from '@/components/auth/LoginDialog';
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
  const selectedPostRef = useRef<Post | null>(null);
  const resolvedDeepLink = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // 데스크탑에서 좌측 목록 패널을 접어 미리보기를 넓히는 상태(세션 로컬)
  const [collapsed, setCollapsed] = useState(false);
  // 공유 링크 ?post= 의 카테고리가 정해지기 전에는 "첫 카테고리 자동선택"을 보류
  // (categoryId 없이 들어온 딥링크가 엉뚱한 카테고리 목록을 띄우는 레이스 방지)
  const [deepLinkResolving, setDeepLinkResolving] = useState(
    Boolean(params.get('post') && !params.get('category')),
  );
  // 공유 링크 글을 못 찾았을 때의 안내 — 토스트는 초기 로드 직후 유실될 수 있어 미리보기 패널에 인라인 표시
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  // 카테고리 실시간 구독
  useEffect(
    () =>
      subscribeCategories(setCategories, (e) => {
        console.error('카테고리 구독 실패:', e);
        setLoadError(true);
      }),
    [],
  );

  // 선택된 카테고리가 없으면 첫 잎새로 (딥링크 글 해결 중이면 대기)
  useEffect(() => {
    if (!selectedCategoryId && !deepLinkResolving && categories.length > 0) {
      const firstLeaf = leafPaths(categories)[0];
      if (firstLeaf) setSelectedCategoryId(firstLeaf.id);
    }
  }, [categories, selectedCategoryId, deepLinkResolving]);

  // 보던 카테고리가 사라졌거나(삭제) 폴더(잎새 아님)를 가리키면 첫 잎새로 되돌림.
  // 폴더 딥링크(?category=<folder>)가 빈 목록을 조용히 띄우는 것 방지. 글 딥링크 해결 중이면 대기.
  useEffect(() => {
    if (!selectedCategoryId || categories.length === 0 || deepLinkResolving) return;
    const exists = categories.some((c) => c.id === selectedCategoryId);
    if (!exists || hasChildren(selectedCategoryId, categories)) {
      const firstLeaf = leafPaths(categories)[0];
      setSelectedCategoryId(firstLeaf?.id ?? null);
      setSelectedPost(null);
    }
  }, [categories, selectedCategoryId, deepLinkResolving]);

  // 선택 게시물을 ref로도 들고 있어, loadFirst가 목록을 채울 때 딥링크 글을 끼워 넣을 수 있게 한다.
  useEffect(() => {
    selectedPostRef.current = selectedPost;
  }, [selectedPost]);

  // 공유 링크(?post=)로 진입한 경우 해당 게시물 로드.
  // params에 반응한다 — 정적 프리렌더 페이지에서 useSearchParams가 마운트 직후에야 채워질 수 있어
  // []-deps로 한 번만 돌면 postId를 놓친다. 같은 id 재요청은 ref로 막는다.
  useEffect(() => {
    const postId = params.get('post');
    if (!postId) {
      setDeepLinkResolving(false);
      return;
    }
    if (resolvedDeepLink.current === postId) return;
    resolvedDeepLink.current = postId;
    setDeepLinkResolving(true);
    getPost(postId)
      .then((p) => {
        if (p) {
          setDeepLinkError(null);
          setSelectedPost(p);
          setSelectedCategoryId(p.categoryId);
        } else {
          setDeepLinkError('이 작품은 찾을 수 없어요. 지워졌거나 주소가 잘못됐을 수 있어요.');
        }
      })
      .catch((e) => {
        console.error('공유 글 불러오기 실패:', e);
        setDeepLinkError('작품을 불러오지 못했어요. 잠시 후 다시 해주세요.');
      })
      .finally(() => setDeepLinkResolving(false));
  }, [params, toast]);

  const loadFirst = useCallback(async (categoryId: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const page = await fetchPosts(categoryId);
      // 공유링크로 연 글이 이 카테고리에 속하는데 첫 페이지에 없으면, 목록 맨 위에 끼워 선택 표시되게 한다.
      const sel = selectedPostRef.current;
      const list =
        sel && sel.categoryId === categoryId && !page.posts.some((p) => p.id === sel.id)
          ? [sel, ...page.posts]
          : page.posts;
      setPosts(list);
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
      // 딥링크로 위에 끼워 둔 글이 다음 페이지에 또 나올 수 있어 중복 제거
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
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
    setDeepLinkError(null);
    router.replace(`/board?category=${id}`, { scroll: false });
  }

  function selectPost(post: Post) {
    resolvedDeepLink.current = post.id; // 이미 가진 객체라 딥링크 효과가 재요청하지 않게 표시
    setSelectedPost(post);
    router.replace(`/board?category=${post.categoryId}&post=${post.id}`, { scroll: false });
  }

  function handleFork(post: Post) {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    router.push(`/create?fork=${post.id}`);
  }

  // 좋아요 토글 시 목록·선택 게시물의 likeCount를 즉시 동기화
  function handleLikeChanged(postId: string, delta: number) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likeCount: (p.likeCount ?? 0) + delta } : p)),
    );
    setSelectedPost((prev) =>
      prev && prev.id === postId ? { ...prev, likeCount: (prev.likeCount ?? 0) + delta } : prev,
    );
  }

  // 첫 조회 기록 시 목록·선택 게시물의 viewCount 동기화(재선택 시 내 조회가 유지되게)
  function handleViewChanged(postId: string) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, viewCount: (p.viewCount ?? 0) + 1 } : p)),
    );
    setSelectedPost((prev) =>
      prev && prev.id === postId ? { ...prev, viewCount: (prev.viewCount ?? 0) + 1 } : prev,
    );
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
    <div
      className={`mx-auto grid max-w-7xl gap-5 p-4 sm:p-6 ${
        collapsed ? 'lg:grid-cols-[3rem_1fr]' : 'lg:grid-cols-[minmax(320px,2fr)_3fr]'
      }`}
    >
      {/* 왼쪽: 카테고리 + 목록 (접히는 전체 패널) */}
      <section
        className={`anim-pop-in flex max-h-[80vh] flex-col gap-4 rounded-[var(--r-lg)] border-2 border-line bg-surface p-5 ${
          collapsed ? 'lg:hidden' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[21px]">친구들의 작품</h2>
          <button
            onClick={() => setCollapsed(true)}
            aria-label="목록 접기"
            title="목록 접기"
            className="press hidden h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink lg:grid"
          >
            <PanelLeftClose size={20} />
          </button>
        </div>
        <CategoryTree
          categories={categories}
          selectedId={selectedCategoryId}
          onSelect={selectCategory}
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
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
              onDownload={(p) => downloadProgram(p.code, p.title, toast)}
              onTitleSaved={handleTitleSaved}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          )}
        </div>
      </section>

      {/* 접힌 띠 (데스크탑에서만 보임; 클릭하면 다시 펼침) */}
      <aside
        className={`anim-pop-in max-h-[80vh] flex-col items-center gap-3 rounded-[var(--r-lg)] border-2 border-line bg-surface py-4 ${
          collapsed ? 'hidden lg:flex' : 'hidden'
        }`}
      >
        <button
          onClick={() => setCollapsed(false)}
          aria-label="목록 펼치기"
          title="목록 펼치기"
          className="press grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          <PanelLeftOpen size={20} />
        </button>
        <button
          onClick={() => setCollapsed(false)}
          aria-label="목록 펼치기"
          className="press flex-1 text-[14px] text-muted hover:text-ink"
          style={{ writingMode: 'vertical-rl' }}
        >
          친구들의 작품
        </button>
      </aside>

      {/* 오른쪽: 미리보기 */}
      <section
        className="anim-pop-in flex min-h-[72vh] flex-col rounded-[var(--r-lg)] border-2 border-line bg-surface p-5"
        style={{ animationDelay: '60ms' }}
      >
        {deepLinkError && !selectedPost ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-coral-soft text-coral-ink">
              <CloudOff size={26} aria-hidden />
            </span>
            <p className="text-[15px] text-muted">{deepLinkError}</p>
          </div>
        ) : (
          <PostPreview
            post={selectedPost}
            canEdit={!!selectedPost && (isAdmin || selectedPost.ownerUid === user?.uid)}
            canFork={!!selectedPost && selectedPost.ownerUid !== user?.uid}
            onFork={handleFork}
            currentUserUid={user?.uid ?? null}
            onNeedLogin={() => setLoginOpen(true)}
            onLikeChanged={handleLikeChanged}
            onViewChanged={handleViewChanged}
          />
        )}
      </section>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
