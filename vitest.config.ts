import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Component tests (tests/unit/app/components/) mount real .vue SFCs via
  // @vue/test-utils, which needs the SFC compiler Nuxt otherwise wires up.
  plugins: [vue()],
  // server/utils/history-store.ts checks `import.meta.dev` (a Nuxt/Vite build-time
  // macro) to gate its nuxt-dev-proxy fallback. Force it on so that branch is
  // exercisable from tests/unit/server/utils/history-store.test.ts; the flag is opt-in via
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
    // Global jsdom (rather than Vitest Browser Mode, which Vuetify's own docs
    // recommend) is a deliberate tradeoff: the component interactions this repo
    // plans to test (text/class/emit assertions, basic clicks) are covered by
    // jsdom + resize-observer-polyfill, real-browser-only behavior (drag & drop
    // history.db loading) is already covered by tests/e2e/, and a real browser
    // runner is slower and adds CI complexity. See issue #100 decision 6.
    // NOTE: under this global jsdom, Vite transforms every test file through
    // its browser/client path instead of ssr, which breaks two things that
    // have nothing to do with DOM: the `define` above (`import.meta.dev`)
    // stops being applied, and `import.meta.url` no longer resolves to a
    // real `file:` URL (breaking fileURLToPath() in fixtures/integration
    // setup). Vitest 4 removed `environmentMatchGlobs`, so there's no single
    // place to blanket-exempt `tests/integration/**` or similar — a new file
    // that hits either of these needs its own `// @vitest-environment node`
    // docblock (see tests/integration/*.test.ts or
    // tests/unit/server/utils/history-store.test.ts for examples).
    environment: 'jsdom',
    globals: false,
    setupFiles: ['tests/unit/support/setup.ts'],
    testTimeout: 20000,
    // Integration tests build & boot a real Nitro server in beforeAll.
    hookTimeout: 120000,
    server: {
      deps: {
        inline: ['vuetify']
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/composables/**', 'app/utils/**', 'server/utils/**'],
      exclude: ['app/composables/**/*.d.ts']
    }
  }
})
