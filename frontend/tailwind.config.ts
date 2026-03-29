import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        border: {
          primary: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        accent: {
          blue: '#2563EB',
          violet: '#8B5CF6',
          emerald: '#10B981',
          amber: '#F59E0B',
          red: '#EF4444',
          teal: '#14B8A6',
        },
        cx: {
          bg: '#09090B',
          sidebar: '#0C0C0E',
          surface: '#111113',
          raised: '#161618',
          highest: '#1C1C1F',
          brand: '#2563EB',
          'brand-hover': '#3B82F6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          purple: '#8B5CF6',
          teal: '#14B8A6',
          orange: '#F97316',
        },
        surface: {
          DEFAULT: 'var(--bg-surface)',
          hover: 'var(--bg-surface-hover)',
          active: 'var(--bg-surface-active)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Inter', '-apple-system', 'sans-serif'],
        data: ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '10px',
        'xs': '11px',
        'sm': '12px',
        'base': '13px',
        'md': '14px',
        'lg': '16px',
        'xl': '18px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '30px',
      },
      borderRadius: {
        'xs': '2px',
        'sm': '4px',
        DEFAULT: '6px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.3)',
        DEFAULT: '0 4px 12px rgba(0,0,0,0.4)',
        md: '0 4px 16px rgba(0,0,0,0.45)',
        lg: '0 8px 24px rgba(0,0,0,0.5)',
        xl: '0 16px 40px rgba(0,0,0,0.55)',
        glow: '0 0 20px rgba(37,99,235,0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease forwards',
        'fade-in-up': 'fadeInUp 250ms ease forwards',
        'scale-in': 'scaleIn 200ms ease forwards',
        'slide-in-right': 'slideInRight 300ms ease forwards',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'slide-in-up': 'slideInUp 200ms ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
