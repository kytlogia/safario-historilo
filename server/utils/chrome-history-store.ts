import { CHROME_DIR } from './chrome-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface ChromeProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkChromeHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveChromeProfile(
  profileId?: string,
  options: ChromeProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? CHROME_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalChromeHistoryDb(
  profileId?: string,
  options: ChromeProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('chrome', profileId, {
    userDataDir: options.userDataDir ?? CHROME_DIR,
    localStatePath: options.localStatePath
  })
}
