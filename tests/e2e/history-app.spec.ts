import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createSampleHistoryDatabaseBytes, SAMPLE_HISTORY_DATA } from '../fixtures/build-history-db'

let fixtureDir: string
let fixturePath: string

test.beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), 'safari-history-e2e-'))
  fixturePath = join(fixtureDir, 'History.db')
  await writeFile(fixturePath, await createSampleHistoryDatabaseBytes())
})

test.afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

/** Load the fixture through the visible <v-file-input>. */
async function loadFixtureViaFileInput(page: Page) {
  await page.locator('input[type="file"]').setInputFiles(fixturePath)
  await expect(
    page.getByText(
      `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
    )
  ).toBeVisible()
}

test.describe('Safari History Detail', () => {
  test('loads a History.db via the file picker and lists every visit', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await expect(page.getByRole('row', { name: /Example Domain/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /失敗/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /リダイレクト/ })).toBeVisible()
  })

  test('loads a History.db via drag & drop', async ({ page }) => {
    await page.goto('/')

    const buffer = await createSampleHistoryDatabaseBytes()
    const base64 = Buffer.from(buffer).toString('base64')

    const dropZone = page.locator('.drop-zone')
    await dropZone.dispatchEvent('drop', {
      dataTransfer: await page.evaluateHandle(
        ({ base64, fileName }) => {
          const binary = atob(base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const file = new File([bytes], fileName, { type: 'application/octet-stream' })
          const dt = new DataTransfer()
          dt.items.add(file)
          return dt
        },
        { base64, fileName: 'History.db' }
      )
    })

    await expect(
      page.getByText(
        `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
      )
    ).toBeVisible()
  })

  test('search filters rows by title and URL', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('textbox', { name: 'タイトル・URLで検索' }).fill('Blog Post')
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Example Domain/ })).not.toBeVisible()
  })

  test('domain filter narrows rows to the selected domain', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    // v-autocomplete's input is directly clickable and editable, so typing a
    // substring of the domain narrows the candidate list before selecting.
    const domainInput = page.getByRole('combobox', { name: 'ドメインで絞り込み' })
    await domainInput.click()
    await domainInput.fill('blog')
    await page.getByRole('option', { name: /blog\.example\.org/ }).click()

    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
  })

  test('date range filter narrows visible rows', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    // The date inputs are interpreted in local time (see dateFrom/dateTo in
    // app/pages/index.vue), so derive the fixture visits' local calendar date
    // instead of assuming UTC — it can differ by a day depending on the host's
    // timezone. All sample visits share the same instant-derived local day.
    const visitDate = new Date((700000000 + 978307200) * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const inRangeDate = `${visitDate.getFullYear()}/${pad(visitDate.getMonth() + 1)}/${pad(visitDate.getDate())}`

    // v-date-input renders a text field (format yyyy/mm/dd for the ja locale)
    // alongside a "clear" icon that also matches the field's label, so scope
    // to the textbox role and blur to commit the typed value.
    const startInput = page.getByRole('textbox', { name: '開始日' })
    const endInput = page.getByRole('textbox', { name: '終了日' })

    await startInput.fill(inRangeDate)
    await startInput.blur()
    await endInput.fill(inRangeDate)
    await endInput.blur()
    await expect(
      page.getByText(
        `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
      )
    ).toBeVisible()

    // A date range entirely before every visit excludes everything.
    await startInput.fill('2000/01/01')
    await startInput.blur()
    await endInput.fill('2000/01/02')
    await endInput.blur()
    await expect(page.getByText(`0 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
  })

  test('"only failed" checkbox shows just the failed-load visit', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: '読み込み失敗のみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /失敗/ })).toBeVisible()
  })

  test('"only redirects" checkbox shows just the redirect visit', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: 'リダイレクトのみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Old Page/ })).toBeVisible()
  })

  test('"only synthesized" checkbox shows just the synthesized visit', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: '自動生成された履歴のみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
  })

  test('clicking a row opens the detail dialog with its data', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('row', { name: /Example Domain/ }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('履歴の詳細')).toBeVisible()
    await expect(dialog.getByText('https://www.example.com/')).toBeVisible()
    await expect(dialog.getByText('www.example.com', { exact: true })).toBeVisible()

    await dialog.getByRole('button').first().click()
    await expect(dialog).not.toBeVisible()
  })

  test('JSON export triggers a file download', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'JSON出力' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('safari-history.json')
  })

  test('CSV export triggers a file download', async ({ page }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV出力' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('safari-history.csv')
  })

  test('shows the auto-load button when the server reports History.db is available', async ({
    page
  }) => {
    await page.route('**/api/local-history/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: true,
          supported: true,
          present: true,
          readable: true,
          path: '/Users/example/Library/Safari/History.db'
        })
      })
    )
    await page.goto('/')

    await expect(
      page.getByRole('button', { name: 'この Mac の History.db を自動で読み込む' })
    ).toBeVisible()
  })

  test('hides the auto-load button when the server reports History.db is unavailable', async ({
    page
  }) => {
    await page.route('**/api/local-history/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          available: false,
          supported: true,
          present: false,
          readable: false,
          path: '/Users/example/Library/Safari/History.db'
        })
      })
    )
    await page.goto('/')

    await expect(
      page.getByRole('button', { name: 'この Mac の History.db を自動で読み込む' })
    ).not.toBeVisible()
    await expect(page.locator('input[type="file"]')).toBeVisible()
  })
})
