import { describe, expect, it, vi } from 'vitest'
import UnifiedFilterBar from '~/components/UnifiedFilterBar.vue'
import type { UnifiedHistoryVisit } from '~/types/history'
import { exportUnifiedVisitsAsCsv, exportUnifiedVisitsAsJson } from '~/utils/export'
import { UNIFIED_HISTORY_SOURCES } from '~/utils/unifiedHistory'
import { mountWithVuetify } from '../../support/mountWithVuetify'

vi.mock('~/utils/export', () => ({
  exportUnifiedVisitsAsJson: vi.fn(),
  exportUnifiedVisitsAsCsv: vi.fn()
}))

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

function mountFilterBar(overrides: Partial<Record<string, unknown>> = {}) {
  return mountWithVuetify(UnifiedFilterBar, {
    props: {
      domainOptions: [{ title: 'example.com (1)', value: 'example.com' }],
      filteredVisits: [makeVisit()],
      totalCount: 1,
      search: '',
      domainFilter: [],
      dateFrom: null,
      dateTo: null,
      enabledSources: [...UNIFIED_HISTORY_SOURCES],
      ...overrides
    }
  })
}

describe('UnifiedFilterBar', () => {
  it('emits update:search as the search field is typed into', async () => {
    const wrapper = mountFilterBar()

    await wrapper.find('[data-testid="unified-search-input"] input').setValue('Blog Post')

    expect(wrapper.emitted('update:search')).toEqual([['Blog Post']])
  })

  it('shows the filtered/total visit count', () => {
    const wrapper = mountFilterBar({
      filteredVisits: [makeVisit(), makeVisit({ url: 'https://example.org/' })],
      totalCount: 5
    })

    expect(wrapper.find('[data-testid="unified-visible-count"]').text()).toContain('2 / 5 件を表示')
  })

  it('renders a filter chip for every unified source', () => {
    const wrapper = mountFilterBar()

    for (const source of UNIFIED_HISTORY_SOURCES) {
      expect(wrapper.find(`[data-testid="unified-source-chip-${source}"]`).exists()).toBe(true)
    }
  })

  it('exports the filtered visits as JSON/CSV when the export buttons are clicked', async () => {
    const filteredVisits = [makeVisit()]
    const wrapper = mountFilterBar({ filteredVisits })

    await wrapper.find('[data-testid="unified-export-json-button"]').trigger('click')
    await wrapper.find('[data-testid="unified-export-csv-button"]').trigger('click')

    expect(exportUnifiedVisitsAsJson).toHaveBeenCalledWith(filteredVisits)
    expect(exportUnifiedVisitsAsCsv).toHaveBeenCalledWith(filteredVisits)
  })

  it('clears domainFilter via the clear button once a domain is selected', async () => {
    const wrapper = mountFilterBar({ domainFilter: ['example.com'] })

    await wrapper.find('[data-testid="unified-domain-filter-clear"]').trigger('click')

    expect(wrapper.emitted('update:domainFilter')).toEqual([[[]]])
  })
})
