import {
  checkDbFileAccess,
  HistoryDbNotFoundError,
  HistoryDbNotReadableError,
  unreadableDbHint
} from './history-store'
import { backupSqliteDatabaseToBuffer } from './sqlite-backup'
import { listFirefoxProfiles, resolveDefaultFirefoxProfile } from './firefox-profiles'
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
 *
 * Unlike Safari (where the default profile always has the fixed sentinel id
 * `DEFAULT_PROFILE_ID`, distinct from any real container UUID), a Firefox
 * profile's id *is* its raw profiles.ini `Path` value, and there is nothing
 * stopping a real profile from being named/pathed exactly `"default"` (e.g.
 * via `firefox -CreateProfile default`). Special-casing that literal string
 * to mean "use the default profile" would silently load the wrong profile's
 * history for such a user. So only a missing/empty profileId is treated as
 * "use the default profile" — any non-empty value is resolved strictly by
 * exact id match against the scanned list.
 */
export async function resolveFirefoxProfile(
  profileId?: string,
  options: ResolveFirefoxProfileOptions = {}
): Promise<FirefoxProfile | null> {
  const profiles = await listFirefoxProfiles(options)
  if (!profileId) {
    return resolveDefaultFirefoxProfile(profiles)
  }
  return profiles.find((p) => p.id === profileId) ?? null
}

export function checkFirefoxHistoryDbAccess(dbPath: string | null): {
  present: boolean
  readable: boolean
  path: string
} {
  return checkDbFileAccess(dbPath)
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
      `places.sqlite を読み取る権限がありません（${unreadableDbHint()}）: ${dbPath}`
    )
  }

  const buffer = await backupSqliteDatabaseToBuffer(dbPath, 'firefox-history-', 'places.sqlite')
  return { buffer, fileName: 'places.sqlite' }
}
