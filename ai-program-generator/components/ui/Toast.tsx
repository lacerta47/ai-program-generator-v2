'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

type Kind = 'error' | 'success';
interface Item {
  id: number;
  msg: string;
  kind: Kind;
}

const ToastContext = createContext<{ toast: (msg: string, kind?: Kind) => void }>({
  toast: () => {},
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
    (msg: string, kind: Kind = 'error') => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-2), { id, msg, kind }]); // 최대 3개
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
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
                role="alert"
                className={`anim-pop pointer-events-auto flex items-start gap-2.5 rounded-[var(--r-md)] border-2 p-3.5 text-[15px] leading-snug ${
                  t.kind === 'error'
                    ? 'border-coral/50 bg-coral-soft text-coral-ink'
                    : 'border-mint/50 bg-mint-soft text-mint-ink'
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {t.kind === 'error' ? <CircleAlert size={19} /> : <CircleCheck size={19} />}
                </span>
                <span className="min-w-0 flex-1">{t.msg}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="알림 닫기"
                  className="press -m-1 grid h-8 w-8 shrink-0 place-items-center rounded-full opacity-60 hover:opacity-100"
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
