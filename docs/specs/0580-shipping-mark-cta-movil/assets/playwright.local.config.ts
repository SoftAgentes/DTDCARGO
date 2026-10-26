import { defineConfig } from '@playwright/test';

/** Sólo este contrato local; servidor/fixture/guard los controla local-ui-check. */
export default defineConfig({
  testDir: '../../../../e2e',
  testMatch: 'sin-scroll-horizontal.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: '../../../../.codex/qa/playwright-results',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:45800',
    serviceWorkers: 'block',
    proxy: { server: process.env.DTD_UI_PROXY!, bypass: '127.0.0.1,localhost,[::1]' },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
});
