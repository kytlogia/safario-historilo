import type { Ref } from 'vue'
import type { ChromiumHistoryVisit } from '~/types/history'
import { isRedirectTransition } from '~/utils/chromiumVisitType'
import {
  useVisitFilterEngine,
  type BaseVisitFilterState,
  type VisitFilterEngineI18n
} from './useVisitFilterEngine'

export interface ChromiumHistoryFilterState extends BaseVisitFilterState {
  onlyTyped: Ref<boolean>
  onlyRedirects: Ref<boolean>
  onlyHidden: Ref<boolean>
}

// Shared by the Chrome and Edge pages (both Chromium-based, identical
// schema) — mirrors useFirefoxHistoryFilters.ts.
export function useChromiumHistoryFilters(
  visits: Ref<ChromiumHistoryVisit[]>,
  filters: ChromiumHistoryFilterState,
  i18n?: VisitFilterEngineI18n
) {
  return useVisitFilterEngine(
    visits,
    filters,
    (v) => {
      if (filters.onlyTyped.value && !v.typed) return false
      if (filters.onlyRedirects.value && !isRedirectTransition(v.transition)) return false
      if (filters.onlyHidden.value && !v.hidden) return false
      return true
    },
    i18n
  )
}
