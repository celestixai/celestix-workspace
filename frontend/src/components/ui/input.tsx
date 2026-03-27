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
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={errorId}
            aria-invalid={!!error || undefined}
            className={cn(
              'w-full h-9 px-3 rounded-lg bg-bg-tertiary border border-border-secondary text-sm text-text-primary placeholder:text-text-tertiary',
              'transition-all duration-150 ease-out',
              'hover:border-border-primary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 focus:outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              !!icon && 'pl-10',
              error && 'border-accent-red focus:border-accent-red focus:ring-accent-red/30',
              className
            )}
            {...props}
          />
        </div>
        {error && <p id={errorId} className="text-xs text-accent-red" role="alert">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
