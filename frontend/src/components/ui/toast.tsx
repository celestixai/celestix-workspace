import * as ToastPrimitive from '@radix-ui/react-toast';
import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastData {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
}

interface ToastStore {
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString(36);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(title: string, type: 'success' | 'error' | 'info' = 'info', description?: string) {
  useToastStore.getState().addToast({ title, type, description });
}

const icons = {
  success: <CheckCircle className="text-accent-emerald" size={18} />,
  error: <AlertCircle className="text-accent-red" size={18} />,
  info: <Info className="text-accent-blue" size={18} />,
};

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={cn(
            'bg-bg-secondary border border-border-secondary rounded-lg shadow-lg p-4',
            'flex items-start gap-3 animate-slide-in-right',
            'data-[state=closed]:opacity-0 data-[state=closed]:transition-opacity data-[state=closed]:duration-200'
          )}
          onOpenChange={(open) => !open && removeToast(t.id)}
        >
          <span className="flex-shrink-0">{icons[t.type]}</span>
          <div className="flex-1 min-w-0">
            <ToastPrimitive.Title className="text-sm font-medium text-text-primary truncate">
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-xs text-text-secondary mt-1">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close className="text-text-tertiary hover:text-text-primary flex-shrink-0" aria-label="Dismiss">
            <X size={14} />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-96" />
    </ToastPrimitive.Provider>
  );
}
