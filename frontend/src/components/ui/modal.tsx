import React, { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function Modal({ open, onClose, title, description, children, className, size = 'md' }: ModalProps) {
  const isMobile = useIsMobile();
  const dragY = useMotionValue(0);
  const sheetOpacity = useTransform(dragY, [0, 300], [1, 0.2]);

  const sizes = {
    sm: 'max-w-[480px]',
    md: 'max-w-[600px]',
    lg: 'max-w-[800px]',
    xl: 'max-w-[860px]',
    full: 'max-w-[90vw] max-h-[90vh]',
  };

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      if (info.offset.y > 100 || info.velocity.y > 300) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              {isMobile ? (
                /* ---- Mobile: Bottom Sheet ---- */
                <>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div
                      className="fixed inset-0 bg-black/50 backdrop-blur-[4px] z-[300]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount>
                    <motion.div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby={title ? 'modal-title' : undefined}
                      className={cn(
                        'fixed bottom-0 left-0 right-0 z-[301]',
                        'bg-[#161618] border-t border-[rgba(255,255,255,0.12)] rounded-t-[16px] p-5 pt-0 shadow-[0_-12px_40px_rgba(0,0,0,0.5)]',
                        'w-full max-h-[85vh] overflow-y-auto',
                        className,
                      )}
                      style={{ opacity: sheetOpacity }}
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      drag="y"
                      dragConstraints={{ top: 0 }}
                      dragElastic={0.2}
                      onDragEnd={handleDragEnd}
                      dragMomentum={false}
                    >
                      {/* Drag handle */}
                      <div className="flex justify-center pt-3 pb-3 cursor-grab active:cursor-grabbing">
                        <div className="w-8 h-1 rounded-full bg-[rgba(255,255,255,0.20)]" />
                      </div>

                      <Dialog.Close asChild>
                        <button
                          className="absolute top-4 right-4 w-8 h-8 p-0 rounded-[6px] inline-flex items-center justify-center bg-transparent text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)] transition-[background,color] duration-100 outline-none focus-visible:shadow-[0_0_0_2px_#2563EB]"
                          aria-label="Close"
                        >
                          <X size={16} />
                        </button>
                      </Dialog.Close>
                      {title && (
                        <div className="mb-3 pr-8">
                          <Dialog.Title id="modal-title" className="text-lg font-semibold text-[rgba(255,255,255,0.95)] mb-3">
                            {title}
                          </Dialog.Title>
                          {description && (
                            <Dialog.Description className="text-sm text-[rgba(255,255,255,0.65)] mt-1">
                              {description}
                            </Dialog.Description>
                          )}
                        </div>
                      )}
                      {children}
                    </motion.div>
                  </Dialog.Content>
                </>
              ) : (
                /* ---- Desktop: Centered Modal (flexbox on overlay) ---- */
                <Dialog.Content asChild forceMount>
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={title ? 'modal-title' : undefined}
                    className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-[4px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                  >
                    <motion.div
                      className={cn(
                        'relative w-full bg-[#161618] border border-[rgba(255,255,255,0.12)] rounded-[16px] p-7 shadow-[0_24px_48px_rgba(0,0,0,0.5)]',
                        'max-h-[85vh] overflow-y-auto',
                        sizes[size],
                        className,
                      )}
                      initial={{ scale: 0.96 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Dialog.Close asChild>
                        <button
                          className="absolute top-5 right-5 w-8 h-8 p-0 rounded-[6px] inline-flex items-center justify-center bg-transparent text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)] transition-[background,color] duration-100 outline-none focus-visible:shadow-[0_0_0_2px_#2563EB]"
                          aria-label="Close"
                        >
                          <X size={16} />
                        </button>
                      </Dialog.Close>
                      {title && (
                        <div className="mb-3 pr-8">
                          <Dialog.Title id="modal-title" className="text-lg font-semibold text-[rgba(255,255,255,0.95)] mb-3">
                            {title}
                          </Dialog.Title>
                          {description && (
                            <Dialog.Description className="text-sm text-[rgba(255,255,255,0.65)] mt-1">
                              {description}
                            </Dialog.Description>
                          )}
                        </div>
                      )}
                      {children}
                    </motion.div>
                  </motion.div>
                </Dialog.Content>
              )}
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
