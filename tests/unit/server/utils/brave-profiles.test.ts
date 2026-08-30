// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BRAVE_DIR, listBraveProfiles } from '../../../../server/utils/brave-profiles'

describe('BRAVE_DIR', () => {
  it("points at Brave's user data directory under the home directory", () => {
    expect(BRAVE_DIR).toBe(
      join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser')
    )
  })
})

describe('listBraveProfiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'brave-profiles-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('delegates to listChromiumProfiles with an overridden userDataDir', async () => {
    const userDataDir = join(dir, 'Brave-Browser')
    await mkdir(join(userDataDir, 'Default'), { recursive: true })
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profiles = await listBraveProfiles({ userDataDir })

    expect(profiles).toEqual([
      {
        id: 'Default',
        name: 'Default',
        dbPath: join(userDataDir, 'Default', 'History'),
        isDefault: true
      }
    ])
  })
})
