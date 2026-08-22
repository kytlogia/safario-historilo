import { accessSync, constants, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'

export const DEFAULT_DB_PATH = join(homedir(), 'Library/Safari/History.db')

/**
 * Safari 17+'s "profile" feature (separate profiles per use case) keeps each profile's
 * browsing data in its own sandboxed container directory, isolated from the
 * unnamed default profile at DEFAULT_DB_PATH.
 */
export const PROFILES_DIR = join(
  homedir(),
  'Library/Containers/com.apple.Safari/Data/Library/Safari/Profiles'
)

const PROFILE_ID_PATTERN =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

/**
 * A profile id ultimately becomes a path segment (see profileHistoryDbPath
 * below), and it can arrive from an untrusted query string
 * (`?profileId=...`). Restricting it to Safari's own UUID shape up front
 * blocks path traversal (`../../etc/passwd`) rather than relying on `join`'s
 * behavior to save us.
 */
export function isValidProfileId(id: string): boolean {
  return PROFILE_ID_PATTERN.test(id)
}

export function profileHistoryDbPath(profileId: string): string {
  return join(PROFILES_DIR, profileId, 'History.db')
}

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export class HistoryDbNotFoundError extends Error {}
export class HistoryDbNotReadableError extends Error {}

/**
 * Node's filesystem APIs don't expand `~` to the home directory the way a
 * shell does, so a configured path of `~/Library/Safari/History.db` would
 * otherwise be looked up literally under a directory named `~`.
 */
function expandTilde(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}

/**
 * `profileId` selects one of Safari's named profiles (its container UUID)
 * instead of the default, unnamed profile. It's omitted or `'default'` for
 * the classic single-profile setup, which keeps the existing
 * `NUXT_HISTORY_DB_PATH` override behaving exactly as before.
 */
export function resolveHistoryDbPath(event: H3Event, profileId?: string): string {
  if (profileId && profileId !== 'default') {
    if (!isValidProfileId(profileId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: '不正なプロファイルIDです。'
      })
    }
    return profileHistoryDbPath(profileId)
  }
  const configuredPath = useRuntimeConfig(event).historyDbPath
  return configuredPath ? expandTilde(configuredPath) : DEFAULT_DB_PATH
}

/**
 * `existsSync` alone can't tell us whether we're actually allowed to read the
 * file — on macOS, a process without Full Disk Access still sees `History.db`
 * in directory listings, but any real read fails with EPERM. Checking R_OK
 * up front lets the UI explain *why* auto-load isn't available instead of
 * surfacing a raw filesystem error only after the user clicks the button.
 */
export function checkHistoryDbAccess(
  event: H3Event,
  profileId?: string
): { present: boolean; readable: boolean } {
  const dbPath = resolveHistoryDbPath(event, profileId)
  if (!existsSync(dbPath)) {
    return { present: false, readable: false }
  }
  try {
    accessSync(dbPath, constants.R_OK)
    return { present: true, readable: true }
  } catch {
    return { present: true, readable: false }
  }
}

export async function loadSqliteBindings() {
  try {
    const sqliteModule = await import('node:sqlite')
    if (
      typeof sqliteModule.DatabaseSync !== 'function' ||
      typeof sqliteModule.backup !== 'function'
    ) {
      return null
    }
    return sqliteModule
  } catch {
    return null
  }
}

export async function isNodeSqliteSupported(): Promise<boolean> {
  return (await loadSqliteBindings()) !== null
}

export const TRUST_DEV_PROXY_ENV_VAR = 'NUXT_HISTORY_DB_TRUST_DEV_PROXY'

/**
 * `nuxt dev` proxies requests to this handler through an internal loopback
 * hop (nitropack's `createHTTPProxy`), which loses the original socket and
 * makes `event.node.req.socket.remoteAddress` (and therefore `getRequestIP`
 * with `xForwardedFor: false`) come back `undefined` even for genuine
 * 127.0.0.1/::1 requests.
 *
 * It's tempting to fall back to trusting `x-forwarded-for` whenever
 * `import.meta.dev` is true, but that alone is NOT safe: nitropack's dev
 * proxy only sets that header when the incoming request doesn't already
 * have one (`if (!proxyReq.hasHeader('x-forwarded-for'))`), so a raw,
 * non-browser client (curl, a script — the Origin check below only applies
 * to browsers) can just send its own `X-Forwarded-For: 127.0.0.1` and it
 * passes straight through unmodified. Verified locally: running `nuxt dev
 * --host 0.0.0.0` and hitting the machine's LAN address with that header
 * from another host on the network returns 200. `import.meta.dev` can't
 * distinguish "my own browser hitting localhost" from "an attacker on the
 * LAN" — by the time either request reaches us, both present the exact same
 * empty/proxied socket.
 *
 * So this fallback is opt-in only, via `NUXT_HISTORY_DB_TRUST_DEV_PROXY=true`,
 * for a developer who has deliberately set it in their own local dev
 * environment. It's off by default — meaning a plain `nuxt dev` (or `nuxt
 * dev --host`) is exactly as strict as before this fallback existed unless
 * a developer explicitly turns it on — and `import.meta.dev` compiles to
 * `false` in production builds regardless, so this can never activate
 * outside a dev server.
 */
function resolveClientIp(event: H3Event): string | null {
  const socketIp = getRequestIP(event, { xForwardedFor: false })
  if (socketIp) return socketIp
  if (import.meta.dev && useRuntimeConfig(event).historyDbTrustDevProxy === true) {
    return getRequestIP(event, { xForwardedFor: true }) ?? null
  }
  return null
}

/**
 * History.db bytes are local, personal browsing data — never serve them (or
 * even confirm their existence) to a caller that isn't this app's own page,
 * even if this Nitro server ends up bound to a LAN/WAN interface.
 *
 * Checking the source IP alone isn't enough: any page open in the same
 * browser (a different tab, an ad, etc.) can `fetch('http://localhost:PORT/...')`
 * and that request still originates from 127.0.0.1. Cross-origin script
 * can't read the response body thanks to the same-origin policy, but the
 * expensive backup/copy work would still run as a side effect and the
 * request's timing could leak whether History.db exists. Rejecting a
 * mismatched Origin (when the browser sends one) closes that gap while
 * still allowing this app's own same-origin fetches and non-browser
 * clients (e.g. curl) that don't send an Origin header at all.
 */
export function assertLocalRequest(event: H3Event) {
  if (useRuntimeConfig(event).historyDbAllowRemote === true) return

  const ip = resolveClientIp(event)
  if (!ip || !LOCALHOST_IPS.has(ip)) {
    const isUnresolvedDevProxyRequest =
      import.meta.dev && !getRequestIP(event, { xForwardedFor: false })
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: isUnresolvedDevProxyRequest
        ? `開発サーバーの制限により自動読み込みが利用できません。ローカルの nuxt dev だとわかっている場合は、環境変数 ${TRUST_DEV_PROXY_ENV_VAR}=true を設定すると有効になります。`
        : 'このAPIはローカルホストからのアクセスのみ許可されています。'
    })
  }

  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    const host = getRequestHeader(event, 'host')
    let originHost: string | null
    try {
      originHost = new URL(origin).host
    } catch {
      originHost = null
    }
    if (!host || originHost !== host) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden',
        message: 'このAPIは同一オリジンからのアクセスのみ許可されています。'
      })
    }
  }
}

export async function readLocalHistoryDb(
  event: H3Event,
  profileId?: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const dbPath = resolveHistoryDbPath(event, profileId)
  const { present, readable } = checkHistoryDbAccess(event, profileId)
  if (!present) {
    throw new HistoryDbNotFoundError(`History.db が見つかりませんでした: ${dbPath}`)
  }
  if (!readable) {
    throw new HistoryDbNotReadableError(
      `History.db を読み取る権限がありません（macOSの場合、実行プロセスに「フルディスクアクセス」権限が必要です）: ${dbPath}`
    )
  }

  const sqlite = await loadSqliteBindings()
  if (!sqlite) {
    throw new Error(
      'この環境では node:sqlite (Node.js 22.5以降) が利用できないため、自動読み込みに対応していません。'
    )
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'safari-history-'))
  const tempDbPath = join(tempDir, 'History.db')

  try {
    // Take a WAL-safe hot copy via SQLite's own Online Backup API instead of
    // manually copying History.db/-wal/-shm as separate files. A hand-rolled
    // multi-file copy can race with Safari's own writes (Safari may write to
    // the WAL mid-copy), producing an inconsistent snapshot; the backup API
    // reads a logically consistent view of the live database even while
    // Safari keeps writing to it.
    const sourceDb = new sqlite.DatabaseSync(dbPath, { readOnly: true })
    try {
      await sqlite.backup(sourceDb, tempDbPath)
    } finally {
      sourceDb.close()
    }

    // The backup can itself land in WAL mode with pending frames; checkpoint
    // it so the bytes we hand back are a single self-contained file. This is
    // safe (no race) because tempDbPath is our own private copy that nothing
    // else writes to.
    const backupDb = new sqlite.DatabaseSync(tempDbPath)
    try {
      backupDb.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally {
      backupDb.close()
    }

    return { buffer: await readFile(tempDbPath), fileName: 'History.db' }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
