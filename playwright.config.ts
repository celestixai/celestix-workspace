import { defineConfig, devices } from '@playwright/test';

/**
 * Celestix E2E Test Configuration
 * 
 * USAGE:
 *   npx playwright test                    # Run all E2E tests
 *   npx playwright test --project=chromium # Chrome only
 *   npx playwright test --ui               # Interactive UI mode
 *   npx playwright test auth               # Run auth tests only
 */

export default defineConfig({
  // ── Test directory ──
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',

  // ── Timeouts ──
  timeout: 30000,
  expect: { timeout: 5000 },

  // ── Retries ──
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // ── Reporter ──
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'e2e-results.json' }],
    process.env.CI ? ['github'] : ['list'],
  ],

  // ── Shared settings ──
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  },

  // ── Browser configs ──
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // ── Dev server ──
  // Uncomment to auto-start frontend before running tests:
  // webServer: {
  //   command: 'cd frontend && pnpm dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60000,
  // },
});
