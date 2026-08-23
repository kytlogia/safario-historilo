import { accessSync, constants, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  HistoryDbNotFoundError,
  HistoryDbNotReadableError,
  loadSqliteBindings
} from './history-store'
import { listFirefoxProfiles, resolveDefaultFirefoxProfile } from './firefox-profiles'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'
import type { FirefoxProfile } from '../../shared/types/profile'

interface ResolveFirefoxProfileOptions {
  profilesIniPath?: string
  firefoxDir?: string
}

/**
 * `profileId` is the profile's `Path` value from profiles.ini (see
 * firefox-profiles.ts). Resolving it by re-scanning profiles.ini and matching
 * against that fresh list — rather than joining the raw query value onto a
 * directory — means an unrecognized or malicious profileId simply matches
 * nothing instead of ever reaching the filesystem.
 */
export async function resolveFirefoxProfile(
  profileId?: string,
  options: ResolveFirefoxProfileOptions = {}
): Promise<FirefoxProfile | null> {
  const profiles = await listFirefoxProfiles(options)
  if (!profileId || profileId === DEFAULT_PROFILE_ID) {
    return resolveDefaultFirefoxProfile(profiles)
  }
  return profiles.find((p) => p.id === profileId) ?? null
}

/**
 * `existsSync` alone can't tell us whether we're actually allowed to read the
 * file — see the equivalent comment on checkHistoryDbAccess() in
 * history-store.ts.
 */
export function checkFirefoxHistoryDbAccess(dbPath: string | null): {
  present: boolean
  readable: boolean
  path: string
} {
  if (!dbPath) return { present: false, readable: false, path: '' }
  if (!existsSync(dbPath)) return { present: false, readable: false, path: dbPath }
  try {
    accessSync(dbPath, constants.R_OK)
    return { present: true, readable: true, path: dbPath }
  } catch {
    return { present: true, readable: false, path: dbPath }
  }
}

export async function readLocalFirefoxHistoryDb(
  profileId?: string,
  options: ResolveFirefoxProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  const profile = await resolveFirefoxProfile(profileId, options)
  const { present, readable, path: dbPath } = checkFirefoxHistoryDbAccess(profile?.dbPath ?? null)
  if (!present) {
    throw new HistoryDbNotFoundError(
      `places.sqlite が見つかりませんでした: ${dbPath || '(Firefoxのプロファイルが見つかりません)'}`
    )
  }
  if (!readable) {
    throw new HistoryDbNotReadableError(
      `places.sqlite を読み取る権限がありません（macOSの場合、実行プロセスに「フルディスクアクセス」権限が必要です）: ${dbPath}`
    )
  }

  const sqlite = await loadSqliteBindings()
  if (!sqlite) {
    throw new Error(
      'この環境では node:sqlite (Node.js 22.5以降) が利用できないため、自動読み込みに対応していません。'
    )
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'firefox-history-'))
  const tempDbPath = join(tempDir, 'places.sqlite')

  try {
    // Mirrors readLocalHistoryDb() in history-store.ts: a WAL-safe hot copy
    // via SQLite's Online Backup API, since Firefox may be running and
    // writing to places.sqlite's WAL concurrently — see that function's
    // comment for the full rationale.
    const sourceDb = new sqlite.DatabaseSync(dbPath, { readOnly: true })
    try {
      await sqlite.backup(sourceDb, tempDbPath)
    } finally {
      sourceDb.close()
    }

    const backupDb = new sqlite.DatabaseSync(tempDbPath)
    try {
      backupDb.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally {
      backupDb.close()
    }

    return { buffer: await readFile(tempDbPath), fileName: 'places.sqlite' }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}
