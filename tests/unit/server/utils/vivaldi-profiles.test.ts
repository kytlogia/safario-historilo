// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VIVALDI_DIR, listVivaldiProfiles } from '../../../../server/utils/vivaldi-profiles'

describe('VIVALDI_DIR', () => {
  it("points at Vivaldi's user data directory under the home directory", () => {
    expect(VIVALDI_DIR).toBe(join(homedir(), 'Library/Application Support/Vivaldi'))
  })
})

describe('listVivaldiProfiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vivaldi-profiles-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('delegates to listChromiumProfiles with an overridden userDataDir', async () => {
    const userDataDir = join(dir, 'Vivaldi')
    await mkdir(join(userDataDir, 'Default'), { recursive: true })
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profiles = await listVivaldiProfiles({ userDataDir })

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
