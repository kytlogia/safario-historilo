import { BRAVE_DIR } from './brave-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface BraveProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkBraveHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveBraveProfile(
  profileId?: string,
  options: BraveProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? BRAVE_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalBraveHistoryDb(
  profileId?: string,
  options: BraveProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('brave', profileId, {
    userDataDir: options.userDataDir ?? BRAVE_DIR,
    localStatePath: options.localStatePath
  })
}
