import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // server/utils/history-store.ts checks `import.meta.dev` (a Nuxt/Vite build-time
  // macro) to gate its nuxt-dev-proxy fallback. Force it on so that branch is
  // exercisable from tests/unit/history-store.test.ts; the flag is opt-in via
  // NUXT_HISTORY_DB_TRUST_DEV_PROXY regardless, and Nuxt's own production build
  // (not this config) is what guarantees it compiles to `false` for real deploys.
  define: {
    'import.meta.dev': 'true'
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url))
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    // Integration tests build & boot a real Nitro server in beforeAll.
    hookTimeout: 120000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/composables/**', 'app/utils/**', 'server/utils/**'],
      exclude: ['app/composables/**/*.d.ts']
    }
  }
})
