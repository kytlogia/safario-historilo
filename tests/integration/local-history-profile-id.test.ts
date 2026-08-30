// Under Vitest's global `jsdom` environment (vitest.config.ts), Vite transforms
// this file through its browser/client environment rather than the ssr one, so
// `import.meta.url` resolves to a non-`file:` URL and fileURLToPath() below
// throws. Integration tests boot a real Nitro server and have no DOM
// dependency, so force `node` to keep that a real file:// URL.
// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { createSampleHistoryDatabaseBytes } from '../fixtures/build-history-db'

const PROFILE_ID = '11111111-1111-1111-1111-111111111111'

// Safari for Windows was discontinued in 2012 (#138) — PROFILES_DIR is
// unconditionally null there (server/utils/history-store.ts), regardless of
// $HOME, so this suite's whole premise (faking a Safari container layout
// under a redirected $HOME) has nothing to exercise on Windows.
describe.skipIf(process.platform === 'win32')('/api/local-history profile support', async () => {
  // server/utils/safari-profiles.ts scans a fixed path under the home
  // directory (there's no NUXT_-prefixed override for it, unlike
  // NUXT_HISTORY_DB_PATH). Redirecting $HOME for the spawned server process
  // is what lets this test exercise the real container-path convention
  // without touching the machine's actual Safari data.
  const fakeHome = await mkdtemp(join(tmpdir(), 'local-history-int-home-'))
  const profileDir = join(
    fakeHome,
    'Library/Containers/com.apple.Safari/Data/Library/Safari/Profiles',
    PROFILE_ID
  )
  await mkdir(profileDir, { recursive: true })
  const profileDbPath = join(profileDir, 'History.db')
  await writeFile(profileDbPath, await createSampleHistoryDatabaseBytes())

  await setup({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    // A built (non-dev) server is used deliberately — see
    // local-history-available.test.ts for why.
    dev: false,
    server: true,
    browser: false,
    env: { HOME: fakeHome, NUXT_HISTORY_DB_PATH: join(fakeHome, 'does-not-exist.db') },
    setupTimeout: 120_000
  })

  afterAll(async () => {
    await rm(fakeHome, { recursive: true, force: true })
  })

  it('GET /api/local-history/profiles lists the default profile plus the named one found on disk', async () => {
    const res = await fetch('/api/local-history/profiles')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.profiles).toEqual([
      { id: 'default', name: 'デフォルト', dbPath: join(fakeHome, 'does-not-exist.db') },
      { id: PROFILE_ID, name: expect.any(String), dbPath: profileDbPath }
    ])
  })

  it('GET /api/local-history/status?profileId=<uuid> reports the profile-specific path', async () => {
    const res = await fetch(`/api/local-history/status?profileId=${PROFILE_ID}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      available: true,
      present: true,
      readable: true,
      path: profileDbPath
    })
  })

  it("GET /api/local-history?profileId=<uuid> streams back that profile's database", async () => {
    const res = await fetch(`/api/local-history?profileId=${PROFILE_ID}`)
    expect(res.status).toBe(200)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const magic = new TextDecoder().decode(bytes.slice(0, 15))
    expect(magic).toBe('SQLite format 3')
  })

  it('rejects a malformed profileId with 400 instead of treating it as a path', async () => {
    const res = await fetch('/api/local-history/status?profileId=../../etc/passwd')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('不正なプロファイルID')
  })

  it('GET /api/local-history rejects a malformed profileId with 400 too', async () => {
    const res = await fetch('/api/local-history?profileId=not-a-uuid')
    expect(res.status).toBe(400)
  })
})
