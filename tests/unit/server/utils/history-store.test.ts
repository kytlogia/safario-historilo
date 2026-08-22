// Under Vitest's global `jsdom` environment (vitest.config.ts), Vite resolves
// this file through its browser/client environment rather than the ssr one,
// which does not apply vitest.config.ts's `define: { 'import.meta.dev': 'true' }`
// — so it evaluates to `undefined` and the dev-proxy branch under test
// (server/utils/history-store.ts's `resolveClientIp`) never triggers. Forcing
// `node` here (this file has no DOM dependency anyway) keeps that define intact.
// @vitest-environment node
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as historyStore from '../../../../server/utils/history-store'

// Derive the event type from the module under test instead of importing 'h3'
// directly, since h3 is only a transitive dependency here (Nitro's own copy).
type Event = Parameters<typeof historyStore.resolveHistoryDbPath>[0]

// server/utils/history-store.ts relies on Nitro's auto-imported globals
// (useRuntimeConfig/getRequestIP/getRequestHeader/createError) rather than
// explicit imports. Stub them so the module can be exercised directly under
// plain Vitest, with full control over the inputs that matter for these
// security-boundary checks.
interface RuntimeConfigStub {
  historyDbPath: string
  historyDbAllowRemote: boolean
  historyDbTrustDevProxy: boolean
}

const defaultRuntimeConfig = (): RuntimeConfigStub => ({
  historyDbPath: '',
  historyDbAllowRemote: false,
  historyDbTrustDevProxy: false
})

let runtimeConfig: RuntimeConfigStub
let socketIp: string | undefined
let xffIp: string | undefined
let requestHeaders: Record<string, string | undefined>

class FakeH3Error extends Error {
  statusCode?: number
  statusMessage?: string
}

beforeEach(() => {
  runtimeConfig = defaultRuntimeConfig()
  socketIp = '127.0.0.1'
  xffIp = undefined
  requestHeaders = {}

  vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)
  vi.stubGlobal('getRequestIP', (_event: Event, opts: { xForwardedFor?: boolean }) =>
    opts?.xForwardedFor ? xffIp : socketIp
  )
  vi.stubGlobal(
    'getRequestHeader',
    (_event: Event, name: string) => requestHeaders[name.toLowerCase()]
  )
  vi.stubGlobal(
    'createError',
    (opts: { statusCode: number; statusMessage?: string; message?: string }) => {
      const err = new FakeH3Error(opts.message ?? opts.statusMessage ?? 'Error')
      err.statusCode = opts.statusCode
      err.statusMessage = opts.statusMessage
      return err
    }
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeEvent(): Event {
  return {} as Event
}

const {
  DEFAULT_DB_PATH,
  PROFILES_DIR,
  resolveHistoryDbPath,
  checkHistoryDbAccess,
  assertLocalRequest,
  readLocalHistoryDb,
  isNodeSqliteSupported,
  isValidProfileId,
  profileHistoryDbPath,
  HistoryDbNotFoundError,
  HistoryDbNotReadableError
} = historyStore

describe('resolveHistoryDbPath', () => {
  it('falls back to DEFAULT_DB_PATH when NUXT_HISTORY_DB_PATH is unset', () => {
    expect(DEFAULT_DB_PATH).toBe(join(homedir(), 'Library/Safari/History.db'))
    expect(resolveHistoryDbPath(fakeEvent())).toBe(DEFAULT_DB_PATH)
  })

  it('uses the configured path when set', () => {
    runtimeConfig.historyDbPath = '/custom/History.db'
    expect(resolveHistoryDbPath(fakeEvent())).toBe('/custom/History.db')
  })

  it('expands a leading ~/ to the home directory', () => {
    runtimeConfig.historyDbPath = '~/Library/Safari/History.db'
    expect(resolveHistoryDbPath(fakeEvent())).toBe(DEFAULT_DB_PATH)
  })

  it('expands a bare ~ to the home directory', () => {
    runtimeConfig.historyDbPath = '~'
    expect(resolveHistoryDbPath(fakeEvent())).toBe(homedir())
  })

  it('treats profileId "default" the same as no profileId (still honors the env override)', () => {
    runtimeConfig.historyDbPath = '/custom/History.db'
    expect(resolveHistoryDbPath(fakeEvent(), 'default')).toBe('/custom/History.db')
  })

  it('resolves a valid profile UUID to its container path, ignoring the env override', () => {
    runtimeConfig.historyDbPath = '/custom/History.db'
    const profileId = '11111111-1111-1111-1111-111111111111'
    expect(resolveHistoryDbPath(fakeEvent(), profileId)).toBe(
      join(PROFILES_DIR, profileId, 'History.db')
    )
  })

  it('rejects a malformed profileId with a 400 error instead of building a path from it', () => {
    try {
      resolveHistoryDbPath(fakeEvent(), '../../etc/passwd')
      expect.unreachable('expected resolveHistoryDbPath to throw')
    } catch (err) {
      const e = err as FakeH3Error
      expect(e.statusCode).toBe(400)
    }
  })
})

describe('isValidProfileId', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidProfileId('11111111-1111-1111-1111-111111111111')).toBe(true)
  })

  it('rejects non-UUID strings, including path traversal attempts', () => {
    expect(isValidProfileId('default')).toBe(false)
    expect(isValidProfileId('../../etc/passwd')).toBe(false)
    expect(isValidProfileId('')).toBe(false)
  })
})

describe('profileHistoryDbPath', () => {
  it('joins the profile id onto PROFILES_DIR', () => {
    const profileId = '11111111-1111-1111-1111-111111111111'
    expect(profileHistoryDbPath(profileId)).toBe(join(PROFILES_DIR, profileId, 'History.db'))
  })
})

describe('checkHistoryDbAccess', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'history-store-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('reports present:false, readable:false when the file does not exist', () => {
    runtimeConfig.historyDbPath = join(dir, 'missing.db')
    expect(checkHistoryDbAccess(fakeEvent())).toEqual({ present: false, readable: false })
  })

  it('reports present:true, readable:true for a normal, readable file', async () => {
    const dbPath = join(dir, 'History.db')
    await writeFile(dbPath, 'dummy')
    runtimeConfig.historyDbPath = dbPath
    expect(checkHistoryDbAccess(fakeEvent())).toEqual({ present: true, readable: true })
  })

  it('reports present:true, readable:false when the file exists but is not readable', async () => {
    if (process.getuid?.() === 0) return // root bypasses permission bits
    const dbPath = join(dir, 'History.db')
    await writeFile(dbPath, 'dummy')
    await chmod(dbPath, 0o000)
    runtimeConfig.historyDbPath = dbPath
    expect(checkHistoryDbAccess(fakeEvent())).toEqual({ present: true, readable: false })
    await chmod(dbPath, 0o600) // restore so rm() can clean up
  })
})

describe('assertLocalRequest', () => {
  it('allows requests from 127.0.0.1', () => {
    socketIp = '127.0.0.1'
    expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
  })

  it('allows requests from ::1', () => {
    socketIp = '::1'
    expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
  })

  it('rejects a non-localhost source IP with 403', () => {
    socketIp = '203.0.113.5'
    try {
      assertLocalRequest(fakeEvent())
      expect.unreachable('expected assertLocalRequest to throw')
    } catch (err) {
      const e = err as FakeH3Error
      expect(e.statusCode).toBe(403)
      expect(e.message).toContain('ローカルホストからのアクセスのみ許可されています')
    }
  })

  it('rejects when Origin does not match Host, even from localhost', () => {
    socketIp = '127.0.0.1'
    requestHeaders.origin = 'https://evil.example.com'
    requestHeaders.host = 'localhost:3000'
    try {
      assertLocalRequest(fakeEvent())
      expect.unreachable('expected assertLocalRequest to throw')
    } catch (err) {
      const e = err as FakeH3Error
      expect(e.statusCode).toBe(403)
      expect(e.message).toContain('同一オリジンからのアクセスのみ許可されています')
    }
  })

  it('allows when Origin matches Host', () => {
    socketIp = '127.0.0.1'
    requestHeaders.origin = 'http://localhost:3000'
    requestHeaders.host = 'localhost:3000'
    expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
  })

  it('allows non-browser clients that send no Origin header at all', () => {
    socketIp = '127.0.0.1'
    requestHeaders.host = 'localhost:3000'
    expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
  })

  it('bypasses all checks when NUXT_HISTORY_DB_ALLOW_REMOTE=true', () => {
    runtimeConfig.historyDbAllowRemote = true
    socketIp = '203.0.113.5'
    requestHeaders.origin = 'https://evil.example.com'
    requestHeaders.host = 'localhost:3000'
    expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
  })

  describe('nuxt dev proxy (unresolved socket IP)', () => {
    beforeEach(() => {
      socketIp = undefined
    })

    it('rejects with a dev-proxy-specific message when the trust flag is not set', () => {
      try {
        assertLocalRequest(fakeEvent())
        expect.unreachable('expected assertLocalRequest to throw')
      } catch (err) {
        const e = err as FakeH3Error
        expect(e.statusCode).toBe(403)
        expect(e.message).toContain('NUXT_HISTORY_DB_TRUST_DEV_PROXY')
      }
    })

    it('bypasses via X-Forwarded-For when the trust flag is set and it resolves to localhost', () => {
      runtimeConfig.historyDbTrustDevProxy = true
      xffIp = '127.0.0.1'
      expect(() => assertLocalRequest(fakeEvent())).not.toThrow()
    })

    it('still rejects when the trust flag is set but X-Forwarded-For is not localhost', () => {
      runtimeConfig.historyDbTrustDevProxy = true
      xffIp = '198.51.100.9'
      try {
        assertLocalRequest(fakeEvent())
        expect.unreachable('expected assertLocalRequest to throw')
      } catch (err) {
        const e = err as FakeH3Error
        expect(e.statusCode).toBe(403)
      }
    })
  })
})

describe('readLocalHistoryDb', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'history-store-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('throws HistoryDbNotFoundError when the file does not exist', async () => {
    runtimeConfig.historyDbPath = join(dir, 'missing.db')
    await expect(readLocalHistoryDb(fakeEvent())).rejects.toBeInstanceOf(HistoryDbNotFoundError)
  })

  it('throws HistoryDbNotReadableError when the file exists but is not readable', async () => {
    if (process.getuid?.() === 0) return // root bypasses permission bits
    const dbPath = join(dir, 'History.db')
    await writeFile(dbPath, 'dummy')
    await chmod(dbPath, 0o000)
    runtimeConfig.historyDbPath = dbPath
    await expect(readLocalHistoryDb(fakeEvent())).rejects.toBeInstanceOf(HistoryDbNotReadableError)
    await chmod(dbPath, 0o600)
  })
})

describe('isNodeSqliteSupported', () => {
  it('resolves true on this Node.js runtime (>=22.5, node:sqlite available)', async () => {
    expect(await isNodeSqliteSupported()).toBe(true)
  })
})
