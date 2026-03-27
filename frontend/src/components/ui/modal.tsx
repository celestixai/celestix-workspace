import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Modal({ open, onClose, title, description, children, className, size = 'md' }: ModalProps) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw] max-h-[90vh]',
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[51]',
            'bg-bg-secondary border border-border-primary rounded-xl shadow-lg',
            'animate-scale-in w-[calc(100%-2rem)] p-6 max-h-[85vh] overflow-y-auto',
            sizes[size],
            className
          )}
        >
          {title ? (
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 min-w-0 mr-3">
                <Dialog.Title className="text-lg font-semibold text-text-primary truncate">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="text-sm text-text-secondary mt-1">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0 focus-visible:outline-2 focus-visible:outline-accent-blue" aria-label="Close">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
          ) : (
            <div className="flex justify-end mb-2">
              <Dialog.Close asChild>
                <button className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-blue" aria-label="Close">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
