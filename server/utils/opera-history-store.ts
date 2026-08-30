import { OPERA_DIR } from './opera-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface OperaProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkOperaHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveOperaProfile(
  profileId?: string,
  options: OperaProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? OPERA_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalOperaHistoryDb(
  profileId?: string,
  options: OperaProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('opera', profileId, {
    userDataDir: options.userDataDir ?? OPERA_DIR,
    localStatePath: options.localStatePath
  })
}
