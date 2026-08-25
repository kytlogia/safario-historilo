import { computed, type Ref } from 'vue'
import { formatDate } from '~/utils/format'
import ja from '../../i18n/locales/ja.json'

export interface FilterableVisit {
  title: string
  url: string
  domain: string
  visitTime: Date
}

export interface BaseVisitFilterState {
  search: Ref<string>
  domainFilter: Ref<string | null>
  dateFrom: Ref<Date | null>
  dateTo: Ref<Date | null>
}

export interface TrendBucket {
  label: string
  count: number
  ratio: number
}

// The live translate/date-locale functions a caller with real Vue/i18n
// component context (a page or a page-level composable) supplies — see
// useAppLocale.ts's useVisitFilterI18n(). Kept as a plain interface (not a
// direct useI18n()/useAppLocale() call in this file) so this engine stays
// callable from plain unit tests with no Vue component instance at all; the
// default below falls back to this app's own default locale (ja) rather
// than a caller-supplied one.
export interface VisitFilterEngineI18n {
  t: (key: string, params?: Record<string, unknown>) => string
  tm: (key: string) => string[]
  intlLocale: () => string
}

function resolvePath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, source)
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match
  )
}

const DEFAULT_I18N: VisitFilterEngineI18n = {
  t: (key, params) => {
    const template = resolvePath(ja, key)
    return typeof template === 'string' ? interpolate(template, params) : key
  },
  tm: (key) => {
    const value = resolvePath(ja, key)
    return Array.isArray(value) ? (value as string[]) : []
  },
  intlLocale: () => 'ja-JP'
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => String(hour))

function toTrendBuckets(counts: number[], labels: string[]): TrendBucket[] {
  const max = counts.reduce((a, count) => Math.max(a, count), 1)
  return counts.map((count, i) => ({ label: labels[i]!, count, ratio: (count / max) * 100 }))
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function countByDomain<T extends FilterableVisit>(visits: T[]) {
  const counts = new Map<string, number>()
  for (const v of visits) {
    counts.set(v.domain, (counts.get(v.domain) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

/**
 * Search/domain/date-range filtering, domain aggregation, and date-range
 * labeling shared by useHistoryFilters.ts (Safari) and
 * useFirefoxHistoryFilters.ts (Firefox) — the two composables differ only in
 * their own browser-specific status-flag filters, supplied here via
 * `matchesExtra` so each caller keeps full type safety over its own visit
 * shape and filter refs.
 */
export function useVisitFilterEngine<T extends FilterableVisit>(
  visits: Ref<T[]>,
  filters: BaseVisitFilterState,
  matchesExtra: (visit: T) => boolean,
  i18n: VisitFilterEngineI18n = DEFAULT_I18N
) {
  const { t, tm, intlLocale } = i18n

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
      return matchesExtra(v)
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
    return t('common.dateRange', {
      from: formatDate(min, intlLocale()),
      to: formatDate(max, intlLocale())
    })
  })

  const weekdayTrend = computed(() => {
    const counts = new Array(7).fill(0)
    for (const v of filteredVisits.value) counts[v.visitTime.getDay()]++
    return toTrendBuckets(counts, tm('weekday'))
  })

  const hourlyTrend = computed(() => {
    const counts = new Array(24).fill(0)
    for (const v of filteredVisits.value) counts[v.visitTime.getHours()]++
    return toTrendBuckets(counts, HOUR_LABELS)
  })

  return {
    domainOptions,
    filteredVisits,
    topDomains,
    dateRangeLabel,
    weekdayTrend,
    hourlyTrend
  }
}
