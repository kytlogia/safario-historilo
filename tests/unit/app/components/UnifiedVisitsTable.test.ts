import { describe, expect, it } from 'vitest'
import UnifiedVisitsTable from '~/components/UnifiedVisitsTable.vue'
import type { UnifiedHistoryVisit } from '~/types/history'
import { formatDateTime } from '~/utils/format'
import { mountWithVuetify } from '../../support/mountWithVuetify'

function makeVisit(overrides: Partial<UnifiedHistoryVisit> = {}): UnifiedHistoryVisit {
  return {
    source: 'safari',
    sourceLabel: 'Safari',
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitCount: 1,
    ...overrides
  }
}

// TruncatedCell is our own child component, so per the project's test policy
// it's the one boundary that's stubbed rather than mounted for real — its own
// behavior is covered by TruncatedCell.test.ts.
function mountTable(items: UnifiedHistoryVisit[]) {
  return mountWithVuetify(UnifiedVisitsTable, {
    props: { items },
    global: { stubs: { TruncatedCell: true } }
  })
}

function dataRows(wrapper: ReturnType<typeof mountTable>) {
  return wrapper.findAll('tbody > tr').filter((row) => row.text().length > 0)
}

describe('UnifiedVisitsTable', () => {
  it('renders one row per visit, delegating title/url/domain to the stubbed TruncatedCell', () => {
    const visitTime = new Date('2024-01-02T03:04:05.000Z')
    const wrapper = mountTable([
      makeVisit({
        title: 'Example Domain',
        url: 'https://example.com/',
        domain: 'example.com',
        visitCount: 3,
        visitTime
      })
    ])

    const stubs = wrapper.findAll('truncated-cell-stub')
    expect(stubs.map((s) => s.attributes('text'))).toEqual([
      'Example Domain',
      'https://example.com/',
      'example.com'
    ])
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain(formatDateTime(visitTime))
  })

  it('shows the source label as a chip for each row', () => {
    const wrapper = mountTable([
      makeVisit({ source: 'firefox', sourceLabel: 'Firefox' }),
      makeVisit({ source: 'chrome', sourceLabel: 'Chrome', url: 'https://chrome.example/' })
    ])

    const rows = dataRows(wrapper)
    expect(rows[0]!.text()).toContain('Firefox')
    expect(rows[1]!.text()).toContain('Chrome')
  })

  it('emits row-click with the visit when the row is clicked', async () => {
    const visit = makeVisit({ url: 'https://example.com/unique' })
    const wrapper = mountTable([visit])

    const row = dataRows(wrapper)[0]
    await row!.trigger('click')

    // The emitted item carries an internal rowIndex field alongside the
    // visit's own fields — see the rowIndex-decoration comment in
    // UnifiedVisitsTable.vue for why the table needs it.
    expect(wrapper.emitted('row-click')).toEqual([[{ ...visit, rowIndex: 0 }]])
  })

  it('emits row-click with the matching visit when there are multiple rows', async () => {
    const first = makeVisit({ url: 'https://example.com/first' })
    const second = makeVisit({ url: 'https://example.com/second' })
    const wrapper = mountTable([first, second])

    const rows = dataRows(wrapper)
    await rows[1]!.trigger('click')

    expect(wrapper.emitted('row-click')).toEqual([[{ ...second, rowIndex: 1 }]])
  })

  it('renders every row separately even when source/url/visitTime are all identical', () => {
    // Regression test: an earlier version keyed rows by `source:url:visitTime`,
    // which collides for two visits to the same URL in the same millisecond
    // (e.g. a fast reload) and made v-data-table-virtual collapse/misattribute
    // rows. Rows are now keyed by their position in `items` instead.
    const duplicate = makeVisit({ url: 'https://example.com/dup' })
    const wrapper = mountTable([duplicate, { ...duplicate }])

    expect(dataRows(wrapper)).toHaveLength(2)
  })
})
