import type { Ref } from 'vue'
import type { HistoryVisit } from '~/types/history'
import {
  useVisitFilterEngine,
  type BaseVisitFilterState,
  type VisitFilterEngineI18n
} from './useVisitFilterEngine'

export interface HistoryFilterState extends BaseVisitFilterState {
  onlyFailed: Ref<boolean>
  onlyRedirects: Ref<boolean>
  onlySynthesized: Ref<boolean>
}

export function useHistoryFilters(
  visits: Ref<HistoryVisit[]>,
  filters: HistoryFilterState,
  i18n?: VisitFilterEngineI18n
) {
  return useVisitFilterEngine(
    visits,
    filters,
    (v) => {
      if (filters.onlyFailed.value && v.loadSuccessful) return false
      if (
        filters.onlyRedirects.value &&
        v.redirectSource === null &&
        v.redirectDestination === null
      )
        return false
      if (filters.onlySynthesized.value && !v.synthesized) return false
      return true
    },
    i18n
  )
}
