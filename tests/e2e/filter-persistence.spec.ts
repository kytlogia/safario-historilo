import { expect, SAMPLE_HISTORY_DATA, test } from './support/fixtures'

test.describe('フィルタ状態の永続化', () => {
  test('search and checkbox filters survive a reload and are re-applied on next load', async ({
    page,
    loadFixtureViaFileInput,
    fixturePath
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('textbox', { name: 'タイトル・URLで検索' }).fill('Blog Post')
    await page.getByRole('checkbox', { name: '自動生成された履歴のみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()

    await page.reload()

    // The upload panel is back (visits themselves aren't persisted), but the
    // restored filter refs should already be applied once data is loaded again.
    await expect(page.getByRole('textbox', { name: 'タイトル・URLで検索' })).toHaveCount(0)

    // The persisted search + checkbox filters narrow results as soon as data
    // loads, so — unlike loadFixtureViaFileInput's own helper — this cannot
    // wait for the unfiltered "N / N" count; it goes straight to "1 / N".
    await page.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()

    await expect(page.getByRole('textbox', { name: 'タイトル・URLで検索' })).toHaveValue(
      'Blog Post'
    )
    await expect(page.getByRole('checkbox', { name: '自動生成された履歴のみ' })).toBeChecked()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
  })

  test('resetAll ("別のファイルを読み込む") clears the persisted filters too', async ({
    page,
    loadFixtureViaFileInput
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('textbox', { name: 'タイトル・URLで検索' }).fill('Blog Post')
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()

    await page.getByRole('button', { name: '別のファイルを読み込む' }).click()
    await page.reload()
    await loadFixtureViaFileInput(page)

    await expect(page.getByRole('textbox', { name: 'タイトル・URLで検索' })).toHaveValue('')
    await expect(
      page.getByText(
        `${SAMPLE_HISTORY_DATA.visits.length} / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`
      )
    ).toBeVisible()
  })
})
