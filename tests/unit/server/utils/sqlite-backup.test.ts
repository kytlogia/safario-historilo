// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupSqliteDatabaseToBuffer } from '../../../../server/utils/sqlite-backup'
import { HistoryDbLockedError } from '../../../../server/utils/history-store'

let dir: string
let dbPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sqlite-backup-test-'))
  dbPath = join(dir, 'source.db')
  const db = new DatabaseSync(dbPath)
  db.exec('CREATE TABLE t (a INTEGER)')
  db.exec('INSERT INTO t VALUES (1)')
  db.close()
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('backupSqliteDatabaseToBuffer', () => {
  it('returns a hot copy of the database when it is not locked', async () => {
    const buffer = await backupSqliteDatabaseToBuffer(dbPath, 'sqlite-backup-test-', 'dest.db')
    expect(buffer.subarray(0, 16).toString('utf8')).toBe('SQLite format 3\0')
  })

  // Regression test for issue #180: node:sqlite's backup() has a known bug
  // where a lock held by another process (e.g. a running Chrome instance)
  // surfaces as an Error whose message is "not an error" — see
  // isLockedDbErrorSignature in sqlite-backup.ts. This reproduces that exact
  // failure (a concurrent EXCLUSIVE transaction holding the write lock) and
  // asserts it's turned into a HistoryDbLockedError with an actionable
  // Japanese message instead of leaking the meaningless upstream message.
  it('throws HistoryDbLockedError with a helpful message when the source db is locked', async () => {
    const locker = new DatabaseSync(dbPath)
    locker.exec('BEGIN EXCLUSIVE')
    locker.exec('INSERT INTO t VALUES (2)')
    try {
      await expect(
        backupSqliteDatabaseToBuffer(dbPath, 'sqlite-backup-test-', 'dest.db')
      ).rejects.toThrow(HistoryDbLockedError)
      await expect(
        backupSqliteDatabaseToBuffer(dbPath, 'sqlite-backup-test-', 'dest.db')
      ).rejects.toThrow(/ブラウザを終了してから再試行してください/)
    } finally {
      locker.exec('ROLLBACK')
      locker.close()
    }
  })
})
