// moz_historyvisits.visit_type — Firefox's `nsINavHistoryService` transition
// type constants (see mozilla-central toolkit/components/places/nsINavHistoryService.idl).
const VISIT_TYPE_KEYS: Record<number, string> = {
  1: 'visitType.firefox.1',
  2: 'visitType.firefox.2',
  3: 'visitType.firefox.3',
  4: 'visitType.firefox.4',
  5: 'visitType.firefox.5',
  6: 'visitType.firefox.6',
  7: 'visitType.firefox.7',
  8: 'visitType.firefox.8',
  9: 'visitType.firefox.9'
}

export const REDIRECT_VISIT_TYPES: ReadonlySet<number> = new Set([5, 6])

export function formatFirefoxVisitType(
  visitType: number,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  const key = VISIT_TYPE_KEYS[visitType]
  return key ? t(key) : t('visitType.unknown', { code: visitType })
}
