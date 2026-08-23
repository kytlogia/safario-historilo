import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const CHROME_DIR = join(homedir(), 'Library/Application Support/Google/Chrome')

interface ListChromeProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listChromeProfiles(
  options: ListChromeProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? CHROME_DIR,
    localStatePath: options.localStatePath
  })
}

export { resolveDefaultChromiumProfile as resolveDefaultChromeProfile } from './chromium-profiles'
