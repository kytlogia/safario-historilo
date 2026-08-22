import { expect, test } from './support/fixtures'

test.describe('エクスポート', () => {
  test('JSON export triggers a file download', async ({ page, loadFixtureViaFileInput }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'JSON出力' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('safari-history.json')
  })

  test('CSV export triggers a file download', async ({ page, loadFixtureViaFileInput }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV出力' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('safari-history.csv')
  })
})
