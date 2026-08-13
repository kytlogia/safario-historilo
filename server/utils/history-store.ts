import { existsSync, mkdtempSync, copyFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import type { H3Event } from 'h3'

export const DEFAULT_DB_PATH = join(homedir(), 'Library/Safari/History.db')

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export class HistoryDbNotFoundError extends Error {}

export function resolveHistoryDbPath(): string {
  return process.env.NUXT_HISTORY_DB_PATH || DEFAULT_DB_PATH
}

export function isHistoryDbFilePresent(): boolean {
  return existsSync(resolveHistoryDbPath())
}

async function loadDatabaseSyncCtor() {
  try {
    const sqliteModule = await import('node:sqlite')
    return typeof sqliteModule.DatabaseSync === 'function' ? sqliteModule.DatabaseSync : null
  } catch {
    return null
  }
}

export async function isNodeSqliteSupported(): Promise<boolean> {
  return (await loadDatabaseSyncCtor()) !== null
}

/**
 * History.db bytes are local, personal browsing data — never serve them (or
 * even confirm their existence) to a caller that isn't the local machine,
 * even if this Nitro server ends up bound to a LAN/WAN interface.
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
}

export async function readLocalHistoryDb(): Promise<{ buffer: Buffer, fileName: string }> {
  const dbPath = resolveHistoryDbPath()
  if (!existsSync(dbPath)) {
    throw new HistoryDbNotFoundError(`History.db が見つかりませんでした: ${dbPath}`)
  }

  const DatabaseSync = await loadDatabaseSyncCtor()
  if (!DatabaseSync) {
    throw new Error('この環境では node:sqlite (Node.js 22.5以降) が利用できないため、自動読み込みに対応していません。')
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'safari-history-'))
  const tempDbPath = join(tempDir, 'History.db')

  try {
    copyFileSync(dbPath, tempDbPath)
    for (const suffix of ['-wal', '-shm']) {
      const source = `${dbPath}${suffix}`
      if (existsSync(source)) {
        copyFileSync(source, `${tempDbPath}${suffix}`)
      }
    }

    // Merge any pending WAL entries into the copied file so the plain
    // .db bytes we hand back are self-contained (no separate -wal/-shm
    // files needed on the client side).
    const db = new DatabaseSync(tempDbPath)
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally {
      db.close()
    }

    return { buffer: readFileSync(tempDbPath), fileName: 'History.db' }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
