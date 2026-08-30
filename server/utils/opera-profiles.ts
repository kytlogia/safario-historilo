import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const OPERA_DIR = join(homedir(), 'Library/Application Support/com.operasoftware.Opera')

interface ListOperaProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listOperaProfiles(
  options: ListOperaProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? OPERA_DIR,
    localStatePath: options.localStatePath
  })
}
