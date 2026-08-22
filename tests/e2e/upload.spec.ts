import { createSampleHistoryDatabaseBytes, expect, SAMPLE_HISTORY_DATA, test } from './support/fixtures'

test.describe('アップロード', () => {
  test('loads a History.db via the file picker and lists every visit', async ({
    page,
    loadFixtureViaFileInput
  }) => {
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
})
