import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const BRAVE_DIR = join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser')

interface ListBraveProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listBraveProfiles(
  options: ListBraveProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? BRAVE_DIR,
    localStatePath: options.localStatePath
  })
}
