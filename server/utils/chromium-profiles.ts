import { existsSync } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChromiumProfile } from '../../shared/types/profile'
import { promoteFirstAsDefaultIfNoneSet } from '../../shared/utils/profile'

export type ChromiumBrand = 'chrome' | 'edge'

/**
 * Chrome and Edge are both Chromium-based and keep an identical profile
 * layout under their own user data directory: a `Local State` JSON file
 * (whose `profile.info_cache` maps each profile's directory name to display
 * metadata) alongside the profile directories themselves (`Default`,
 * `Profile 1`, ...), each holding a `History` SQLite file. Only the user
 * data directory itself differs between the two brands.
 */
interface ChromiumProfileInfoCacheEntry {
  name?: string
}

interface ChromiumLocalState {
  profile?: {
    info_cache?: Record<string, ChromiumProfileInfoCacheEntry>
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readLocalState(localStatePath: string): Promise<ChromiumLocalState | null> {
  if (!existsSync(localStatePath)) return null
  try {
    const content = await readFile(localStatePath, 'utf-8')
    return JSON.parse(content) as ChromiumLocalState
  } catch {
    return null
  }
}

interface ListChromiumProfilesOptions {
  userDataDir: string
  localStatePath?: string
}

/**
 * `Local State` is a JSON file Chrome/Edge itself writes, but it's still
 * arbitrary data by the time it reaches here — a directory name from
 * `profile.info_cache` gets `join()`-ed straight onto userDataDir below, so a
 * key containing a path separator or a `..` segment could otherwise escape
 * userDataDir entirely (and `profileId` in the API routes resolves against
 * this exact same list, so a path-escaping id here would become a path
 * traversal there too). Real Chrome/Edge profile directory names are always
 * one plain path segment (`Default`, `Profile 1`, ...), so rejecting
 * anything else is a safe filter, not a compatibility risk.
 */
function isValidProfileDirName(name: string): boolean {
  return name !== '' && name !== '.' && name !== '..' && !name.includes('/') && !name.includes('\\')
}

/**
 * Lists profiles by reading `Local State`'s `profile.info_cache`, keeping
 * only entries whose profile directory actually contains a `History` file (a
 * profile can be listed without ever having been browsed in). Falls back to
 * just `Default` — the profile directory every Chrome/Edge install always
 * creates — when `Local State` is missing or unparsable, so auto-load still
 * works for the common single-profile case.
 *
 * The scan (rather than trusting a caller-supplied id directly) is what makes
 * profileId safe to resolve elsewhere: every id returned here is a directory
 * name this function itself found under userDataDir, never a raw path
 * fragment built from user input. See resolveChromiumProfile in
 * chromium-history-store.ts.
 */
export async function listChromiumProfiles(
  options: ListChromiumProfilesOptions
): Promise<ChromiumProfile[]> {
  const { userDataDir } = options
  const localStatePath = options.localStatePath ?? join(userDataDir, 'Local State')

  const localState = await readLocalState(localStatePath)
  const infoCache = localState?.profile?.info_cache
  const dirNames = (infoCache ? Object.keys(infoCache) : ['Default']).filter(isValidProfileDirName)

  // Checked concurrently via the async fs API rather than a sequential
  // existsSync() loop — this runs inside a Nitro request handler, where a
  // synchronous stat call per profile directory would otherwise block the
  // event loop from servicing other concurrent requests.
  const dbPaths = dirNames.map((dirName) => join(userDataDir, dirName, 'History'))
  const dbPathExists = await Promise.all(dbPaths.map((dbPath) => pathExists(dbPath)))

  const profiles: ChromiumProfile[] = []
  dirNames.forEach((dirName, i) => {
    if (!dbPathExists[i]) return
    profiles.push({
      id: dirName,
      name: infoCache?.[dirName]?.name || dirName,
      dbPath: dbPaths[i]!,
      isDefault: dirName === 'Default'
    })
  })

  // Local State doesn't guarantee a "Default" entry survives in info_cache
  // (e.g. it was deleted/renamed), so fall back to the first profile with a
  // readable History so a default is always available whenever at least one
  // profile exists — mirrors resolveDefaultFirefoxProfile's fallback.
  promoteFirstAsDefaultIfNoneSet(profiles)

  return profiles
}

export function resolveDefaultChromiumProfile(profiles: ChromiumProfile[]): ChromiumProfile | null {
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null
}
