import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import type { FirefoxProfile } from '../../shared/types/profile'
import { promoteFirstAsDefaultIfNoneSet } from '../../shared/utils/profile'

/**
 * Firefox keeps profiles.ini (and, for relative Path entries, the profile
 * directories themselves) directly under this directory on both OSes — only
 * the directory itself differs: macOS uses the standard per-user
 * Application Support folder, Windows uses %APPDATA%\Mozilla\Firefox
 * (falling back to the conventional Roaming path if the env var is somehow
 * unset, which real Windows installs always set).
 *
 * `platform`/`appDataEnv` are only ever overridden by tests — exercising the
 * win32 branch on a non-Windows CI runner (and vice versa) without having to
 * mutate global `process` state.
 */
export function resolveFirefoxDir(
  platform: NodeJS.Platform = process.platform,
  appDataEnv: string | undefined = process.env.APPDATA
): string {
  if (platform === 'win32') {
    const appData = appDataEnv ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'Mozilla', 'Firefox')
  }
  return join(homedir(), 'Library/Application Support/Firefox')
}

export const FIREFOX_DIR = resolveFirefoxDir()
export const PROFILES_INI_PATH = join(FIREFOX_DIR, 'profiles.ini')

interface ProfilesIniEntry {
  name: string
  path: string
  isRelative: boolean
  isDefault: boolean
}

/**
 * profiles.ini is a plain Windows-style INI file (`[SectionName]` headers,
 * `key=value` lines) — no npm dependency is warranted for a format this
 * simple, so this is a minimal hand-rolled parser rather than a general-purpose one.
 */
function parseProfilesIni(content: string): ProfilesIniEntry[] {
  const entries: ProfilesIniEntry[] = []
  let section: string | null = null
  let current: Record<string, string> = {}

  const flush = () => {
    if (section?.startsWith('Profile') && current.Path) {
      entries.push({
        name: current.Name ?? section,
        path: current.Path,
        isRelative: current.IsRelative !== '0',
        isDefault: current.Default === '1'
      })
    }
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    const sectionMatch = line.match(/^\[(.+)\]$/)
    if (sectionMatch) {
      flush()
      section = sectionMatch[1] ?? null
      current = {}
      continue
    }

    const eqIndex = line.indexOf('=')
    if (eqIndex === -1) continue
    current[line.slice(0, eqIndex).trim()] = line.slice(eqIndex + 1).trim()
  }
  flush()

  return entries
}

function resolveProfileDir(entry: ProfilesIniEntry, firefoxDir: string): string {
  return entry.isRelative || !isAbsolute(entry.path) ? join(firefoxDir, entry.path) : entry.path
}

interface ListFirefoxProfilesOptions {
  profilesIniPath?: string
  firefoxDir?: string
}

/**
 * Lists Firefox profiles by parsing profiles.ini, keeping only entries whose
 * profile directory actually contains a places.sqlite (a profile can be
 * listed in profiles.ini without ever having been launched).
 *
 * The scan (rather than trusting a caller-supplied id directly) is what makes
 * profileId safe to resolve elsewhere: every id returned here is a value this
 * function itself produced from profiles.ini, never a raw path fragment
 * built from user input.
 */
export async function listFirefoxProfiles(
  options: ListFirefoxProfilesOptions = {}
): Promise<FirefoxProfile[]> {
  const profilesIniPath = options.profilesIniPath ?? PROFILES_INI_PATH
  const firefoxDir = options.firefoxDir ?? FIREFOX_DIR

  if (!existsSync(profilesIniPath)) return []

  let content: string
  try {
    content = await readFile(profilesIniPath, 'utf-8')
  } catch {
    return []
  }

  const profiles: FirefoxProfile[] = []
  for (const entry of parseProfilesIni(content)) {
    const dbPath = join(resolveProfileDir(entry, firefoxDir), 'places.sqlite')
    if (!existsSync(dbPath)) continue
    profiles.push({ id: entry.path, name: entry.name, dbPath, isDefault: entry.isDefault })
  }

  // profiles.ini doesn't guarantee any entry has `Default=1` — some Firefox
  // versions track the default profile separately (installs.ini) instead.
  // Fall back to the first profile with a readable places.sqlite so a
  // default is always available whenever at least one profile exists.
  promoteFirstAsDefaultIfNoneSet(profiles)

  return profiles
}

export function resolveDefaultFirefoxProfile(profiles: FirefoxProfile[]): FirefoxProfile | null {
  return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null
}
