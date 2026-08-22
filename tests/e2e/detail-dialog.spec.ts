import { expect, test } from './support/fixtures'

test.describe('詳細ダイアログ', () => {
  test('clicking a row opens the detail dialog with its data', async ({
    page,
    loadFixtureViaFileInput
  }) => {
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

  test('a table row detail can be opened and closed via keyboard alone', async ({
    page,
    loadFixtureViaFileInput
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page
      .getByRole('row', { name: /Example Domain/ })
      .getByRole('button', { name: '詳細を見る' })
      .focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('https://www.example.com/')).toBeVisible()

    await dialog.getByRole('button', { name: '閉じる' }).focus()
    await page.keyboard.press('Enter')
    await expect(dialog).not.toBeVisible()
  })
})
