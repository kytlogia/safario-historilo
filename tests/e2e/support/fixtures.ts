import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createSampleHistoryDatabaseBytes, SAMPLE_HISTORY_DATA } from '../../fixtures/build-history-db'

interface WorkerFixtures {
  fixturePath: string
}

interface TestFixtures {
  /** Load the fixture through the visible <v-file-input>. */
  loadFixtureViaFileInput: (page: Page) => Promise<void>
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  fixturePath: [
    // Playwright requires an object destructuring pattern here even when no
    // fixtures are used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const fixtureDir = await mkdtemp(join(tmpdir(), 'safari-history-e2e-'))
      const fixturePath = join(fixtureDir, 'History.db')
      await writeFile(fixturePath, await createSampleHistoryDatabaseBytes())
      await use(fixturePath)
      await rm(fixtureDir, { recursive: true, force: true })
    },
    { scope: 'worker' }
  ],

  loadFixtureViaFileInput: async ({ fixturePath }, use) => {
    await use(async (page: Page) => {
      await page.locator('input[type="file"]').setInputFiles(fixturePath)
      await expect(
        page.getByText(
          `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
        )
      ).toBeVisible()
    })
  }
})

export { expect }
export { createSampleHistoryDatabaseBytes, SAMPLE_HISTORY_DATA }
