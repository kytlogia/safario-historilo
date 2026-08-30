// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OPERA_DIR, listOperaProfiles } from '../../../../server/utils/opera-profiles'

describe('OPERA_DIR', () => {
  it("points at Opera's user data directory under the home directory", () => {
    expect(OPERA_DIR).toBe(join(homedir(), 'Library/Application Support/com.operasoftware.Opera'))
  })
})

describe('listOperaProfiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'opera-profiles-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('delegates to listChromiumProfiles with an overridden userDataDir', async () => {
    const userDataDir = join(dir, 'Opera')
    await mkdir(join(userDataDir, 'Default'), { recursive: true })
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profiles = await listOperaProfiles({ userDataDir })

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
