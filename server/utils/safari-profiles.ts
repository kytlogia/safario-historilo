import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_DB_PATH,
  PROFILES_DIR,
  isValidProfileId,
  loadSqliteBindings,
  profileHistoryDbPath
} from './history-store'
import { DEFAULT_PROFILE_ID } from '../../shared/utils/profile'
import type { SafariProfile } from '../../shared/types/profile'

/**
 * Safari doesn't keep a simple "profile id -> display name" file anywhere
 * under ~/Library/Safari. The names actually live in the `bookmarks` table
 * of this SQLite database: each profile has a `type = 1, subtype = 2` row
 * at the tab-bar root whose `title` is the profile's display name and whose
 * `external_uuid` matches the profile's container directory name (or the
 * literal string `DefaultProfile` for the built-in unnamed profile).
 * Reverse-engineered by inspecting a real macOS/Safari install; this schema
 * is a private implementation detail Apple could change at any time, so
 * every read of it is best-effort (see readProfileNames below).
 */
export const SAFARI_TABS_DB_PATH = join(
  homedir(),
  'Library/Containers/com.apple.Safari/Data/Library/Safari/SafariTabs.db'
)

interface ListSafariProfilesOptions {
  profilesDir?: string
  safariTabsDbPath?: string
  /**
   * The default profile's dbPath, as reported by this listing. Callers that
   * have an H3 event should pass `resolveHistoryDbPath(event, DEFAULT_PROFILE_ID)`
   * here so this reflects a NUXT_HISTORY_DB_PATH override; otherwise it
   * falls back to the plain DEFAULT_DB_PATH.
   */
  defaultDbPath?: string
}

async function readProfileNames(safariTabsDbPath: string): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (!existsSync(safariTabsDbPath)) return names

  const sqlite = await loadSqliteBindings()
  if (!sqlite) return names

  try {
    const db = new sqlite.DatabaseSync(safariTabsDbPath, { readOnly: true })
    try {
      const rows = db
        .prepare(
          'SELECT title, external_uuid FROM bookmarks WHERE type = 1 AND subtype = 2 AND external_uuid IS NOT NULL'
        )
        .all() as { title: string | null; external_uuid: string }[]
      for (const row of rows) {
        if (row.title) names.set(row.external_uuid, row.title)
      }
    } finally {
      db.close()
    }
  } catch {
    // Best-effort only — see the SAFARI_TABS_DB_PATH comment above. Falling
    // back to an empty map means callers just label profiles by UUID.
  }
  return names
}

/**
 * Lists Safari profiles available for auto-load: the default (unnamed)
 * profile is always first, followed by any named profile whose container
 * directory actually holds a History.db (a profile UUID directory can exist
 * without one — e.g. extension-only sandboxes — if it's never browsed in).
 */
export async function listSafariProfiles(
  options: ListSafariProfilesOptions = {}
): Promise<SafariProfile[]> {
  const profilesDir = options.profilesDir ?? PROFILES_DIR
  const safariTabsDbPath = options.safariTabsDbPath ?? SAFARI_TABS_DB_PATH
  const defaultDbPath = options.defaultDbPath ?? DEFAULT_DB_PATH

  const names = await readProfileNames(safariTabsDbPath)
  const profiles: SafariProfile[] = [
    {
      id: DEFAULT_PROFILE_ID,
      name: names.get('DefaultProfile') || 'デフォルト',
      dbPath: defaultDbPath
    }
  ]

  if (!existsSync(profilesDir)) return profiles

  let entries: string[]
  try {
    // readdirSync's order is filesystem-dependent and not guaranteed, which
    // would otherwise make the profile list (and thus the UI picker's order)
    // shuffle unpredictably across runs. Sorting by UUID keeps it stable.
    entries = readdirSync(profilesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isValidProfileId(entry.name))
      .map((entry) => entry.name)
      .sort()
  } catch {
    return profiles
  }

  for (const profileId of entries) {
    const dbPath = profileHistoryDbPath(profileId, profilesDir)
    if (!existsSync(dbPath)) continue
    profiles.push({
      id: profileId,
      name: names.get(profileId) || `プロファイル (${profileId.slice(0, 8)})`,
      dbPath
    })
  }

  return profiles
}
