import type { Ref } from 'vue'
import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import { useVisitFilterEngine, type BaseVisitFilterState } from './useVisitFilterEngine'

export interface UnifiedHistoryFilterState extends BaseVisitFilterState {
  enabledSources: Ref<UnifiedHistorySource[]>
}

export function useUnifiedHistoryFilters(
  visits: Ref<UnifiedHistoryVisit[]>,
  filters: UnifiedHistoryFilterState
) {
  return useVisitFilterEngine(visits, filters, (v) =>
    filters.enabledSources.value.includes(v.source)
  )
}
