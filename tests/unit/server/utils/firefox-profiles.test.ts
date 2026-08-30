// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  listFirefoxProfiles,
  resolveDefaultFirefoxProfile,
  resolveFirefoxDir
} from '../../../../server/utils/firefox-profiles'

describe('resolveFirefoxDir (#138 Windows support)', () => {
  it('uses %APPDATA%\\Mozilla\\Firefox on win32', () => {
    expect(resolveFirefoxDir('win32', 'C:\\Users\\alice\\AppData\\Roaming')).toBe(
      join('C:\\Users\\alice\\AppData\\Roaming', 'Mozilla', 'Firefox')
    )
  })

  it('falls back to the conventional Roaming path on win32 when APPDATA is unset', () => {
    expect(resolveFirefoxDir('win32', undefined)).toBe(
      join(homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox')
    )
  })

  it('uses ~/Library/Application Support/Firefox on non-Windows platforms', () => {
    expect(resolveFirefoxDir('darwin')).toBe(join(homedir(), 'Library/Application Support/Firefox'))
    expect(resolveFirefoxDir('linux')).toBe(join(homedir(), 'Library/Application Support/Firefox'))
  })
})

let dir: string
let firefoxDir: string
let profilesIniPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'firefox-profiles-test-'))
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

function writeProfilesIni(content: string) {
  return writeFile(profilesIniPath, content)
}

describe('listFirefoxProfiles', () => {
  it('returns an empty array when profiles.ini does not exist', async () => {
    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })
    expect(profiles).toEqual([])
  })

  it('lists profiles that have a places.sqlite, resolving relative paths against firefoxDir', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await createProfile('Profiles/bbbbbbbb.dev-edition', true)
    await writeProfilesIni(`
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaaaaaa.default-release
Default=1

[Profile1]
Name=dev-edition
IsRelative=1
Path=Profiles/bbbbbbbb.dev-edition
`)

    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })

    expect(profiles).toEqual([
      {
        id: 'Profiles/aaaaaaaa.default-release',
        name: 'default-release',
        dbPath: join(firefoxDir, 'Profiles/aaaaaaaa.default-release', 'places.sqlite'),
        isDefault: true
      },
      {
        id: 'Profiles/bbbbbbbb.dev-edition',
        name: 'dev-edition',
        dbPath: join(firefoxDir, 'Profiles/bbbbbbbb.dev-edition', 'places.sqlite'),
        isDefault: false
      }
    ])
  })

  it('skips profiles listed in profiles.ini with no places.sqlite (never launched)', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', false)
    await createProfile('Profiles/bbbbbbbb.dev-edition', true)
    await writeProfilesIni(`
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaaaaaa.default-release

[Profile1]
Name=dev-edition
IsRelative=1
Path=Profiles/bbbbbbbb.dev-edition
`)

    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.name).toBe('dev-edition')
  })

  it('falls back to the first profile as default when no entry has Default=1', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await createProfile('Profiles/bbbbbbbb.dev-edition', true)
    await writeProfilesIni(`
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaaaaaa.default-release

[Profile1]
Name=dev-edition
IsRelative=1
Path=Profiles/bbbbbbbb.dev-edition
`)

    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })

    expect(profiles[0]).toMatchObject({ name: 'default-release', isDefault: true })
    expect(profiles[1]).toMatchObject({ name: 'dev-edition', isDefault: false })
  })

  it('ignores non-Profile sections (e.g. [General], [Install...])', async () => {
    await createProfile('Profiles/aaaaaaaa.default-release', true)
    await writeProfilesIni(`
[General]
StartWithLastProfile=1
Version=2

[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/aaaaaaaa.default-release

[Install1234ABCD]
Default=Profiles/aaaaaaaa.default-release
Locked=1
`)

    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.name).toBe('default-release')
  })

  it('resolves an absolute profile Path (IsRelative=0) as-is', async () => {
    const absoluteProfileDir = join(dir, 'external-profile')
    await mkdir(absoluteProfileDir, { recursive: true })
    await writeFile(join(absoluteProfileDir, 'places.sqlite'), 'dummy')
    await writeProfilesIni(`
[Profile0]
Name=external
IsRelative=0
Path=${absoluteProfileDir}
`)

    const profiles = await listFirefoxProfiles({ profilesIniPath, firefoxDir })

    expect(profiles).toEqual([
      {
        id: absoluteProfileDir,
        name: 'external',
        dbPath: join(absoluteProfileDir, 'places.sqlite'),
        isDefault: true
      }
    ])
  })
})

describe('resolveDefaultFirefoxProfile', () => {
  it('returns the profile marked isDefault', () => {
    const profiles = [
      { id: 'a', name: 'A', dbPath: '/a', isDefault: false },
      { id: 'b', name: 'B', dbPath: '/b', isDefault: true }
    ]
    expect(resolveDefaultFirefoxProfile(profiles)?.id).toBe('b')
  })

  it('falls back to the first profile when none is marked default', () => {
    const profiles = [
      { id: 'a', name: 'A', dbPath: '/a', isDefault: false },
      { id: 'b', name: 'B', dbPath: '/b', isDefault: false }
    ]
    expect(resolveDefaultFirefoxProfile(profiles)?.id).toBe('a')
  })

  it('returns null for an empty list', () => {
    expect(resolveDefaultFirefoxProfile([])).toBeNull()
  })
})
