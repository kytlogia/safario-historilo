import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useNetscapeHistoryFilters } from '~/composables/useNetscapeHistoryFilters'
import type { NetscapeHistoryVisit } from '~/types/history'

// Only the Netscape-specific half is covered here — the shared
// search/domain/date/aggregation behavior lives in useVisitFilterEngine and
// is already covered via useFirefoxHistoryFilters.test.ts.
function makeVisit(overrides: Partial<NetscapeHistoryVisit> = {}): NetscapeHistoryVisit {
  return {
    rowId: '1',
    url: 'http://example.com/',
    domain: 'example.com',
    title: 'Example',
    visitTime: new Date('2024-01-02T03:04:05.000Z'),
    visitTimeRaw: 1704164645000000,
    firstVisitTime: null,
    firstVisitTimeRaw: 0,
    visitCount: 1,
    referrer: '',
    hostname: 'example.com',
    hidden: false,
    typed: false,
    ...overrides
  }
}

function makeFilters(onlyTyped = false, onlyHidden = false) {
  return {
    search: ref(''),
    domainFilter: ref<string[]>([]),
    dateFrom: ref<Date | null>(null),
    dateTo: ref<Date | null>(null),
    onlyTyped: ref(onlyTyped),
    onlyHidden: ref(onlyHidden)
  }
}

describe('useNetscapeHistoryFilters', () => {
  const visits = ref<NetscapeHistoryVisit[]>([
    makeVisit({ rowId: 'plain' }),
    makeVisit({ rowId: 'typed', typed: true }),
    makeVisit({ rowId: 'hidden', hidden: true }),
    makeVisit({ rowId: 'both', typed: true, hidden: true })
  ])

  it('keeps every visit when neither flag filter is on', () => {
    const { filteredVisits } = useNetscapeHistoryFilters(visits, makeFilters())
    expect(filteredVisits.value.map((v) => v.rowId)).toEqual(['plain', 'typed', 'hidden', 'both'])
  })

  it('keeps only typed visits when onlyTyped is on', () => {
    const { filteredVisits } = useNetscapeHistoryFilters(visits, makeFilters(true))
    expect(filteredVisits.value.map((v) => v.rowId)).toEqual(['typed', 'both'])
  })

  it('keeps only hidden visits when onlyHidden is on', () => {
    const { filteredVisits } = useNetscapeHistoryFilters(visits, makeFilters(false, true))
    expect(filteredVisits.value.map((v) => v.rowId)).toEqual(['hidden', 'both'])
  })

  it('requires both flags when both filters are on', () => {
    const { filteredVisits } = useNetscapeHistoryFilters(visits, makeFilters(true, true))
    expect(filteredVisits.value.map((v) => v.rowId)).toEqual(['both'])
  })
})
