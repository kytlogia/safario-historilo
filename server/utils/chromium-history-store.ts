import { accessSync, constants, existsSync } from 'node:fs'
import { HistoryDbNotFoundError, HistoryDbNotReadableError } from './history-store'
import { backupSqliteDatabaseToBuffer } from './sqlite-backup'
import { listChromiumProfiles, resolveDefaultChromiumProfile } from './chromium-profiles'
import type { ChromiumBrand } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

interface ChromiumProfileOptions {
  userDataDir: string
  localStatePath?: string
}

/**
 * `profileId` is a profile's directory name (see chromium-profiles.ts, e.g.
 * `Default` or `Profile 1`). Resolving it by re-scanning the user data
 * directory and matching against that fresh list — rather than joining the
 * raw query value onto a directory — means an unrecognized or malicious
 * profileId simply matches nothing instead of ever reaching the filesystem.
 * Mirrors resolveFirefoxProfile in firefox-history-store.ts.
 */
export async function resolveChromiumProfile(
  profileId: string | undefined,
  options: ChromiumProfileOptions
): Promise<ChromiumProfile | null> {
  const profiles = await listChromiumProfiles(options)
  if (!profileId) {
    return resolveDefaultChromiumProfile(profiles)
  }
  return profiles.find((p) => p.id === profileId) ?? null
}

/**
 * `existsSync` alone can't tell us whether we're actually allowed to read the
 * file — see the equivalent comment on checkHistoryDbAccess() in
 * history-store.ts.
 */
export function checkChromiumHistoryDbAccess(dbPath: string | null): {
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

export async function readLocalChromiumHistoryDb(
  brand: ChromiumBrand,
  profileId: string | undefined,
  options: ChromiumProfileOptions
): Promise<{ buffer: Buffer; fileName: string }> {
  const profile = await resolveChromiumProfile(profileId, options)
  const { present, readable, path: dbPath } = checkChromiumHistoryDbAccess(profile?.dbPath ?? null)
  if (!present) {
    throw new HistoryDbNotFoundError(
      `History が見つかりませんでした: ${dbPath || '(プロファイルが見つかりません)'}`
    )
  }
  if (!readable) {
    throw new HistoryDbNotReadableError(
      `History を読み取る権限がありません（macOSの場合、実行プロセスに「フルディスクアクセス」権限が必要です）: ${dbPath}`
    )
  }

  const buffer = await backupSqliteDatabaseToBuffer(dbPath, `${brand}-history-`, 'History')
  return { buffer, fileName: 'History' }
}
