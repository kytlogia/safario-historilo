// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  listChromiumProfiles,
  resolveDefaultChromiumProfile
} from '../../../../server/utils/chromium-profiles'

let dir: string
let userDataDir: string
let localStatePath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'chromium-profiles-test-'))
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

describe('listChromiumProfiles', () => {
  it('falls back to just "Default" when Local State does not exist', async () => {
    await createProfileDir('Default', true)

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

    expect(profiles).toEqual([
      {
        id: 'Default',
        name: 'Default',
        dbPath: join(userDataDir, 'Default', 'History'),
        isDefault: true
      }
    ])
  })

  it('returns an empty array when Local State is missing and Default has no History', async () => {
    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })
    expect(profiles).toEqual([])
  })

  it('lists profiles from Local State info_cache that have a History file, using display names', async () => {
    await createProfileDir('Default', true)
    await createProfileDir('Profile 1', true)
    await writeLocalState({
      Default: { name: 'Alice' },
      'Profile 1': { name: 'Bob' }
    })

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

    expect(profiles).toEqual([
      {
        id: 'Default',
        name: 'Alice',
        dbPath: join(userDataDir, 'Default', 'History'),
        isDefault: true
      },
      {
        id: 'Profile 1',
        name: 'Bob',
        dbPath: join(userDataDir, 'Profile 1', 'History'),
        isDefault: false
      }
    ])
  })

  it('skips profiles listed in Local State with no History (never launched)', async () => {
    await createProfileDir('Default', true)
    await createProfileDir('Profile 1', false)
    await writeLocalState({
      Default: { name: 'Alice' },
      'Profile 1': { name: 'Bob' }
    })

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.name).toBe('Alice')
  })

  it('falls back to the first profile as default when "Default" is absent from info_cache', async () => {
    await createProfileDir('Profile 1', true)
    await createProfileDir('Profile 2', true)
    await writeLocalState({
      'Profile 1': { name: 'Bob' },
      'Profile 2': { name: 'Carol' }
    })

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

    expect(profiles[0]).toMatchObject({ name: 'Bob', isDefault: true })
    expect(profiles[1]).toMatchObject({ name: 'Carol', isDefault: false })
  })

  it('falls back to the directory name when info_cache has no display name', async () => {
    await createProfileDir('Profile 1', true)
    await writeLocalState({ 'Profile 1': {} })

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

    expect(profiles[0]?.name).toBe('Profile 1')
  })

  it('falls back to just "Default" when Local State is unparsable JSON', async () => {
    await createProfileDir('Default', true)
    await writeFile(localStatePath, '{not json')

    const profiles = await listChromiumProfiles({ userDataDir, localStatePath })

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

describe('resolveDefaultChromiumProfile', () => {
  it('returns the profile marked isDefault', () => {
    const profiles = [
      { id: 'a', name: 'A', dbPath: '/a', isDefault: false },
      { id: 'b', name: 'B', dbPath: '/b', isDefault: true }
    ]
    expect(resolveDefaultChromiumProfile(profiles)?.id).toBe('b')
  })

  it('falls back to the first profile when none is marked default', () => {
    const profiles = [
      { id: 'a', name: 'A', dbPath: '/a', isDefault: false },
      { id: 'b', name: 'B', dbPath: '/b', isDefault: false }
    ]
    expect(resolveDefaultChromiumProfile(profiles)?.id).toBe('a')
  })

  it('returns null for an empty list', () => {
    expect(resolveDefaultChromiumProfile([])).toBeNull()
  })
})
