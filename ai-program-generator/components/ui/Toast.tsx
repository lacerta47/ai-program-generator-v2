'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

type Kind = 'error' | 'success';
interface Action {
  prompt: string;
  label: string;
  href: string;
}
interface Item {
  id: number;
  msg: string;
  kind: Kind;
  action?: Action;
}

const ToastContext = createContext<{ toast: (msg: string, kind?: Kind, action?: Action) => () => void }>({
  toast: () => () => {},
});

export const useToast = () => useContext(ToastContext);

const AUTO_DISMISS_MS = 5000;

/** 우상단 토스트 알림. 하단 에러 배너 대체 — 어디서 눌러도 눈에 띄게. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (msg: string, kind: Kind = 'error', action?: Action) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-2), { id, msg, kind, action }]); // 최대 3개
      if (!action) window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      return () => dismiss(id);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed right-4 top-20 z-[60] flex w-[min(92vw,340px)] flex-col gap-2"
          >
            {items.map((t) => (
              <div
                key={t.id}
                role={t.action ? undefined : 'alert'}
                className={`anim-pop pointer-events-auto flex items-start gap-2.5 rounded-[var(--r-md)] border-2 p-3.5 text-[15px] leading-snug ${
                  t.kind === 'error'
                    ? 'border-coral/50 bg-coral-soft text-coral-ink'
                    : 'border-mint/50 bg-mint-soft text-mint-ink'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {t.kind === 'error' ? <CircleAlert size={19} /> : <CircleCheck size={19} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={t.action ? 'text-[17px]' : undefined}>{t.msg}</p>
                  {t.action && (
                    <>
                      <p className="mt-1 text-[17px]">{t.action.prompt}</p>
                      <a
                        href={t.action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${t.action.label} (새 탭)`}
                        className="press mt-2 inline-flex min-h-12 items-center rounded-[var(--r-md)] border-2 border-line bg-surface px-5 text-[17px] font-medium text-ink hover:border-brand/50 hover:bg-surface-2"
                        onClick={() => dismiss(t.id)}
                      >
                        {t.action.label}
                      </a>
                    </>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="알림 닫기"
                  className={`press -m-1 grid shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100 ${t.action ? 'h-11 w-11' : 'h-8 w-8'}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
