import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useUnifiedHistoryFilters } from '~/composables/useUnifiedHistoryFilters'
import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import { UNIFIED_HISTORY_SOURCES } from '~/utils/unifiedHistory'
import { formatDate } from '~/utils/format'

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

function makeFilters(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    search: ref(''),
    domainFilter: ref<string[]>([]),
    dateFrom: ref<Date | null>(null),
    dateTo: ref<Date | null>(null),
    enabledSources: ref<UnifiedHistorySource[]>([...UNIFIED_HISTORY_SOURCES]),
    ...overrides
  } as {
    search: ReturnType<typeof ref<string>>
    domainFilter: ReturnType<typeof ref<string[]>>
    dateFrom: ReturnType<typeof ref<Date | null>>
    dateTo: ReturnType<typeof ref<Date | null>>
    enabledSources: ReturnType<typeof ref<UnifiedHistorySource[]>>
  }
}

describe('useUnifiedHistoryFilters', () => {
  describe('domainOptions', () => {
    it('counts visits per domain across all sources and sorts descending by count', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com', source: 'safari' }),
        makeVisit({ domain: 'b.com', source: 'firefox' }),
        makeVisit({ domain: 'a.com', source: 'chrome' })
      ])
      const { domainOptions } = useUnifiedHistoryFilters(visits, makeFilters())

      expect(domainOptions.value).toEqual([
        { title: 'a.com (2)', value: 'a.com' },
        { title: 'b.com (1)', value: 'b.com' }
      ])
    })
  })

  describe('filteredVisits', () => {
    it('matches search text against title or url, case-insensitively', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ title: 'Vue Guide', url: 'https://vuejs.org/' }),
        makeVisit({ title: 'React Docs', url: 'https://react.dev/' })
      ])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ search: ref('VUE') })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.title).toBe('Vue Guide')
    })

    it('filters by exact domain', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref(['b.com']) })
      )

      expect(filteredVisits.value.map((v) => v.domain)).toEqual(['b.com'])
    })

    it('includes visits on the dateFrom day and excludes the day before', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ visitTime: new Date('2024-01-05T00:00:00.000') }),
        makeVisit({ visitTime: new Date('2024-01-04T23:59:59.999') })
      ])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ dateFrom: ref(new Date('2024-01-05T12:00:00.000')) })
      )

      expect(filteredVisits.value).toHaveLength(1)
    })

    it('keeps only visits whose source is in enabledSources', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ source: 'safari' }),
        makeVisit({ source: 'firefox' }),
        makeVisit({ source: 'chrome' }),
        makeVisit({ source: 'edge' })
      ])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ enabledSources: ref<UnifiedHistorySource[]>(['firefox', 'edge']) })
      )

      expect(filteredVisits.value.map((v) => v.source).sort()).toEqual(['edge', 'firefox'])
    })

    it('excludes every visit once all sources are disabled', () => {
      const visits = ref<UnifiedHistoryVisit[]>([makeVisit({ source: 'safari' })])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ enabledSources: ref<UnifiedHistorySource[]>([]) })
      )

      expect(filteredVisits.value).toEqual([])
    })

    it('applies multiple filters simultaneously (AND semantics)', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com', title: 'Match', source: 'firefox' }),
        makeVisit({ domain: 'a.com', title: 'Match', source: 'safari' }),
        makeVisit({ domain: 'b.com', title: 'Match', source: 'firefox' })
      ])
      const { filteredVisits } = useUnifiedHistoryFilters(
        visits,
        makeFilters({
          domainFilter: ref(['a.com']),
          search: ref('match'),
          enabledSources: ref<UnifiedHistorySource[]>(['firefox'])
        })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.source).toBe('firefox')
      expect(filteredVisits.value[0]?.domain).toBe('a.com')
    })
  })

  describe('topDomains', () => {
    it('is derived from filteredVisits, not all visits', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { topDomains } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref(['a.com']) })
      )

      expect(topDomains.value).toEqual([{ domain: 'a.com', count: 1, ratio: 100 }])
    })
  })

  describe('weekdayTrend', () => {
    it('is derived from filteredVisits, not all visits', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com', visitTime: new Date('2024-01-07T10:00:00.000') }),
        makeVisit({ domain: 'b.com', visitTime: new Date('2024-01-08T10:00:00.000') })
      ])
      const { weekdayTrend } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref(['a.com']) })
      )

      expect(weekdayTrend.value).toHaveLength(7)
      expect(weekdayTrend.value[0]).toEqual({ label: '日', count: 1, ratio: 100 })
    })
  })

  describe('hourlyTrend', () => {
    it('is derived from filteredVisits, not all visits', () => {
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ domain: 'a.com', visitTime: new Date('2024-01-07T09:00:00.000') }),
        makeVisit({ domain: 'b.com', visitTime: new Date('2024-01-08T22:00:00.000') })
      ])
      const { hourlyTrend } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref(['a.com']) })
      )

      expect(hourlyTrend.value).toHaveLength(24)
      expect(hourlyTrend.value[9]).toEqual({ label: '9', count: 1, ratio: 100 })
    })
  })

  describe('dateRangeLabel', () => {
    it('returns "-" when there is no data', () => {
      const { dateRangeLabel } = useUnifiedHistoryFilters(
        ref<UnifiedHistoryVisit[]>([]),
        makeFilters()
      )
      expect(dateRangeLabel.value).toBe('-')
    })

    it('formats the min and max visit times across all visits, ignoring active filters', () => {
      const min = new Date('2024-01-01T00:00:00.000Z')
      const max = new Date('2024-06-15T00:00:00.000Z')
      const visits = ref<UnifiedHistoryVisit[]>([
        makeVisit({ visitTime: max, domain: 'b.com' }),
        makeVisit({ visitTime: min, domain: 'a.com' })
      ])
      const { dateRangeLabel } = useUnifiedHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref(['a.com']) })
      )

      expect(dateRangeLabel.value).toBe(`${formatDate(min)} 〜 ${formatDate(max)}`)
    })
  })
})
