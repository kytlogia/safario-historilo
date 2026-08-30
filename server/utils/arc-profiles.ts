import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const ARC_DIR = join(homedir(), 'Library/Application Support/Arc/User Data')

interface ListArcProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listArcProfiles(
  options: ListArcProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? ARC_DIR,
    localStatePath: options.localStatePath
  })
}
