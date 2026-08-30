// @vitest-environment node
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkChromiumHistoryDbAccess,
  readLocalChromiumHistoryDb,
  resolveChromiumProfile
} from '../../../../server/utils/chromium-history-store'
import {
  HistoryDbNotFoundError,
  HistoryDbNotReadableError
} from '../../../../server/utils/history-store'

let dir: string
let userDataDir: string
let localStatePath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chromium-history-store-test-'))
  userDataDir = join(dir, 'Chrome')
  localStatePath = join(userDataDir, 'Local State')
  await mkdir(userDataDir, { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function createProfileDir(dirName: string, withHistoryDb: boolean) {
  const profileDir = join(userDataDir, dirName)
  await mkdir(profileDir, { recursive: true })
  if (withHistoryDb) {
    await writeFile(join(profileDir, 'History'), 'dummy')
  }
}

function writeLocalState(infoCache: Record<string, { name?: string }>) {
  return writeFile(localStatePath, JSON.stringify({ profile: { info_cache: infoCache } }))
}

describe('resolveChromiumProfile', () => {
  it('returns null when no profile exists', async () => {
    expect(await resolveChromiumProfile(undefined, { userDataDir, localStatePath })).toBeNull()
  })

  it('resolves the default profile when no profileId is given', async () => {
    await createProfileDir('Default', true)
    await writeLocalState({ Default: { name: 'Alice' } })

    const profile = await resolveChromiumProfile(undefined, { userDataDir, localStatePath })
    expect(profile?.name).toBe('Alice')
  })

  it('resolves a specific profile by its id (profile directory name)', async () => {
    await createProfileDir('Default', true)
    await createProfileDir('Profile 1', true)
    await writeLocalState({ Default: { name: 'Alice' }, 'Profile 1': { name: 'Bob' } })

    const profile = await resolveChromiumProfile('Profile 1', { userDataDir, localStatePath })
    expect(profile?.name).toBe('Bob')
  })

  it('returns null for an unrecognized profileId instead of building a path from it', async () => {
    await createProfileDir('Default', true)
    await writeLocalState({ Default: { name: 'Alice' } })

    const profile = await resolveChromiumProfile('../../etc/passwd', {
      userDataDir,
      localStatePath
    })
    expect(profile).toBeNull()
  })
})

describe('checkChromiumHistoryDbAccess', () => {
  it('reports present:false, readable:false for a null path', () => {
    expect(checkChromiumHistoryDbAccess(null)).toEqual({
      present: false,
      readable: false,
      path: ''
    })
  })

  it('reports present:false, readable:false when the file does not exist', () => {
    const missingDbPath = join(dir, 'missing')
    expect(checkChromiumHistoryDbAccess(missingDbPath)).toEqual({
      present: false,
      readable: false,
      path: missingDbPath
    })
  })

  it('reports present:true, readable:true for a normal, readable file', async () => {
    const dbPath = join(dir, 'History')
    await writeFile(dbPath, 'dummy')
    expect(checkChromiumHistoryDbAccess(dbPath)).toEqual({
      present: true,
      readable: true,
      path: dbPath
    })
  })

  it('reports present:true, readable:false when the file exists but is not readable', async () => {
    // Windows' fs.chmod only toggles the read-only attribute, not a real
    // read-access ACL, so chmod(0o000) can't reproduce this on Windows (#138).
    if (process.platform === 'win32' || process.getuid?.() === 0) return // root bypasses permission bits too
    const dbPath = join(dir, 'History')
    await writeFile(dbPath, 'dummy')
    await chmod(dbPath, 0o000)
    expect(checkChromiumHistoryDbAccess(dbPath)).toEqual({
      present: true,
      readable: false,
      path: dbPath
    })
    await chmod(dbPath, 0o600) // restore so rm() can clean up
  })
})

describe('readLocalChromiumHistoryDb', () => {
  it('throws HistoryDbNotFoundError when no profile is found', async () => {
    await expect(
      readLocalChromiumHistoryDb('chrome', undefined, { userDataDir, localStatePath })
    ).rejects.toBeInstanceOf(HistoryDbNotFoundError)
  })

  it('throws HistoryDbNotReadableError when the History file exists but is not readable', async () => {
    // See the equivalent skip in checkChromiumHistoryDbAccess's suite above.
    if (process.platform === 'win32' || process.getuid?.() === 0) return
    await createProfileDir('Default', true)
    await writeLocalState({ Default: { name: 'Alice' } })
    const dbPath = join(userDataDir, 'Default', 'History')
    await chmod(dbPath, 0o000)

    await expect(
      readLocalChromiumHistoryDb('chrome', undefined, { userDataDir, localStatePath })
    ).rejects.toBeInstanceOf(HistoryDbNotReadableError)

    await chmod(dbPath, 0o600)
  })
})
