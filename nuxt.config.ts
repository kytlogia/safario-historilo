// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-08-17',
  devtools: { enabled: true },
  modules: ['vuetify-nuxt-module', '@nuxt/eslint', '@nuxtjs/i18n'],
  ssr: false,
  i18n: {
    locales: [
      { code: 'ja', language: 'ja-JP', name: '日本語', file: 'ja.json' },
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'zh', language: 'zh-CN', name: '中文', file: 'zh.json' }
    ],
    defaultLocale: 'ja',
    strategy: 'no_prefix',
    langDir: 'locales/',
    // Deliberately off: the module's own browser-language auto-detection
    // would switch a first-time visitor away from ja based on their
    // browser's Accept-Language, changing today's default UX for existing
    // users and breaking every e2e test's Japanese-text assertions.
    // useAppLocale.ts persists an explicit choice via localStorage instead
    // (mirrors useAppTheme.ts) — everyone still defaults to ja until they
    // use the language switcher themselves.
    detectBrowserLanguage: false,
    vueI18n: '../i18n.config.ts',
    // The upload-instructions strings intentionally embed a couple of <br>/
    // <code> tags (see i18n/locales/*.json's uploadPanel.*.step* keys,
    // rendered via v-html in the *UploadPanel.vue components) — without
    // this, the bundler's default strict check rejects any HTML in locale
    // messages and fails the whole build.
    compilation: {
      strictMessage: false
    }
  },
  vuetify: {
    moduleOptions: {
      prefixComposables: ['useLayout']
    },
    vuetifyOptions: {
      // No `locale` block here: vuetify-nuxt-module auto-detects @nuxtjs/i18n
      // (present in `modules` above) and replaces Vuetify's own locale
      // system with an adapter over this app's own vue-i18n instance — see
      // i18n.config.ts, which supplies the `$vuetify.*` messages that
      // adapter looks up.
      theme: {
        defaultTheme: 'safariHistory',
        themes: {
          safariHistory: {
            dark: false,
            colors: {
              primary: '#0A84FF',
              secondary: '#5E5CE6',
              background: '#F5F5F7',
              surface: '#FFFFFF'
            }
          },
          safariHistoryDark: {
            dark: true,
            colors: {
              primary: '#0A84FF',
              secondary: '#5E5CE6',
              background: '#1C1C1E',
              surface: '#2C2C2E'
            }
          }
        }
      }
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      title: 'Safari History Detail',
      meta: [
        { name: 'description', content: 'Safariの閲覧履歴(History.db)を詳細に確認できるツール' }
      ]
    }
  },
  vite: {
    // historyDatabase.worker.ts is loaded via `new Worker(url, { type: 'module' })`
    // (see app/composables/useSafariHistoryParser.ts) — match Vite's own worker
    // bundle format to that, otherwise it defaults to 'iife', which can't
    // represent import.meta and silently strips it in the bundled worker.
    worker: {
      format: 'es'
    }
  },
  runtimeConfig: {
    // NUXT_HISTORY_DB_PATH — path to Safari's History.db; empty string falls
    // back to DEFAULT_DB_PATH in server/utils/history-store.ts
    historyDbPath: '',
    // NUXT_HISTORY_DB_ALLOW_REMOTE
    historyDbAllowRemote: false,
    // NUXT_HISTORY_DB_TRUST_DEV_PROXY
    historyDbTrustDevProxy: false
  },
  nitro: {
    rollupConfig: {
      // `node:sqlite` (server/utils/history-store.ts) is a newer Node
      // builtin (22.5+) that Rollup's builtin-module list doesn't know
      // about yet, so it misclassifies the dynamic `import('node:sqlite')`
      // as an unresolved external and logs a WARN on every build — even
      // though the surrounding try/catch already handles it being absent
      // at runtime. Declaring it external explicitly silences that
      // specific false-positive without touching any other warning.
      external: ['node:sqlite']
    }
  }
})
