import { expect, SAMPLE_HISTORY_DATA, test } from './support/fixtures'

test.describe('フィルタ', () => {
  test('search filters rows by title and URL', async ({ page, loadFixtureViaFileInput }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('textbox', { name: 'タイトル・URLで検索' }).fill('Blog Post')
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
    await expect(page.getByRole('row', { name: /Example Domain/ })).not.toBeVisible()
  })

  test('domain filter narrows rows to the selected domain', async ({
    page,
    loadFixtureViaFileInput
  }) => {
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

  test('date range filter narrows visible rows', async ({ page, loadFixtureViaFileInput }) => {
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

  test('"only failed" checkbox shows just the failed-load visit', async ({
    page,
    loadFixtureViaFileInput
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: '読み込み失敗のみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /失敗/ })).toBeVisible()
  })

  test('"only redirects" checkbox shows just the redirect visit', async ({
    page,
    loadFixtureViaFileInput
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: 'リダイレクトのみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Old Page/ })).toBeVisible()
  })

  test('"only synthesized" checkbox shows just the synthesized visit', async ({
    page,
    loadFixtureViaFileInput
  }) => {
    await page.goto('/')
    await loadFixtureViaFileInput(page)

    await page.getByRole('checkbox', { name: '自動生成された履歴のみ' }).check()
    await expect(page.getByText(`1 / ${SAMPLE_HISTORY_DATA.visits.length} 件を表示`)).toBeVisible()
    await expect(page.getByRole('row', { name: /Blog Post One/ })).toBeVisible()
  })
})
