'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckIcon, AlertIcon, InfoIcon, XIcon } from '../layout/Icons';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let addToastFn: ((message: string, type: ToastType) => void) | null = null;

export const toast = {
  success: (message: string) => addToastFn?.(message, 'success'),
  error: (message: string) => addToastFn?.(message, 'error'),
  warning: (message: string) => addToastFn?.(message, 'warning'),
  info: (message: string) => addToastFn?.(message, 'info'),
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = (message: string, type: ToastType) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      
      setTimeout(() => {
        removeToast(id);
      }, 5000);
    };

    return () => {
      addToastFn = null;
    };
  }, [removeToast]);

  return (
    <>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl
              animate-in slide-in-from-right fade-in duration-300
              ${t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
              ${t.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : ''}
              ${t.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : ''}
              ${t.type === 'info' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : ''}
            `}
          >
            <div className="flex-shrink-0">
              {t.type === 'success' && <CheckIcon />}
              {t.type === 'error' && <XIcon />}
              {t.type === 'warning' && <AlertIcon />}
              {t.type === 'info' && <InfoIcon />}
            </div>
            <p className="text-sm font-medium">{t.message}</p>
            <button
              onClick={() => removeToast(t.id)}
              className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XIcon />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export const Toaster = () => <ToastProvider>{null}</ToastProvider>;