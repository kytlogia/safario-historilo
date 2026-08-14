import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup, url } from '@nuxt/test-utils/e2e'

describe('/api/local-history (History.db missing)', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'local-history-int-missing-'))
  const missingDbPath = join(tempDir, 'does-not-exist', 'History.db')

  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    // See the comment in local-history-available.test.ts: a built server avoids
    // `nuxt dev`'s internal proxy hop so the localhost/Origin checks under test
    // see a real socket address.
    dev: false,
    server: true,
    browser: false,
    env: { NUXT_HISTORY_DB_PATH: missingDbPath },
    setupTimeout: 120_000
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('GET /api/local-history/status reports present:false, readable:false, available:false', async () => {
    const res = await fetch('/api/local-history/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      available: false,
      present: false,
      readable: false,
      path: missingDbPath
    })
  })

  it('GET /api/local-history returns 404 with a Japanese not-found message', async () => {
    const res = await fetch('/api/local-history')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.message).toContain('History.db が見つかりませんでした')
  })

  it('same-origin localhost requests are still allowed through (local access itself is not blocked)', async () => {
    const res = await fetch('/api/local-history/status', {
      headers: { origin: url('/').replace(/\/$/, '') }
    })
    expect(res.status).toBe(200)
  })
})
