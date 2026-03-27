/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // ── Environment ──
    environment: 'jsdom',
    globals: true,

    // ── File matching ──
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
    ],

    // ── Setup ──
    setupFiles: ['./src/__tests__/setup.ts'],

    // ── Coverage ──
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 15,  // Start low — increase as tests are added
        branches: 10,
        functions: 15,
        lines: 15,
      },
    },

    // ── Performance ──
    testTimeout: 10000,
    pool: 'forks',

    // ── CSS handling ──
    css: false, // Skip CSS processing in tests
  },
});
