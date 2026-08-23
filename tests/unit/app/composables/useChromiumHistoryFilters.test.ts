import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useChromiumHistoryFilters } from '~/composables/useChromiumHistoryFilters'
import type { ChromiumHistoryVisit } from '~/types/history'
import { formatDate } from '~/utils/format'

function makeVisit(overrides: Partial<ChromiumHistoryVisit> = {}): ChromiumHistoryVisit {
  return {
    visitId: 1,
    urlId: 1,
    url: 'https://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: '123',
    visitCount: 1,
    typedCount: 0,
    transition: 0,
    fromVisit: null,
    visitDuration: 0,
    hidden: false,
    typed: false,
    ...overrides
  }
}

function makeFilters(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    search: ref(''),
    domainFilter: ref<string | null>(null),
    dateFrom: ref<Date | null>(null),
    dateTo: ref<Date | null>(null),
    onlyTyped: ref(false),
    onlyRedirects: ref(false),
    onlyHidden: ref(false),
    ...overrides
  } as {
    search: ReturnType<typeof ref<string>>
    domainFilter: ReturnType<typeof ref<string | null>>
    dateFrom: ReturnType<typeof ref<Date | null>>
    dateTo: ReturnType<typeof ref<Date | null>>
    onlyTyped: ReturnType<typeof ref<boolean>>
    onlyRedirects: ReturnType<typeof ref<boolean>>
    onlyHidden: ReturnType<typeof ref<boolean>>
  }
}

describe('useChromiumHistoryFilters', () => {
  describe('domainOptions', () => {
    it('counts visits per domain and sorts descending by count', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' }),
        makeVisit({ domain: 'a.com' })
      ])
      const { domainOptions } = useChromiumHistoryFilters(visits, makeFilters())

      expect(domainOptions.value).toEqual([
        { title: 'a.com (2)', value: 'a.com' },
        { title: 'b.com (1)', value: 'b.com' }
      ])
    })
  })

  describe('filteredVisits', () => {
    it('matches search text against title or url, case-insensitively', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ title: 'Vue Guide', url: 'https://vuejs.org/' }),
        makeVisit({ title: 'React Docs', url: 'https://react.dev/' })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ search: ref('VUE') })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.title).toBe('Vue Guide')
    })

    it('filters by exact domain', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('b.com') })
      )

      expect(filteredVisits.value.map((v) => v.domain)).toEqual(['b.com'])
    })

    it('includes visits on the dateFrom day and excludes the day before', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ visitTime: new Date('2024-01-05T00:00:00.000') }),
        makeVisit({ visitTime: new Date('2024-01-04T23:59:59.999') })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ dateFrom: ref(new Date('2024-01-05T12:00:00.000')) })
      )

      expect(filteredVisits.value).toHaveLength(1)
    })

    it('includes visits on the dateTo day and excludes the day after', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ visitTime: new Date('2024-01-05T23:59:59.999') }),
        makeVisit({ visitTime: new Date('2024-01-06T00:00:00.000') })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ dateTo: ref(new Date('2024-01-05T00:00:00.000')) })
      )

      expect(filteredVisits.value).toHaveLength(1)
    })

    it('onlyTyped keeps only typed visits', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ transition: 0, typed: false }),
        makeVisit({ transition: 1, typed: true })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ onlyTyped: ref(true) })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.transition).toBe(1)
    })

    it('onlyRedirects keeps only visits with the client/server redirect qualifier bits set', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ transition: 0 }),
        makeVisit({ transition: 0 | 0x40000000 }),
        makeVisit({ transition: 0 | 0x80000000 })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ onlyRedirects: ref(true) })
      )

      expect(filteredVisits.value).toHaveLength(2)
    })

    it('onlyHidden keeps only hidden visits', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ hidden: false }),
        makeVisit({ hidden: true })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ onlyHidden: ref(true) })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.hidden).toBe(true)
    })

    it('applies multiple filters simultaneously (AND semantics)', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ domain: 'a.com', title: 'Match', transition: 1, typed: true }),
        makeVisit({ domain: 'a.com', title: 'Match', transition: 0, typed: false }),
        makeVisit({ domain: 'b.com', title: 'Match', transition: 1, typed: true })
      ])
      const { filteredVisits } = useChromiumHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com'), onlyTyped: ref(true), search: ref('match') })
      )

      expect(filteredVisits.value).toHaveLength(1)
      expect(filteredVisits.value[0]?.domain).toBe('a.com')
      expect(filteredVisits.value[0]?.transition).toBe(1)
    })

    it('returns an empty array when there is no data', () => {
      const { filteredVisits } = useChromiumHistoryFilters(
        ref<ChromiumHistoryVisit[]>([]),
        makeFilters()
      )
      expect(filteredVisits.value).toEqual([])
    })
  })

  describe('topDomains', () => {
    it('is derived from filteredVisits, not all visits', () => {
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ domain: 'a.com' }),
        makeVisit({ domain: 'b.com' })
      ])
      const { topDomains } = useChromiumHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com') })
      )

      expect(topDomains.value).toEqual([{ domain: 'a.com', count: 1, ratio: 100 }])
    })
  })

  describe('dateRangeLabel', () => {
    it('returns "-" when there is no data', () => {
      const { dateRangeLabel } = useChromiumHistoryFilters(
        ref<ChromiumHistoryVisit[]>([]),
        makeFilters()
      )
      expect(dateRangeLabel.value).toBe('-')
    })

    it('formats the min and max visit times across all visits, ignoring active filters', () => {
      const min = new Date('2024-01-01T00:00:00.000Z')
      const max = new Date('2024-06-15T00:00:00.000Z')
      const visits = ref<ChromiumHistoryVisit[]>([
        makeVisit({ visitTime: max, domain: 'b.com' }),
        makeVisit({ visitTime: min, domain: 'a.com' })
      ])
      const { dateRangeLabel } = useChromiumHistoryFilters(
        visits,
        makeFilters({ domainFilter: ref('a.com') })
      )

      expect(dateRangeLabel.value).toBe(`${formatDate(min)} 〜 ${formatDate(max)}`)
    })
  })
})
