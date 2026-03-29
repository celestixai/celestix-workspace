import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[rgba(255,255,255,0.65)]">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.40)]">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={errorId}
            aria-invalid={!!error || undefined}
            className={cn(
              'w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[8px] py-2.5 px-3.5 text-sm text-[rgba(255,255,255,0.95)] placeholder:text-[rgba(255,255,255,0.40)] outline-none',
              'hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.06)]',
              'focus:border-[#2563EB] focus:shadow-[0_0_0_2px_rgba(37,99,235,0.2)]',
              'disabled:bg-[rgba(255,255,255,0.02)] disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-[border-color,box-shadow,background] duration-100',
              !!icon && 'pl-10',
              error && 'border-[#EF4444] focus:border-[#EF4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]',
              className
            )}
            {...props}
          />
        </div>
        {error && <p id={errorId} className="text-xs text-[#EF4444]" role="alert">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
