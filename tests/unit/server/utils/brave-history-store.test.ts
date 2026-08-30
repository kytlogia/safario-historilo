// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkBraveHistoryDbAccess,
  readLocalBraveHistoryDb,
  resolveBraveProfile
} from '../../../../server/utils/brave-history-store'
import { HistoryDbNotFoundError } from '../../../../server/utils/history-store'

let dir: string
let userDataDir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'brave-history-store-test-'))
  userDataDir = join(dir, 'Brave-Browser')
  await mkdir(join(userDataDir, 'Default'), { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('resolveBraveProfile / readLocalBraveHistoryDb / checkBraveHistoryDbAccess', () => {
  it('resolves the default profile via an overridden userDataDir', async () => {
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profile = await resolveBraveProfile(undefined, { userDataDir })
    expect(profile?.id).toBe('Default')
    expect(checkBraveHistoryDbAccess(profile?.dbPath ?? null)).toEqual({
      present: true,
      readable: true,
      path: join(userDataDir, 'Default', 'History')
    })
  })

  it('throws HistoryDbNotFoundError when no profile has a History file', async () => {
    await expect(readLocalBraveHistoryDb(undefined, { userDataDir })).rejects.toBeInstanceOf(
      HistoryDbNotFoundError
    )
  })
})
