import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const VIVALDI_DIR = join(homedir(), 'Library/Application Support/Vivaldi')

interface ListVivaldiProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listVivaldiProfiles(
  options: ListVivaldiProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? VIVALDI_DIR,
    localStatePath: options.localStatePath
  })
}
