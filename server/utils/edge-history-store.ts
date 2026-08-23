import { EDGE_DIR } from './edge-profiles'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from './chromium-history-store'
import type { ChromiumProfile } from '../../shared/types/profile'

interface EdgeProfileOptions {
  userDataDir?: string
  localStatePath?: string
}

export function checkEdgeHistoryDbAccess(dbPath: string | null) {
  return checkChromiumHistoryDbAccess(dbPath)
}

export async function resolveEdgeProfile(
  profileId?: string,
  options: EdgeProfileOptions = {}
): Promise<ChromiumProfile | null> {
  return resolveChromiumProfile(profileId, {
    userDataDir: options.userDataDir ?? EDGE_DIR,
    localStatePath: options.localStatePath
  })
}

export async function readLocalEdgeHistoryDb(
  profileId?: string,
  options: EdgeProfileOptions = {}
): Promise<{ buffer: Buffer; fileName: string }> {
  return readLocalChromiumHistoryDb('edge', profileId, {
    userDataDir: options.userDataDir ?? EDGE_DIR,
    localStatePath: options.localStatePath
  })
}
