import type { Ref } from 'vue'
import type { NetscapeHistoryVisit } from '~/types/history'
import {
  useVisitFilterEngine,
  type BaseVisitFilterState,
  type VisitFilterEngineI18n
} from './useVisitFilterEngine'

/**
 * Netscape's history.dat has no per-visit transition type, so there is no
 * "redirects only" equivalent of the Firefox/Chromium filter — only the two
 * per-URL flags Mork actually stores (Typed/Hidden).
 */
export interface NetscapeHistoryFilterState extends BaseVisitFilterState {
  onlyTyped: Ref<boolean>
  onlyHidden: Ref<boolean>
}

export function useNetscapeHistoryFilters(
  visits: Ref<NetscapeHistoryVisit[]>,
  filters: NetscapeHistoryFilterState,
  i18n?: VisitFilterEngineI18n
) {
  return useVisitFilterEngine(
    visits,
    filters,
    (v) => {
      if (filters.onlyTyped.value && !v.typed) return false
      if (filters.onlyHidden.value && !v.hidden) return false
      return true
    },
    i18n
  )
}
