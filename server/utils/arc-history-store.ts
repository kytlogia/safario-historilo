import { ARC_DIR } from './arc-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface ArcProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkArcHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveArcProfile(
  profileId?: string,
  options: ArcProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? ARC_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalArcHistoryDb(
  profileId?: string,
  options: ArcProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('arc', profileId, {
    userDataDir: options.userDataDir ?? ARC_DIR,
    localStatePath: options.localStatePath
  })
}
