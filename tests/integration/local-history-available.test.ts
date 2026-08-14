import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { createSampleHistoryDatabaseBytes } from '../fixtures/build-history-db'

describe('/api/local-history (History.db present & readable)', async () => {
  const tempDir = await mkdtemp(join(tmpdir(), 'local-history-int-'))
  const dbPath = join(tempDir, 'History.db')
  await writeFile(dbPath, await createSampleHistoryDatabaseBytes())

  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    // A built (non-dev) server is used deliberately: `nuxt dev` proxies requests
    // through an internal loopback hop that loses the real socket address (see
    // the extensive comment on resolveClientIp() in server/utils/history-store.ts),
    // which would make every request here look like an unresolved dev-proxy
    // request instead of exercising the real localhost/Origin checks.
    dev: false,
    server: true,
    browser: false,
    env: { NUXT_HISTORY_DB_PATH: dbPath },
    setupTimeout: 120_000
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('GET /api/local-history/status reports available:true with the configured path', async () => {
    const res = await fetch('/api/local-history/status')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      available: true,
      supported: true,
      present: true,
      readable: true,
      path: dbPath
    })
  })

  it('GET /api/local-history streams back a valid SQLite database as an attachment', async () => {
    const res = await fetch('/api/local-history')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/octet-stream')
    expect(res.headers.get('content-disposition')).toContain('History.db')

    const bytes = new Uint8Array(await res.arrayBuffer())
    const magic = new TextDecoder().decode(bytes.slice(0, 15))
    expect(magic).toBe('SQLite format 3')
  })

  it('rejects a cross-origin request at the API layer with 403', async () => {
    const res = await fetch('/api/local-history/status', {
      headers: { origin: 'https://evil.example.com' }
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.message).toContain('同一オリジンからのアクセスのみ許可されています')
  })

  it('rejects a cross-origin request to the DB-streaming endpoint too', async () => {
    const res = await fetch('/api/local-history', {
      headers: { origin: 'https://evil.example.com' }
    })
    expect(res.status).toBe(403)
  })
})
