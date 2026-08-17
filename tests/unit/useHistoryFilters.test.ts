import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useHistoryFilters } from '~/composables/useHistoryFilters'
import type { HistoryVisit } from '~/types/history'
import { formatDate } from '~/utils/format'

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

function makeFilters(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    search: ref(''),
    domainFilter: ref<string | null>(null),
    dateFrom: ref<Date | null>(null),
    dateTo: ref<Date | null>(null),
    onlyFailed: ref(false),
    onlyRedirects: ref(false),
    onlySynthesized: ref(false),
    ...overrides
  } as {
    search: ReturnType<typeof ref<string>>
    domainFilter: ReturnType<typeof ref<string | null>>
    dateFrom: ReturnType<typeof ref<Date | null>>
    dateTo: ReturnType<typeof ref<Date | null>>
    onlyFailed: ReturnType<typeof ref<boolean>>
    onlyRedirects: ReturnType<typeof ref<boolean>>
    onlySynthesized: ReturnType<typeof ref<boolean>>
  }
}

describe('useHistoryFilters', () => {
  describe('domainOptions', () => {
    it('counts visits per domain and sorts descending by count', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' }),
        makeVisit({ domain: 'a.com' })
      ])
      const { domainOptions } = useHistoryFilters(visits, makeFilters())

      expect(domainOptions.value).toEqual([
        { title: 'a.com (2)', value: 'a.com' },
        { title: 'b.com (1)', value: 'b.com' }
      ])
    })

    it('is unaffected by the active filters (built from all visits)', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { domainOptions } = useHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com') })
      )

      expect(domainOptions.value.map((o) => o.value)).toEqual(['a.com', 'b.com'])
    })
  })

  describe('filteredVisits', () => {
    it('matches search text against title or url, case-insensitively', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ title: 'Vue Guide', url: 'https://vuejs.org/' }),
        makeVisit({ title: 'React Docs', url: 'https://react.dev/' })
      ])
      const { filteredVisits } = useHistoryFilters(visits, makeFilters({ search: ref('VUE') }))

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.title).toBe('Vue Guide')
    })

    it('filters by exact domain', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('b.com') })
      )

      expect(filteredVisits.value.map((v) => v.domain)).toEqual(['b.com'])
    })

    it('includes visits on the dateFrom day and excludes the day before', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ visitTime: new Date('2024-01-05T00:00:00.000') }),
        makeVisit({ visitTime: new Date('2024-01-04T23:59:59.999') })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ dateFrom: ref(new Date('2024-01-05T12:00:00.000')) })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.visitTime.toISOString()).toBe(
        new Date('2024-01-05T00:00:00.000').toISOString()
      )
    })

    it('includes visits on the dateTo day and excludes the day after', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ visitTime: new Date('2024-01-05T23:59:59.999') }),
        makeVisit({ visitTime: new Date('2024-01-06T00:00:00.000') })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ dateTo: ref(new Date('2024-01-05T00:00:00.000')) })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.visitTime.toISOString()).toBe(
        new Date('2024-01-05T23:59:59.999').toISOString()
      )
    })

    it('excludes failed loads when onlyFailed is off, includes only failed loads when on', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ loadSuccessful: true }),
        makeVisit({ loadSuccessful: false })
      ])
      const { filteredVisits } = useHistoryFilters(visits, makeFilters({ onlyFailed: ref(true) }))

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.loadSuccessful).toBe(false)
    })

    it('onlyRedirects keeps visits with either a redirect source or destination set', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ redirectSource: null, redirectDestination: null }),
        makeVisit({ redirectSource: 1, redirectDestination: null }),
        makeVisit({ redirectSource: null, redirectDestination: 2 })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ onlyRedirects: ref(true) })
      )

      expect(filteredVisits.value).toHaveLength(2)
    })

    it('onlySynthesized keeps only synthesized visits', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ synthesized: false }),
        makeVisit({ synthesized: true })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ onlySynthesized: ref(true) })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.synthesized).toBe(true)
    })

    it('applies multiple filters simultaneously (AND semantics)', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ domain: 'a.com', title: 'Match', loadSuccessful: false }),
        makeVisit({ domain: 'a.com', title: 'Match', loadSuccessful: true }),
        makeVisit({ domain: 'b.com', title: 'Match', loadSuccessful: false })
      ])
      const { filteredVisits } = useHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com'), onlyFailed: ref(true), search: ref('match') })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.domain).toBe('a.com')
      expect(filteredVisits.value[0]?.loadSuccessful).toBe(false)
    })

    it('returns an empty array when there is no data', () => {
      const { filteredVisits } = useHistoryFilters(ref<HistoryVisit[]>([]), makeFilters())
      expect(filteredVisits.value).toEqual([])
    })
  })

  describe('topDomains', () => {
    it('is derived from filteredVisits, not all visits', () => {
      const visits = ref<HistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { topDomains } = useHistoryFilters(visits, makeFilters({ domainFilter: ref('a.com') }))

      expect(topDomains.value).toEqual([{ domain: 'a.com', count: 1, ratio: 100 }])
    })

    it('sorts descending by count, caps at 10, and scales ratio against the max count', () => {
      const visits = ref<HistoryVisit[]>(
        Array.from({ length: 12 }, (_, i) =>
          Array.from({ length: 12 - i }, () => makeVisit({ domain: `d${i}.com` }))
        ).flat()
      )
      const { topDomains } = useHistoryFilters(visits, makeFilters())

      expect(topDomains.value).toHaveLength(10)
      expect(topDomains.value[0]).toEqual({ domain: 'd0.com', count: 12, ratio: 100 })
      expect(topDomains.value[1]).toEqual({ domain: 'd1.com', count: 11, ratio: (11 / 12) * 100 })
    })

    it('returns an empty array when there is no data', () => {
      const { topDomains } = useHistoryFilters(ref<HistoryVisit[]>([]), makeFilters())
      expect(topDomains.value).toEqual([])
    })
  })

  describe('dateRangeLabel', () => {
    it('returns "-" when there is no data', () => {
      const { dateRangeLabel } = useHistoryFilters(ref<HistoryVisit[]>([]), makeFilters())
      expect(dateRangeLabel.value).toBe('-')
    })

    it('formats the min and max visit times across all visits, ignoring active filters', () => {
      const min = new Date('2024-01-01T00:00:00.000Z')
      const max = new Date('2024-06-15T00:00:00.000Z')
      const visits = ref<HistoryVisit[]>([
        makeVisit({ visitTime: max, domain: 'b.com' }),
        makeVisit({ visitTime: min, domain: 'a.com' }),
        makeVisit({ visitTime: new Date('2024-03-01T00:00:00.000Z'), domain: 'c.com' })
      ])
      const { dateRangeLabel } = useHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com') })
      )

      expect(dateRangeLabel.value).toBe(`${formatDate(min)} 〜 ${formatDate(max)}`)
    })
  })
})
