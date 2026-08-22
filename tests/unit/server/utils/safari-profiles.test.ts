// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listSafariProfiles } from '../../../../server/utils/safari-profiles'

const PROFILE_A_ID = '11111111-1111-1111-1111-111111111111'
const PROFILE_B_ID = '22222222-2222-2222-2222-222222222222'
const NAMELESS_PROFILE_ID = '33333333-3333-3333-3333-333333333333'
const EXTENSION_ONLY_PROFILE_ID = '44444444-4444-4444-4444-444444444444'

let dir: string
let profilesDir: string
let safariTabsDbPath: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'safari-profiles-test-'))
  profilesDir = join(dir, 'Profiles')
  safariTabsDbPath = join(dir, 'SafariTabs.db')
  await mkdir(profilesDir, { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/**
 * Mirrors the real bookmarks table shape closely enough to exercise
 * listSafariProfiles()'s query (see the comment on SAFARI_TABS_DB_PATH in
 * server/utils/safari-profiles.ts for how this was reverse-engineered).
 */
function createSafariTabsDb(rows: { title: string | null; external_uuid: string }[]) {
  const db = new DatabaseSync(safariTabsDbPath)
  try {
    db.exec(
      'CREATE TABLE bookmarks (id INTEGER PRIMARY KEY, parent INTEGER, type INTEGER, subtype INTEGER, title TEXT, external_uuid TEXT)'
    )
    // A non-profile row (a regular bookmark folder) must not be picked up.
    db.prepare(
      'INSERT INTO bookmarks (parent, type, subtype, title, external_uuid) VALUES (0, 1, 0, ?, ?)'
    ).run('お気に入り', 'CB3A1RANDOM-0000-0000-0000-000000000000')
    for (const row of rows) {
      db.prepare(
        'INSERT INTO bookmarks (parent, type, subtype, title, external_uuid) VALUES (0, 1, 2, ?, ?)'
      ).run(row.title, row.external_uuid)
    }
  } finally {
    db.close()
  }
}

async function createProfileDir(profileId: string, withHistoryDb: boolean) {
  const profileDir = join(profilesDir, profileId)
  await mkdir(profileDir, { recursive: true })
  if (withHistoryDb) {
    await writeFile(join(profileDir, 'History.db'), 'dummy')
  }
}

describe('listSafariProfiles', () => {
  it('always includes the default profile first, even with no Profiles directory', async () => {
    await rm(profilesDir, { recursive: true, force: true })
    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })
    expect(profiles).toEqual([{ id: 'default', name: 'デフォルト', dbPath: expect.any(String) }])
  })

  it('lists named profiles that have a History.db, using titles from SafariTabs.db', async () => {
    await createProfileDir(PROFILE_A_ID, true)
    await createProfileDir(PROFILE_B_ID, true)
    createSafariTabsDb([
      { title: 'プロファイルA', external_uuid: PROFILE_A_ID },
      { title: 'プロファイルB', external_uuid: PROFILE_B_ID }
    ])

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles).toEqual([
      { id: 'default', name: 'デフォルト', dbPath: expect.any(String) },
      {
        id: PROFILE_A_ID,
        name: 'プロファイルA',
        dbPath: join(profilesDir, PROFILE_A_ID, 'History.db')
      },
      {
        id: PROFILE_B_ID,
        name: 'プロファイルB',
        dbPath: join(profilesDir, PROFILE_B_ID, 'History.db')
      }
    ])
  })

  it('uses the custom name for the default profile when SafariTabs.db has one', async () => {
    createSafariTabsDb([{ title: 'いつもの', external_uuid: 'DefaultProfile' }])

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles[0]).toMatchObject({ id: 'default', name: 'いつもの' })
  })

  it('falls back to a UUID-based label when SafariTabs.db has no matching row', async () => {
    await createProfileDir(NAMELESS_PROFILE_ID, true)

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles).toEqual([
      { id: 'default', name: 'デフォルト', dbPath: expect.any(String) },
      {
        id: NAMELESS_PROFILE_ID,
        name: `プロファイル (${NAMELESS_PROFILE_ID.slice(0, 8)})`,
        dbPath: join(profilesDir, NAMELESS_PROFILE_ID, 'History.db')
      }
    ])
  })

  it('skips profile directories with no History.db (e.g. extension-only sandboxes)', async () => {
    await createProfileDir(EXTENSION_ONLY_PROFILE_ID, false)

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.id).toBe('default')
  })

  it('ignores non-UUID entries in the Profiles directory (e.g. DefaultProfile)', async () => {
    await mkdir(join(profilesDir, 'DefaultProfile'), { recursive: true })
    await createProfileDir(PROFILE_A_ID, true)
    createSafariTabsDb([{ title: 'プロファイルA', external_uuid: PROFILE_A_ID }])

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles.map((p) => p.id)).toEqual(['default', PROFILE_A_ID])
  })

  it('degrades gracefully to UUID-based labels when SafariTabs.db does not exist', async () => {
    await createProfileDir(PROFILE_A_ID, true)

    const profiles = await listSafariProfiles({ profilesDir, safariTabsDbPath })

    expect(profiles[1]).toMatchObject({
      id: PROFILE_A_ID,
      name: `プロファイル (${PROFILE_A_ID.slice(0, 8)})`
    })
  })
})
