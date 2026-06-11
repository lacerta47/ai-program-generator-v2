'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import type { GeneratedCode } from '@/lib/ai/types';
import LoadingDots from './LoadingDots';

interface Props {
  code: GeneratedCode;
  title: string;
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
    // 같은 오리진으로 폴백 = 격리 없음. 무한루프 코드가 탭을 얼릴 수 있으므로 경고.
    console.warn(
      '[preview] NEXT_PUBLIC_PREVIEW_ORIGIN 미설정 — 미리보기가 같은 오리진에서 실행되어 프로세스 격리가 적용되지 않습니다.',
    );
    return '';
  }
  return configured;
}

// code 객체 동일성 기준 미리보기 id 캐시 — 탭 토글로 remount돼도 같은 결과면 재요청하지 않는다.
// WeakMap이라 code 객체가 GC되면 함께 정리됨(누수 없음).
const previewIdCache = new WeakMap<GeneratedCode, Promise<string>>();

function requestPreviewId(code: GeneratedCode): Promise<string> {
  const cached = previewIdCache.get(code);
  if (cached) return cached;
  const p = fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(code),
  }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json().then(({ id }) => id as string);
  });
  // 실패한 약속은 캐시에서 빼서 다음 시도가 재요청하도록
  p.catch(() => previewIdCache.delete(code));
  previewIdCache.set(code, p);
  return p;
}

/** 생성된 프로그램 미리보기 iframe(프로세스 격리) + 전체화면 토글 버튼 */
export default function FullscreenFrame({ code, title, frameKey, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    requestPreviewId(code)
      .then((id) => {
        if (alive) setSrc(`${previewOrigin()}/api/preview/${id}`);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code, frameKey]);

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
    <div ref={containerRef} className={`relative bg-white ${className}`}>
      {failed ? (
        <p className="grid h-full place-items-center p-6 text-center text-[15px] text-muted">
          미리보기를 불러오지 못했어요. 새로고침해 주세요.
        </p>
      ) : src ? (
        <iframe
          key={`${frameKey ?? ''}-${src}`}
          className="h-full w-full bg-white"
          src={src}
          title={title}
          sandbox="allow-scripts"
        />
      ) : (
        <div className="grid h-full place-items-center">
          <LoadingDots />
        </div>
      )}
      <button
        onClick={toggle}
        aria-label={isFullscreen ? '전체화면 끝내기' : '전체화면으로 보기'}
        title={isFullscreen ? '전체화면 끝내기 (Esc)' : '전체화면으로 보기'}
        className="press absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border-2 border-line bg-surface/90 text-ink backdrop-blur-sm hover:border-brand/60 hover:text-brand-strong dark:hover:text-brand"
      >
        {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
      </button>
    </div>
  );
}
