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

    expect(wrapper.emitted('row-click')).toEqual([[visit]])
  })
})
