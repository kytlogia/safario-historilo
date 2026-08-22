import { describe, expect, it } from 'vitest'
import VisitsTable from '~/components/VisitsTable.vue'
import type { HistoryVisit } from '~/types/history'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function makeVisit(overrides: Partial<HistoryVisit> = {}): HistoryVisit {
  return {
    visitId: 1,
    itemId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 123,
    visitCount: 1,
    domainExpansion: null,
    statusCode: 200,
    loadSuccessful: true,
    httpNonGet: false,
    synthesized: false,
    redirectSource: null,
    redirectDestination: null,
    origin: 0,
    generation: 0,
    attributes: 0,
    score: 0,
    ...overrides
  }
}

// TruncatedCell is our own child component, so per the project's test policy
// it's the one boundary that's stubbed rather than mounted for real — its own
// behavior is covered by TruncatedCell.test.ts.
function mountTable(items: HistoryVisit[]) {
  return mountWithVuetify(VisitsTable, {
    props: { items },
    global: { stubs: { TruncatedCell: true } }
  })
}

// v-data-table-virtual pads the body with empty spacer <tr>s (for virtual
// scroll offsetting) that also match a bare `tbody > tr` selector — filter
// down to the actual data rows by their content class.
function dataRows(wrapper: ReturnType<typeof mountTable>) {
  return wrapper.findAll('tbody > tr').filter((row) => row.classes().includes('v-data-table__tr'))
}

describe('VisitsTable', () => {
  it('renders one row per visit, delegating title/url/domain to the stubbed TruncatedCell', () => {
    const wrapper = mountTable([
      makeVisit({
        visitId: 1,
        title: 'Example Domain',
        url: 'https://example.com/',
        domain: 'example.com',
        visitCount: 3,
        visitTime: new Date('2024-01-02T03:04:05.000Z')
      })
    ])

    const stubs = wrapper.findAll('truncated-cell-stub')
    expect(stubs.map((s) => s.attributes('text'))).toEqual([
      'Example Domain',
      'https://example.com/',
      'example.com'
    ])
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('2024/01/02')
  })

  it('shows a failed/redirect/synthesized chip only for visits with that flag', () => {
    const wrapper = mountTable([
      makeVisit({ visitId: 1, loadSuccessful: false }),
      makeVisit({ visitId: 2, redirectSource: 10 }),
      makeVisit({ visitId: 3, synthesized: true }),
      makeVisit({ visitId: 4 })
    ])

    const rows = dataRows(wrapper)
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('失敗')
    expect(rows[1]!.text()).toContain('リダイレクト')
    expect(rows[2]!.text()).toContain('自動')
    expect(rows[3]!.text()).not.toContain('失敗')
    expect(rows[3]!.text()).not.toContain('リダイレクト')
    expect(rows[3]!.text()).not.toContain('自動')
  })

  it('emits row-click with the visit when the detail button is clicked', async () => {
    const visit = makeVisit({ visitId: 42 })
    const wrapper = mountTable([visit])

    await wrapper.find('[data-testid="row-detail-button"]').trigger('click')

    expect(wrapper.emitted('row-click')).toEqual([[visit]])
  })

  it('emits row-click with the visit when the row itself is clicked', async () => {
    const visit = makeVisit({ visitId: 7 })
    const wrapper = mountTable([visit])

    const dataRow = dataRows(wrapper)[0]
    await dataRow!.trigger('click')

    expect(wrapper.emitted('row-click')).toEqual([[visit]])
  })
})
