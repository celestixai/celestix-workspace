import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-[8px] text-[13px] leading-5 px-4 py-2 border border-transparent cursor-pointer whitespace-nowrap outline-none transition-[background,border-color,color,box-shadow,opacity,transform] duration-100 ease-out select-none active:scale-[0.97]';

    const variants = {
      primary: 'bg-[#2563EB] hover:bg-[#3B82F6] text-white border-[#2563EB] hover:border-[#3B82F6] active:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:shadow-[0_0_0_2px_#2563EB,var(--shadow-glow)]',
      secondary: 'bg-transparent border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.65)] hover:border-[rgba(255,255,255,0.20)] hover:text-[rgba(255,255,255,0.95)] active:bg-[rgba(255,255,255,0.04)] focus-visible:shadow-[0_0_0_2px_#2563EB]',
      ghost: 'bg-transparent text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[rgba(255,255,255,0.95)] active:bg-[rgba(255,255,255,0.08)] focus-visible:shadow-[0_0_0_2px_#2563EB]',
      danger: 'bg-transparent border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white focus-visible:shadow-[0_0_0_2px_#EF4444]',
      outline: 'bg-transparent border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.65)] hover:border-[rgba(255,255,255,0.20)] hover:text-[rgba(255,255,255,0.95)] active:bg-[rgba(255,255,255,0.04)] focus-visible:shadow-[0_0_0_2px_#2563EB]',
    };

    const sizes = {
      xs: 'text-[11px] py-1 px-1.5 gap-1 rounded-[6px]',
      sm: 'text-xs py-1 px-3 rounded-[6px]',
      md: '',
      lg: 'text-sm py-2.5 px-5',
      icon: 'w-8 h-8 p-0 rounded-[6px] border-transparent bg-transparent text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)]',
      'icon-sm': 'w-7 h-7 p-0 rounded-[6px] border-transparent bg-transparent text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)]',
      'icon-xs': 'w-6 h-6 p-0 rounded-[6px] border-transparent bg-transparent text-[rgba(255,255,255,0.40)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[rgba(255,255,255,0.95)]',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
