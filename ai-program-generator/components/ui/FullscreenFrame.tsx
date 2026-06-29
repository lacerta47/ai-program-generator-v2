'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import { authedFetch } from '@/lib/client/authedFetch';
import LoadingDots from './LoadingDots';
import Button from './Button';

interface Props {
  code: GeneratedCode;
  title: string;
  /**
   * 게시된 작품이면 그 post id. 주면 쓰기 없는 GET /api/preview/post/[id]로 서빙(공개 code 직접).
   * 없으면(즉석 생성 코드) 로그인 토큰으로 POST /api/preview.
   */
  postId?: string;
  /** 교실 한정 사진(data URI) — 주면 미리보기 서버가 __PHOTO__ 토큰을 치환한다(즉석 POST 경로에서만). */
  photo?: string;
  /** 로그인이 필요할 때(즉석 미리보기 비로그인) 노출할 로그인 동작 — 주면 안내에 버튼이 생긴다. */
  onNeedLogin?: () => void;
  /** iframe 강제 리마운트용 key */
  frameKey?: string | number;
  className?: string;
}

// 미리보기를 "교차 사이트" URL로 로드해 별도 프로세스에서 실행한다.
// (srcDoc은 부모와 같은 프로세스라, 생성 코드의 무한 루프가 탭 전체를 얼렸음 — 실제 발생 버그)
// localhost ↔ 127.0.0.1 은 서로 다른 사이트라 Chrome 사이트 격리가 적용된다.
function previewOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  if (hostname === 'localhost') return `${protocol}//127.0.0.1${p}`;
  if (hostname === '127.0.0.1') return `${protocol}//localhost${p}`;
  // 배포 환경: 별도 미리보기 도메인이 있어야 프로세스 격리가 유지된다.
  const configured = process.env.NEXT_PUBLIC_PREVIEW_ORIGIN;
  if (!configured) {
    // 배포(비-localhost)인데 별도 미리보기 도메인 미설정 = 프로세스 격리 불가.
    // 같은 오리진으로 조용히 폴백(무한루프 코드가 부모 탭을 얼림)하지 않고 명시적으로 실패시킨다.
    // 배포 시 NEXT_PUBLIC_PREVIEW_ORIGIN 설정 필수.
    console.error('[preview] NEXT_PUBLIC_PREVIEW_ORIGIN 미설정 — 미리보기 비활성화(프로세스 격리 불가).');
    throw new Error('PREVIEW_ORIGIN_UNSET');
  }
  return configured;
}

// code 객체 동일성 기준 미리보기 id 캐시 — 탭 토글로 remount돼도 같은 결과면 재요청하지 않는다.
// WeakMap이라 code 객체가 GC되면 함께 정리됨(누수 없음).
const previewIdCache = new WeakMap<GeneratedCode, Promise<string>>();

function requestPreviewId(code: GeneratedCode, photo?: string): Promise<string> {
  const cached = previewIdCache.get(code);
  if (cached) return cached;
  const p = (async () => {
    let r: Response;
    try {
      r = await authedFetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...code, photo }),
      });
    } catch {
      throw new Error('AUTH_REQUIRED'); // 로그아웃 상태(예: 직접 ?fork= URL) — 미리보기 POST 불가
    }
    if (r.status === 401) throw new Error('AUTH_REQUIRED');
    if (!r.ok) throw new Error(String(r.status));
    const { id } = await r.json();
    return id as string;
  })();
  // 실패한 약속은 캐시에서 빼서 다음 시도가 재요청하도록
  p.catch(() => previewIdCache.delete(code));
  previewIdCache.set(code, p);
  return p;
}

// "맞춤(한눈에 보기)" 축소배율 — 프로그램 전체를 한눈에 담기 위한 줌아웃 비율.
// iframe을 1/FIT_SCALE 크기로 키운 뒤 scale(FIT_SCALE)로 줄여, 같은 칸에 더 넓은 영역을 보여준다.
const FIT_SCALE = 0.5;

/** 생성된 프로그램 미리보기 iframe(프로세스 격리) + 전체화면 토글 + "맞춤" 축소배율 토글 */
export default function FullscreenFrame({ code, title, postId, photo, onNeedLogin, frameKey, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fit, setFit] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [retry, setRetry] = useState(0); // "다시 보기"로 재요청

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    setNeedLogin(false);
    // 게시된 작품: 쓰기 없는 GET 경로(공개 code 직접 서빙) — POST/토큰 불필요
    if (postId) {
      try {
        setSrc(`${previewOrigin()}/api/preview/post/${postId}`);
      } catch {
        setFailed(true);
      }
      return;
    }
    // 즉석 생성 코드: 로그인 토큰으로 POST
    requestPreviewId(code, photo)
      .then((id) => {
        if (alive) setSrc(`${previewOrigin()}/api/preview/${id}`);
      })
      .catch((e) => {
        if (!alive) return;
        if (e instanceof Error && e.message === 'AUTH_REQUIRED') setNeedLogin(true);
        else setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [code, postId, frameKey, retry]);

  function toggle() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {
        alert('전체화면을 켤 수 없어요.');
      });
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-white ${className}`}>
      {needLogin ? (
        <div className="grid h-full place-items-center gap-3 p-6 text-center">
          <p className="text-[15px] text-muted">로그인하면 미리보기를 볼 수 있어요.</p>
          {onNeedLogin && (
            <Button variant="primary" onClick={onNeedLogin}>
              로그인하기
            </Button>
          )}
        </div>
      ) : failed ? (
        <div className="grid h-full place-items-center gap-3 p-6 text-center">
          <p className="text-[15px] text-muted">미리보기를 불러오지 못했어요.</p>
          <Button variant="primary" onClick={() => setRetry((r) => r + 1)}>
            다시 보기
          </Button>
        </div>
      ) : src ? (
        <iframe
          key={`${frameKey ?? ''}-${src}`}
          className={fit ? 'bg-white' : 'h-full w-full bg-white'}
          style={
            fit
              ? {
                  width: `${100 / FIT_SCALE}%`,
                  height: `${100 / FIT_SCALE}%`,
                  transform: `scale(${FIT_SCALE})`,
                  transformOrigin: 'top left',
                }
              : undefined
          }
          src={src}
          title={title}
          sandbox="allow-scripts"
        />
      ) : (
        <div className="grid h-full place-items-center">
          <LoadingDots />
        </div>
      )}
      <div className="absolute right-3 top-3 flex gap-1.5">
        {src && (
          <button
            onClick={() => setFit((v) => !v)}
            aria-label={fit ? '실제 크기로 보기' : '한눈에 보기(맞춤)'}
            title={fit ? '실제 크기로 보기' : '한눈에 보기(맞춤)'}
            className={`press grid h-11 w-11 place-items-center rounded-full border-2 backdrop-blur-sm ${
              fit
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface/90 text-ink hover:border-brand/60 hover:text-brand-strong dark:hover:text-brand'
            }`}
          >
            {fit ? <ZoomIn size={19} /> : <ZoomOut size={19} />}
          </button>
        )}
        <button
          onClick={toggle}
          aria-label={isFullscreen ? '전체화면 끝내기' : '전체화면으로 보기'}
          title={isFullscreen ? '전체화면 끝내기 (Esc)' : '전체화면으로 보기'}
          className="press grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-surface/90 text-ink backdrop-blur-sm hover:border-brand/60 hover:text-brand-strong dark:hover:text-brand"
        >
          {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
        </button>
      </div>
    </div>
  );
}
