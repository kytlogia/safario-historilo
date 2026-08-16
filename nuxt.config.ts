// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['vuetify-nuxt-module', '@nuxt/eslint'],
  ssr: false,
  vuetify: {
    moduleOptions: {
      prefixComposables: ['useLayout']
    },
    vuetifyOptions: {
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
      title: 'Safari History Detail',
      meta: [
        { name: 'description', content: 'Safariの閲覧履歴(History.db)を詳細に確認できるツール' }
      ]
    }
  },
  nitro: {
    // sql.js loads its wasm binary at runtime; make sure it's served as a static asset
    publicAssets: [{ dir: 'public' }]
  },
  runtimeConfig: {
    // NUXT_HISTORY_DB_PATH — path to Safari's History.db; empty string falls
    // back to DEFAULT_DB_PATH in server/utils/history-store.ts
    historyDbPath: '',
    // NUXT_HISTORY_DB_ALLOW_REMOTE
    historyDbAllowRemote: false,
    // NUXT_HISTORY_DB_TRUST_DEV_PROXY
    historyDbTrustDevProxy: false
  }
})
