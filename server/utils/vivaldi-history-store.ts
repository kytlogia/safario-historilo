import { VIVALDI_DIR } from './vivaldi-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface VivaldiProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkVivaldiHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveVivaldiProfile(
  profileId?: string,
  options: VivaldiProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? VIVALDI_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalVivaldiHistoryDb(
  profileId?: string,
  options: VivaldiProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('vivaldi', profileId, {
    userDataDir: options.userDataDir ?? VIVALDI_DIR,
    localStatePath: options.localStatePath
  })
}
