import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSqliteBindings } from './history-store'

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
