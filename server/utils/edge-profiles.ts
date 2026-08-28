import { homedir } from 'node:os'
import { join } from 'node:path'
import { listChromiumProfiles } from './chromium-profiles'
import type { ChromiumProfile } from '../../shared/types/profile'

export const EDGE_DIR = join(homedir(), 'Library/Application Support/Microsoft Edge')

interface ListEdgeProfilesOptions {
  userDataDir?: string
  localStatePath?: string
}

export async function listEdgeProfiles(
  options: ListEdgeProfilesOptions = {}
): Promise<ChromiumProfile[]> {
  return listChromiumProfiles({
    userDataDir: options.userDataDir ?? EDGE_DIR,
    localStatePath: options.localStatePath
  })
}
