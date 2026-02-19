'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { clsx } from 'clsx';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const icons: Record<ToastType, typeof AlertCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'border-accent-success text-accent-success',
  error: 'border-accent-error text-accent-error',
  warning: 'border-accent-warning text-accent-warning',
  info: 'border-accent text-accent',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, title, description }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <ToastPrimitive.Root
              key={t.id}
              className={clsx(
                'bg-background-elevated border-l-4 rounded-lg shadow-lg p-4',
                'animate-slide-up',
                colors[t.type]
              )}
              onOpenChange={(open) => {
                if (!open) removeToast(t.id);
              }}
            >
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <ToastPrimitive.Title className="font-medium text-text">
                    {t.title}
                  </ToastPrimitive.Title>
                  {t.description && (
                    <ToastPrimitive.Description className="text-sm text-text-secondary mt-1">
                      {t.description}
                    </ToastPrimitive.Description>
                  )}
                </div>
                <ToastPrimitive.Close className="text-text-muted hover:text-text">
                  <X className="w-4 h-4" />
                </ToastPrimitive.Close>
              </div>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] z-50" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
