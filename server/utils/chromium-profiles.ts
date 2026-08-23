import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ChromiumProfile } from '../../shared/types/profile'

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
  const dirNames = infoCache ? Object.keys(infoCache) : ['Default']

  const profiles: ChromiumProfile[] = []
  for (const dirName of dirNames) {
    const dbPath = join(userDataDir, dirName, 'History')
    if (!existsSync(dbPath)) continue
    profiles.push({
      id: dirName,
      name: infoCache?.[dirName]?.name || dirName,
      dbPath,
      isDefault: dirName === 'Default'
    })
  }

  // Local State doesn't guarantee a "Default" entry survives in info_cache
  // (e.g. it was deleted/renamed), so fall back to the first profile with a
  // readable History so a default is always available whenever at least one
  // profile exists — mirrors resolveDefaultFirefoxProfile's fallback.
  if (profiles.length > 0 && !profiles.some((p) => p.isDefault)) {
    profiles[0]!.isDefault = true
  }

  return profiles
}

export function resolveDefaultChromiumProfile(profiles: ChromiumProfile[]): ChromiumProfile | null {
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null
}
