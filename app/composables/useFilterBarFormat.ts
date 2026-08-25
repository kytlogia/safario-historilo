import { useI18n } from 'vue-i18n'
import { formatDateInputValue, formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'

// FilterBar.vue, FirefoxFilterBar.vue, ChromiumFilterBar.vue, and
// UnifiedFilterBar.vue each need the exact same locale-aware date-input
// formatter and "N / M" visible-count label — shared here instead of each
// component re-deriving them from useI18n()/useAppLocale() independently.
export function useFilterBarFormat() {
  const { t } = useI18n()
  const { intlLocale } = useAppLocale()

  function dateInputFormat(date: unknown) {
    return formatDateInputValue(date, intlLocale.value)
  }

  function visibleCount(shown: number, total: number) {
    return t('components.filterBar.visibleCount', {
      shown: formatNumber(shown, intlLocale.value),
      total: formatNumber(total, intlLocale.value)
    })
  }

  return { t, dateInputFormat, visibleCount }
}
