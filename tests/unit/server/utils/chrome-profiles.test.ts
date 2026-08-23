// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHROME_DIR, listChromeProfiles } from '../../../../server/utils/chrome-profiles'

describe('CHROME_DIR', () => {
  it("points at Chrome's user data directory under the home directory", () => {
    expect(CHROME_DIR).toBe(join(homedir(), 'Library/Application Support/Google/Chrome'))
  })
})

describe('listChromeProfiles', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'chrome-profiles-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('delegates to listChromiumProfiles with an overridden userDataDir', async () => {
    const userDataDir = join(dir, 'Chrome')
    await mkdir(join(userDataDir, 'Default'), { recursive: true })
    await writeFile(join(userDataDir, 'Default', 'History'), 'dummy')

    const profiles = await listChromeProfiles({ userDataDir })

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
