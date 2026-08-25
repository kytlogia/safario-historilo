import type { Ref } from 'vue'
import type { FirefoxHistoryVisit } from '~/types/history'
import { REDIRECT_VISIT_TYPES } from '~/utils/firefoxVisitType'
import {
  useVisitFilterEngine,
  type BaseVisitFilterState,
  type VisitFilterEngineI18n
} from './useVisitFilterEngine'

export interface FirefoxHistoryFilterState extends BaseVisitFilterState {
  onlyTyped: Ref<boolean>
  onlyRedirects: Ref<boolean>
  onlyHidden: Ref<boolean>
}

export function useFirefoxHistoryFilters(
  visits: Ref<FirefoxHistoryVisit[]>,
  filters: FirefoxHistoryFilterState,
  i18n?: VisitFilterEngineI18n
) {
  return useVisitFilterEngine(
    visits,
    filters,
    (v) => {
      if (filters.onlyTyped.value && !v.typed) return false
      if (filters.onlyRedirects.value && !REDIRECT_VISIT_TYPES.has(v.visitType)) return false
      if (filters.onlyHidden.value && !v.hidden) return false
      return true
    },
    i18n
  )
}
