import { accessSync, constants, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'

export const DEFAULT_DB_PATH = join(homedir(), 'Library/Safari/History.db')

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export class HistoryDbNotFoundError extends Error {}
export class HistoryDbNotReadableError extends Error {}

export function resolveHistoryDbPath(): string {
  return process.env.NUXT_HISTORY_DB_PATH || DEFAULT_DB_PATH
}

/**
 * `existsSync` alone can't tell us whether we're actually allowed to read the
 * file — on macOS, a process without Full Disk Access still sees `History.db`
 * in directory listings, but any real read fails with EPERM. Checking R_OK
 * up front lets the UI explain *why* auto-load isn't available instead of
 * surfacing a raw filesystem error only after the user clicks the button.
 */
export function checkHistoryDbAccess(): { present: boolean, readable: boolean } {
  const dbPath = resolveHistoryDbPath()
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

async function loadSqliteBindings() {
  try {
    const sqliteModule = await import('node:sqlite')
    if (typeof sqliteModule.DatabaseSync !== 'function' || typeof sqliteModule.backup !== 'function') {
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
  if (process.env.NUXT_HISTORY_DB_ALLOW_REMOTE === 'true') return

  const ip = getRequestIP(event, { xForwardedFor: false })
  if (!ip || !LOCALHOST_IPS.has(ip)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'このAPIはローカルホストからのアクセスのみ許可されています。'
    })
  }

  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    const host = getRequestHeader(event, 'host')
    let originHost: string | null = null
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

export async function readLocalHistoryDb(): Promise<{ buffer: Buffer, fileName: string }> {
  const dbPath = resolveHistoryDbPath()
  const { present, readable } = checkHistoryDbAccess()
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
    throw new Error('この環境では node:sqlite (Node.js 22.5以降) が利用できないため、自動読み込みに対応していません。')
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
