import { useI18n } from 'vue-i18n'
import { formatDateInputValue, formatNumber } from '~/utils/format'
import { useAppLocale } from '~/composables/useAppLocale'
import { useAppSnackbar } from '~/composables/useAppSnackbar'

// FilterBar.vue, FirefoxFilterBar.vue, ChromiumFilterBar.vue, and
// UnifiedFilterBar.vue each need the exact same locale-aware date-input
// formatter and "N / M" visible-count label — shared here instead of each
// component re-deriving them from useI18n()/useAppLocale() independently.
export function useFilterBarFormat() {
  const { t } = useI18n()
  const { intlLocale } = useAppLocale()
  const { showError } = useAppSnackbar()

  function dateInputFormat(date: unknown) {
    return formatDateInputValue(date, intlLocale.value)
  }

  function visibleCount(shown: number, total: number) {
    return t('components.filterBar.visibleCount', {
      shown: formatNumber(shown, intlLocale.value),
      total: formatNumber(total, intlLocale.value)
    })
  }

  // The four *FilterBar.vue export buttons call straight into
  // app/utils/export.ts (new Blob/createObjectURL + DOM anchor click), none
  // of it wrapped in a try/catch — a thrown error (e.g. memory exhaustion on
  // a large export, or a browser/extension blocking Blob URLs) previously
  // just vanished into Vue's own event-handler error logging, so from the
  // user's side clicking "JSON出力"/"CSV出力" did nothing with no way to
  // tell why (#113). Wrapping here, once, covers every export button in
  // every filter bar instead of repeating the same try/catch four times.
  function exportSafely(runExport: () => void) {
    try {
      runExport()
    } catch (error) {
      console.error(error)
      showError(t('error.exportFailed'))
    }
  }

  return { t, dateInputFormat, visibleCount, exportSafely }
}
