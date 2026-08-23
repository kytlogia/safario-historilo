import { computed, type Ref } from 'vue'
import type { FirefoxHistoryVisit } from '~/types/history'
import { formatDate } from '~/utils/format'
import { REDIRECT_VISIT_TYPES } from '~/utils/firefoxVisitType'

export interface FirefoxHistoryFilterState {
  search: Ref<string>
  domainFilter: Ref<string | null>
  dateFrom: Ref<Date | null>
  dateTo: Ref<Date | null>
  onlyTyped: Ref<boolean>
  onlyRedirects: Ref<boolean>
  onlyHidden: Ref<boolean>
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function countByDomain(visits: FirefoxHistoryVisit[]) {
  const counts = new Map<string, number>()
  for (const v of visits) {
    counts.set(v.domain, (counts.get(v.domain) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

export function useFirefoxHistoryFilters(
  visits: Ref<FirefoxHistoryVisit[]>,
  filters: FirefoxHistoryFilterState
) {
  const domainOptions = computed(() =>
    countByDomain(visits.value).map(([domain, count]) => ({
      title: `${domain} (${count})`,
      value: domain
    }))
  )

  const filteredVisits = computed(() => {
    const query = filters.search.value.trim().toLowerCase()
    const from = filters.dateFrom.value ? startOfDay(filters.dateFrom.value) : null
    const to = filters.dateTo.value ? endOfDay(filters.dateTo.value) : null

    return visits.value.filter((v) => {
      if (query && !v.title.toLowerCase().includes(query) && !v.url.toLowerCase().includes(query)) {
        return false
      }
      if (filters.domainFilter.value && v.domain !== filters.domainFilter.value) return false
      if (from && v.visitTime < from) return false
      if (to && v.visitTime > to) return false
      if (filters.onlyTyped.value && v.visitType !== 2) return false
      if (filters.onlyRedirects.value && !REDIRECT_VISIT_TYPES.has(v.visitType)) return false
      if (filters.onlyHidden.value && !v.hidden) return false
      return true
    })
  })

  const topDomains = computed(() => {
    const counted = countByDomain(filteredVisits.value)
    const max = counted.reduce((a, [, count]) => Math.max(a, count), 1)
    return counted
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count, ratio: (count / max) * 100 }))
  })

  const dateRangeLabel = computed(() => {
    if (visits.value.length === 0) return '-'
    const times = visits.value.map((v) => v.visitTime.getTime())
    const min = new Date(times.reduce((a, b) => Math.min(a, b)))
    const max = new Date(times.reduce((a, b) => Math.max(a, b)))
    return `${formatDate(min)} 〜 ${formatDate(max)}`
  })

  return { domainOptions, filteredVisits, topDomains, dateRangeLabel }
}
