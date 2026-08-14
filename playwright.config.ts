import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// `nuxt dev` without --host only binds the IPv6 loopback (::1), not 127.0.0.1.
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: `pnpm exec nuxt dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Keep local-history auto-load out of the picture for E2E: those flows are
      // covered separately (unit/integration tests), and the app already
      // degrades gracefully to drag & drop when it's unavailable.
      NUXT_HISTORY_DB_PATH: '/nonexistent/History.db'
    }
  }
})
