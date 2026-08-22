import { describe, expect, it, vi } from 'vitest'
import FilterBar from '~/components/FilterBar.vue'
import type { HistoryVisit } from '~/types/history'
import { exportVisitsAsCsv, exportVisitsAsJson } from '~/utils/export'
import { mountWithVuetify } from '../../support/mountWithVuetify'

vi.mock('~/utils/export', () => ({
  exportVisitsAsJson: vi.fn(),
  exportVisitsAsCsv: vi.fn()
}))

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

function mountFilterBar(overrides: Partial<Record<string, unknown>> = {}) {
  return mountWithVuetify(FilterBar, {
    props: {
      domainOptions: [{ title: 'example.com (1)', value: 'example.com' }],
      filteredVisits: [makeVisit()],
      totalCount: 1,
      search: '',
      domainFilter: null,
      dateFrom: null,
      dateTo: null,
      onlyFailed: false,
      onlyRedirects: false,
      onlySynthesized: false,
      ...overrides
    }
  })
}

describe('FilterBar', () => {
  it('emits update:search as the search field is typed into', async () => {
    const wrapper = mountFilterBar()

    await wrapper.find('[data-testid="search-input"] input').setValue('Blog Post')

    expect(wrapper.emitted('update:search')).toEqual([['Blog Post']])
  })

  it('emits update:onlyFailed / update:onlyRedirects / update:onlySynthesized when their checkboxes are toggled', async () => {
    const wrapper = mountFilterBar()

    await wrapper.find('[data-testid="only-failed-checkbox"] input').setValue(true)
    await wrapper.find('[data-testid="only-redirects-checkbox"] input').setValue(true)
    await wrapper.find('[data-testid="only-synthesized-checkbox"] input').setValue(true)

    expect(wrapper.emitted('update:onlyFailed')).toEqual([[true]])
    expect(wrapper.emitted('update:onlyRedirects')).toEqual([[true]])
    expect(wrapper.emitted('update:onlySynthesized')).toEqual([[true]])
  })

  it('shows the filtered/total visit count', () => {
    const wrapper = mountFilterBar({
      filteredVisits: [makeVisit(), makeVisit({ visitId: 2 })],
      totalCount: 5
    })

    expect(wrapper.find('[data-testid="visible-count"]').text()).toContain('2 / 5 件を表示')
  })

  it('exports the filtered visits as JSON/CSV when the export buttons are clicked', async () => {
    const filteredVisits = [makeVisit()]
    const wrapper = mountFilterBar({ filteredVisits })

    await wrapper.find('[data-testid="export-json-button"]').trigger('click')
    await wrapper.find('[data-testid="export-csv-button"]').trigger('click')

    expect(exportVisitsAsJson).toHaveBeenCalledWith(filteredVisits)
    expect(exportVisitsAsCsv).toHaveBeenCalledWith(filteredVisits)
  })

  it('clears domainFilter via the clear button once a domain is selected', async () => {
    const wrapper = mountFilterBar({ domainFilter: 'example.com' })

    await wrapper.find('[data-testid="domain-filter-clear"]').trigger('click')

    expect(wrapper.emitted('update:domainFilter')).toEqual([[null]])
  })
})
