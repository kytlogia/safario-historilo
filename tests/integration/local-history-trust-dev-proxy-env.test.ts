// Under Vitest's global `jsdom` environment (vitest.config.ts), Vite transforms
// this file through its browser/client environment rather than the ssr one, so
// `import.meta.url` resolves to a non-`file:` URL and fileURLToPath() below
// throws. Integration tests boot a real Nitro server and have no DOM
// dependency, so force `node` to keep that a real file:// URL.
// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'

describe('/api/local-history with NUXT_HISTORY_DB_TRUST_DEV_PROXY=true on nuxt dev', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    dev: true,
    server: true,
    browser: false,
    env: {
      NUXT_HISTORY_DB_PATH: '/tmp/does-not-exist/History.db',
      NUXT_HISTORY_DB_TRUST_DEV_PROXY: 'true'
    },
    setupTimeout: 120_000
  })

  it('allows status endpoint access through the dev proxy path', async () => {
    const res = await fetch('/api/local-history/status')
    expect(res.status).toBe(200)
  })
})
