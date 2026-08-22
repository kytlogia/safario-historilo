import {
  createSampleHistoryDatabaseBytes,
  expect,
  SAMPLE_HISTORY_DATA,
  test
} from './support/fixtures'

test.describe('ローカル履歴自動読込', () => {
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

  test('disables the load controls while an auto-load request is in flight, preventing a duplicate load', async ({
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

    let requestCount = 0
    await page.route('**/api/local-history', async (route) => {
      requestCount += 1
      // Hold the response open long enough to observe the loading state and
      // to give a would-be duplicate click a window to fire.
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from(await createSampleHistoryDatabaseBytes())
      })
    })

    await page.goto('/')

    const autoLoadButton = page.getByRole('button', {
      name: 'この Mac の History.db を自動で読み込む'
    })
    const fileInput = page.locator('input[type="file"]')

    await autoLoadButton.click()

    await expect(autoLoadButton).toBeDisabled()
    await expect(fileInput).toBeDisabled()

    // Dispatch a click event directly so the native `disabled` semantics (not
    // Playwright's actionability checks) are what's under test.
    await autoLoadButton.dispatchEvent('click')

    await expect(
      page.getByText(
        `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
      )
    ).toBeVisible()

    expect(requestCount).toBe(1)
  })
})
