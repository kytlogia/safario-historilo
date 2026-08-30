// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ARC_DIR, listArcProfiles } from '../../../../server/utils/arc-profiles'

describe('ARC_DIR', () => {
  it("points at Arc's user data directory under the home directory", () => {
    expect(ARC_DIR).toBe(join(homedir(), 'Library/Application Support/Arc/User Data'))
  })
})

describe('listArcProfiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'arc-profiles-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('delegates to listChromiumProfiles with an overridden userDataDir', async () => {
    const userDataDir = join(dir, 'User Data')
    await mkdir(join(userDataDir, 'Default'), { recursive: true })
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profiles = await listArcProfiles({ userDataDir })

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
