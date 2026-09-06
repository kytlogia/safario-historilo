import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryDbLockedError, loadSqliteBindings } from './history-store'

/**
 * `node:sqlite`'s backup() has a known bug: when it fails because another
 * process (a running browser) holds a lock on the source database, it
 * throws an `Error` whose message/errstr is the string SQLite normally uses
 * for *success* ("not an error") instead of the real SQLITE_BUSY/LOCKED
 * text — `errcode` comes back `0` (SQLITE_OK) too, so the genuine error code
 * is unrecoverable from the thrown error. This checks for that exact,
 * otherwise-meaningless signature so we can report the (near-certain, given
 * the source file already passed a readability check) real cause instead of
 * surfacing "not an error" straight to the user.
 */
function isLockedDbErrorSignature(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as NodeJS.ErrnoException & { errcode?: number }).code === 'ERR_SQLITE_ERROR' &&
    (err as { errcode?: number }).errcode === 0
  )
}

/**
 * Takes a WAL-safe hot copy of a live SQLite database via SQLite's own
 * Online Backup API (`node:sqlite`'s `backup()`), rather than manually
 * copying the main file plus its `-wal`/`-shm` siblings. A hand-rolled
 * multi-file copy can race with the source process's own writes (it may
 * write to the WAL mid-copy), producing an inconsistent snapshot; the
 * backup API instead reads a logically consistent view of the live
 * database even while it's still being written to.
 *
 * Shared by history-store.ts (Safari's History.db) and
 * firefox-history-store.ts (Firefox's places.sqlite) — the procedure itself
 * is identical for both, only the source path and destination filename
 * differ.
 */
export async function backupSqliteDatabaseToBuffer(
  sourcePath: string,
  tempDirPrefix: string,
  destFileName: string
): Promise<Buffer> {
  const sqlite = await loadSqliteBindings()
  if (!sqlite) {
    throw new Error(
      'この環境では node:sqlite (Node.js 22.5以降) が利用できないため、自動読み込みに対応していません。'
    )
  }

  const tempDir = await mkdtemp(join(tmpdir(), tempDirPrefix))
  const tempDbPath = join(tempDir, destFileName)

  try {
    const sourceDb = new sqlite.DatabaseSync(sourcePath, { readOnly: true })
    try {
      await sqlite.backup(sourceDb, tempDbPath)
    } catch (err) {
      if (isLockedDbErrorSignature(err)) {
        throw new HistoryDbLockedError(
          'ブラウザが起動中でデータベースが使用中のため、履歴を読み込めませんでした。ブラウザを終了してから再試行してください。'
        )
      }
      throw err
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

    return await readFile(tempDbPath)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
