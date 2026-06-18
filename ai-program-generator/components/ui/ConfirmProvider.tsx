'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제 등 파괴적 동작이면 확인 버튼을 danger 색으로 */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** 파괴적 동작 확인용 — window.confirm 대체. `if (!(await confirm({...}))) return;` */
export function useConfirm(): ConfirmFn {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm은 ConfirmProvider 안에서만 쓸 수 있어요.');
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  const settle = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!opts} onClose={() => settle(false)} label={opts?.title ?? '확인'} className="max-w-sm p-6">
        {opts && (
          <>
            <h2 className="text-[20px]">{opts.title}</h2>
            {opts.message && <p className="mt-2 text-[15px] leading-relaxed text-muted">{opts.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => settle(false)}>
                {opts.cancelLabel ?? '취소'}
              </Button>
              <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
                {opts.confirmLabel ?? '확인'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
