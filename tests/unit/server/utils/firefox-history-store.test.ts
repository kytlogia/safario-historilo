// @vitest-environment node
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkFirefoxHistoryDbAccess,
  readLocalFirefoxHistoryDb,
  resolveFirefoxProfile
} from '../../../../server/utils/firefox-history-store'
import {
  HistoryDbNotFoundError,
  HistoryDbNotReadableError
} from '../../../../server/utils/history-store'

let dir: string
let firefoxDir: string
let profilesIniPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'firefox-history-store-test-'))
  firefoxDir = join(dir, 'Firefox')
  profilesIniPath = join(firefoxDir, 'profiles.ini')
  await mkdir(firefoxDir, { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function createProfile(relativeDir: string, withPlacesDb: boolean) {
  const profileDir = join(firefoxDir, relativeDir)
  await mkdir(profileDir, { recursive: true })
  if (withPlacesDb) {
    await writeFile(join(profileDir, 'places.sqlite'), 'dummy')
  }
}

describe('resolveFirefoxProfile', () => {
  it('returns null when no profiles.ini exists', async () => {
    expect(await resolveFirefoxProfile(undefined, { profilesIniPath, firefoxDir })).toBeNull()
  })

  it('resolves the default profile when no profileId is given', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await writeFile(
      profilesIniPath,
      '[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/aaaaaaaa.default-release\nDefault=1\n'
    )

    const profile = await resolveFirefoxProfile(undefined, { profilesIniPath, firefoxDir })
    expect(profile?.name).toBe('default-release')
  })

  it('does not treat the literal string "default" as a sentinel for the default profile', async () => {
    // Unlike Safari (a fixed DEFAULT_PROFILE_ID sentinel distinct from any
    // real container UUID), a Firefox profile's id is its raw profiles.ini
    // Path value, so a profile could legitimately be pathed exactly
    // "default" (e.g. via `firefox -CreateProfile default`). Treating that
    // string as an alias for "use the default profile" would silently load
    // the wrong profile for such a user — so with no profile actually
    // id'd "default" here, passing it should resolve to nothing.
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await writeFile(
      profilesIniPath,
      '[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/aaaaaaaa.default-release\nDefault=1\n'
    )

    const profile = await resolveFirefoxProfile('default', { profilesIniPath, firefoxDir })
    expect(profile).toBeNull()
  })

  it('resolves a profile whose id genuinely is "default" by exact match, not as the sentinel', async () => {
    await createProfile('default', true)
    await writeFile(
      profilesIniPath,
      '[Profile0]\nName=Literal Default\nIsRelative=1\nPath=default\n'
    )

    const profile = await resolveFirefoxProfile('default', { profilesIniPath, firefoxDir })
    expect(profile?.name).toBe('Literal Default')
  })

  it('resolves a specific profile by its id (profiles.ini Path value)', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await createProfile('Profiles/bbbbbbbb.dev-edition', true)
    await writeFile(
      profilesIniPath,
      [
        '[Profile0]',
        'Name=default-release',
        'IsRelative=1',
        'Path=Profiles/aaaaaaaa.default-release',
        'Default=1',
        '',
        '[Profile1]',
        'Name=dev-edition',
        'IsRelative=1',
        'Path=Profiles/bbbbbbbb.dev-edition'
      ].join('\n')
    )

    const profile = await resolveFirefoxProfile('Profiles/bbbbbbbb.dev-edition', {
      profilesIniPath,
      firefoxDir
    })
    expect(profile?.name).toBe('dev-edition')
  })

  it('returns null for an unrecognized profileId instead of building a path from it', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await writeFile(
      profilesIniPath,
      '[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/aaaaaaaa.default-release\n'
    )

    const profile = await resolveFirefoxProfile('../../etc/passwd', { profilesIniPath, firefoxDir })
    expect(profile).toBeNull()
  })
})

describe('checkFirefoxHistoryDbAccess', () => {
  it('reports present:false, readable:false for a null path', () => {
    expect(checkFirefoxHistoryDbAccess(null)).toEqual({ present: false, readable: false, path: '' })
  })

  it('reports present:false, readable:false when the file does not exist', () => {
    const missingDbPath = join(dir, 'missing.sqlite')
    expect(checkFirefoxHistoryDbAccess(missingDbPath)).toEqual({
      present: false,
      readable: false,
      path: missingDbPath
    })
  })

  it('reports present:true, readable:true for a normal, readable file', async () => {
    const dbPath = join(dir, 'places.sqlite')
    await writeFile(dbPath, 'dummy')
    expect(checkFirefoxHistoryDbAccess(dbPath)).toEqual({
      present: true,
      readable: true,
      path: dbPath
    })
  })

  it('reports present:true, readable:false when the file exists but is not readable', async () => {
    if (process.getuid?.() === 0) return // root bypasses permission bits
    const dbPath = join(dir, 'places.sqlite')
    await writeFile(dbPath, 'dummy')
    await chmod(dbPath, 0o000)
    expect(checkFirefoxHistoryDbAccess(dbPath)).toEqual({
      present: true,
      readable: false,
      path: dbPath
    })
    await chmod(dbPath, 0o600) // restore so rm() can clean up
  })
})

describe('readLocalFirefoxHistoryDb', () => {
  it('throws HistoryDbNotFoundError when no profile is found', async () => {
    await expect(
      readLocalFirefoxHistoryDb(undefined, { profilesIniPath, firefoxDir })
    ).rejects.toBeInstanceOf(HistoryDbNotFoundError)
  })

  it('throws HistoryDbNotReadableError when the places.sqlite exists but is not readable', async () => {
    if (process.getuid?.() === 0) return // root bypasses permission bits
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await writeFile(
      profilesIniPath,
      '[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/aaaaaaaa.default-release\nDefault=1\n'
    )
    const dbPath = join(firefoxDir, 'Profiles/aaaaaaaa.default-release', 'places.sqlite')
    await chmod(dbPath, 0o000)

    await expect(
      readLocalFirefoxHistoryDb(undefined, { profilesIniPath, firefoxDir })
    ).rejects.toBeInstanceOf(HistoryDbNotReadableError)

    await chmod(dbPath, 0o600)
  })
})
