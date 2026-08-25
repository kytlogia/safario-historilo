import type { Ref } from 'vue'
import type { UnifiedHistorySource, UnifiedHistoryVisit } from '~/types/history'
import {
  useVisitFilterEngine,
  type BaseVisitFilterState,
  type VisitFilterEngineI18n
} from './useVisitFilterEngine'

export interface UnifiedHistoryFilterState extends BaseVisitFilterState {
  enabledSources: Ref<UnifiedHistorySource[]>
}

export function useUnifiedHistoryFilters(
  visits: Ref<UnifiedHistoryVisit[]>,
  filters: UnifiedHistoryFilterState,
  i18n?: VisitFilterEngineI18n
) {
  return useVisitFilterEngine(
    visits,
    filters,
    (v) => filters.enabledSources.value.includes(v.source),
    i18n
  )
}
